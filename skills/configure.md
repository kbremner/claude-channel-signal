---
name: signal:configure
description: Configure the Signal channel connection
---

Set the signal-cli REST API base URL and account number.

**Usage:** `/signal:configure <base-url> <account-number>`

Example: `/signal:configure http://localhost:8080 +441234567890`

**What to do:**

1. Read the current config from `~/.claude/channels/signal/config.json`
2. Update `baseUrl` to the first argument (default `http://localhost:8080`)
3. Update `accountNumber` to the second argument
4. Write the updated config back
5. Tell the user to restart the Claude Code session for changes to take effect

**Implementation:** Use the `Write` tool to update `~/.claude/channels/signal/config.json`. Read it first if it exists, preserve other fields (like `groups`), only update `baseUrl` and `accountNumber`.
