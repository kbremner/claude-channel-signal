---
name: signal:send
description: Send a message to a configured Signal group
---

Send a message from Claude to a Signal group.

**Usage:** `/signal:send <message>`

If multiple groups are configured, sends to the first group. To send to a specific group, use `/signal:send --group <name> <message>`.

**What to do:**

1. Read `~/.claude/channels/signal/config.json` to find configured groups
2. Use the `reply` MCP tool with the group's `id` field and the message text
3. The reply prefix is applied automatically by the tool
