---
name: signal:groups
description: Add or remove Signal groups for this channel
---

Manage which Signal groups this channel listens to.

**Subcommands:**

- `/signal:groups` — list configured groups
- `/signal:groups add <name> <prefix>` — add a group by name with a reply prefix
- `/signal:groups remove <name>` — remove a group

**What to do for `add`:**

1. Read `~/.claude/channels/signal/config.json`
2. Call the signal-cli REST API to list groups: `GET http://<baseUrl>/v1/groups/<accountNumber>`
   - Use `WebFetch` or `Bash` with `curl` to make this call
3. Find the group matching the given name (case-insensitive)
4. If found, add `{ id: <id>, internalId: <internal_id>, name: <name>, replyPrefix: <prefix> }` to the `groups` array in config. The REST API returns both `id` (e.g. `group.xxx`) and `internal_id` (raw base64) — store both.
5. Save config
6. Tell the user to restart the session for the change to take effect

**What to do for `remove`:**

1. Read config, remove the matching group entry, save
2. Tell the user to restart the session

**What to do with no args:**

1. Read config, display the list of configured groups with their IDs and prefixes
