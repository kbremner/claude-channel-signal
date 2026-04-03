# Signal Channel Budget Assistant — Design Spec

**Date:** 2026-04-03
**Status:** Draft

## Problem

The budget tracker runs as a daily GitHub Action that emails a static report. When transactions are misclassified (e.g. council tax not treated as a bill), correcting them requires editing JSON files in the repo and waiting 24 hours for the next run. This friction means corrections don't get made, and Eilidh has no visibility or ability to participate.

## Solution

Replace the email-based reporting with a conversational Signal-based assistant. A standalone Signal channel plugin for Claude Code bridges a Signal group chat to a persistent Claude Code session running on a NAS. Both Kyle and Eilidh can interact with the budget data conversationally — asking questions, making corrections, and receiving proactive notifications about new transactions and spending.

## Two Deliverables

### 1. Signal Channel Plugin (standalone, reusable)

A generic Claude Code channel plugin that bridges Signal group chats to Claude Code sessions. It knows nothing about budgets — it's a general-purpose Signal channel.

**Repository:** Standalone repo (not inside budget-tracker).

**Runtime dependencies:**
- signal-cli REST API Docker container (`bbernhard/signal-cli-rest-api`, mode `json-rpc-native`) — runs as a shared service on the NAS, REST API on localhost:8080
- Node.js 21+ or Bun
- `@modelcontextprotocol/sdk`

**Signal setup:** signal-cli linked as a secondary device to Kyle's Signal account. No dedicated number needed.

**Configuration:** Managed via slash commands, stored in `~/.claude/channels/signal/config.json` (or similar). No per-repo env vars or `.mcp.json` edits needed for day-to-day management.

Config per channel instance:
- `group` — which Signal group to listen to (group ID or name)
- `replyPrefix` — prefix on outbound messages, e.g. `[Budget Bot]`
- `allowedSenders` — phone numbers permitted to send messages

**Slash commands:**
- `/signal:configure <base-url>` — set connection to signal-cli REST API (default `http://localhost:8080`)
- `/signal:add-group <name> <prefix>` — register a group for this session
- `/signal:remove-group <name>` — stop listening to a group
- `/signal:access pair <code>` — approve a sender via pairing code
- `/signal:access policy allowlist` — restrict to approved senders only
- `/signal:send <message>` — send a message to the configured group

**MCP channel protocol:**
- Declares `claude/channel` capability
- Emits `notifications/claude/channel` for each inbound message (filtered by group + sender allowlist)
- Exposes a `reply` tool for outbound messages (prepends configured prefix)
- Supports `claude/channel/permission` for remote tool approval
- Meta fields on inbound notifications: `sender_name`, `sender_number`, `group_name`

**Sender allowlist:**
- Pairing flow: sender messages the group, bot replies with pairing code, user approves in Claude Code session
- Only allowlisted senders' messages are forwarded to Claude Code
- Others are silently dropped

**Reference implementations:**
- https://github.com/BrendanMartin/claude-channel-signal (signal-cli integration patterns)
- https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/telegram (official channel plugin structure)
- https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins/discord (official channel plugin structure)

### 2. Budget Tracker — Migration from Email to Signal

Migrate the budget tracker from GitHub Action + email to NAS-based Claude Code session + Signal notifications.

**What changes in budget-tracker repo:**

- **CLAUDE.md** — updated instructions for the Signal-based workflow. Instead of "render and send email", Claude posts to the Signal group. Analysis still produces structured data, but output is conversational messages rather than JSON + HTML email.
- **systemd timer** — replaces the GitHub Action cron. Triggers daily fetch + categorise. Claude Code session (already running) picks up new data and posts to Signal.
- **Remove email dependency** — `scripts/send-email.js`, `scripts/render-email.js`, and `templates/email.njk` become unused. Can be removed or kept for reference.

**What stays the same:**

- `scripts/fetch.js` — still fetches from GoCardless API
- `scripts/categorise.js` — still categorises transactions
- Data files, mappings, overrides, budgets — all unchanged
- Git as the store of record for all changes

**Daily flow:**

1. systemd timer triggers daily (replacing GitHub Action cron at 3 AM UTC)
2. Runs `node scripts/fetch.js` and `node scripts/categorise.js`
3. Timer script sends a trigger message to the Signal group via the REST API (`POST /v2/send`). The channel plugin picks it up on next poll and forwards to the Claude Code session.
4. Claude reads the fresh categorised data, diffs against previous day, and posts to Signal group:
   - New transactions with assigned categories
   - Auto-categorised merchants (for review/correction)
   - Unknown merchants (asking for category)
   - Budget alerts (over budget or approaching limit)
   - Subscription price changes
   - Large transactions that may need splitting
5. Kyle and Eilidh reply throughout the day to correct anything

**Conversational corrections (handled by Claude reading CLAUDE.md + repo files):**

| Action | What Claude does |
|--------|-----------------|
| Recategorise merchant | Edits `mappings/merchants.json`, re-runs `categorise.js`, commits |
| Change who (shared/kyle/eilidh) | Edits merchant mapping or creates override, commits |
| Split transaction | Creates entry in `overrides/{YYYY-MM}.json`, re-runs `categorise.js`, commits |
| Add new category | Adds to `budgets.json` (with or without budget amount), commits |
| Answer spending question | Reads categorised data, responds with figures |

**What Claude does NOT do automatically:**
- Create overrides without being asked
- Change budget amounts without explicit instruction
- Delete or modify existing overrides unless asked

## Architecture

```
Kyle's phone / Eilidh's phone
        ↓ (Signal messages in budget group)
Signal servers
        ↓ (synced to linked device)
signal-cli REST API (Docker, json-rpc-native mode, localhost:8080)
        ↓ (polled by channel plugin, filtered by group + sender allowlist)
Signal channel plugin (MCP over stdio)
        ↓ (channel notifications)
Claude Code session (NAS, budget-tracker repo, persistent)
        ↓ (reply tool)
Signal channel plugin → REST API → Signal servers → phones
```

**Message flow — inbound:** In `json-rpc-native` mode, `GET /v1/receive/{number}` is a WebSocket endpoint. The channel plugin connects once and receives messages in real-time (no polling). Messages are filtered by group and sender allowlist, then forwarded to Claude Code as channel notifications.

**Message flow — outbound:** Claude calls the `reply` tool. The plugin sends `POST /v2/send` to the REST API with the configured reply prefix prepended.

**Multiple sessions:** The same signal-cli daemon can serve multiple Claude Code sessions. Each session's channel plugin filters for its own group. Future projects (home automation, notifications, etc.) add new sessions pointing at different repos and groups.

**NAS services (managed via systemd):**

| Service | Purpose | Restart policy |
|---------|---------|---------------|
| `signal-cli-rest-api` | Docker container (`json-rpc-native` mode), REST API on localhost:8080 | always restart |
| `claude-budget.service` | Claude Code session with `--channels server:signal`, working dir `budget-tracker/` | always restart |
| `budget-fetch.timer` | Daily trigger for fetch + categorise | n/a (timer) |

The Docker container is managed via `docker compose` (or Portainer if already in use on the NAS). The `docker-compose.yml` lives in the signal channel plugin repo.

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| signal-cli REST API breaks after Signal protocol update | Actively maintained (2,500 stars, 94 releases). Pin Docker image tag, update periodically. |
| Claude Code session crashes | systemd auto-restart. Messages sent while session is down are missed (Signal doesn't replay to linked devices). Acceptable for daily budget use. |
| Claude makes incorrect edits | All changes committed to git — easy to revert. Corrections are conversational so user sees what changed. |
| Channels API changes (research preview) | Plugin is small (~few hundred lines). Adapting to API changes is low effort. |
| Reply appears as Kyle, confusing Eilidh | Reply prefix (`[Budget Bot]`) makes bot messages visually distinct. |

## Out of Scope

- Web UI or dashboard
- Real-time transaction monitoring (GoCardless API is daily)
- Multi-currency support
- WhatsApp, Discord, or other platform bridges (future, same plugin pattern)
- Dedicated phone number for the bot (can be added later with a PAYG SIM)
