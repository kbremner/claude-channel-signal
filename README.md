# claude-channel-signal

A Claude Code channel plugin that bridges Signal group chats to Claude Code sessions via the [signal-cli REST API](https://github.com/bbernhard/signal-cli-rest-api).

## Prerequisites

- [Claude Code](https://claude.ai/claude-code) v2.1.80+
- [signal-cli REST API](https://github.com/bbernhard/signal-cli-rest-api) running in `json-rpc` mode
- [Bun](https://bun.sh) runtime
- A Signal account linked to signal-cli as a secondary device

## Setup

### 1. Install the plugin

```bash
git clone https://github.com/kbremner/claude-channel-signal.git
cd claude-channel-signal
bun install
```

### 2. Register with Claude Code

Add to your project's `.mcp.json` or `~/.claude.json`:

```json
{
  "mcpServers": {
    "signal": {
      "command": "bun",
      "args": ["run", "/path/to/claude-channel-signal/src/server.ts"]
    }
  }
}
```

### 3. Configure

Start Claude Code and run:

```
/signal:configure http://localhost:8080 +441234567890
```

### 4. Add a group

```
/signal:groups add "Budget" "[Budget Bot]"
```

### 5. Start with channels enabled

```bash
claude --dangerously-load-development-channels server:signal
```

## Architecture

The plugin connects to the signal-cli REST API's WebSocket endpoint for real-time message reception and uses HTTP for sending. It follows the same patterns as the official Telegram and Discord channel plugins.

See the [design spec](docs/design-spec.md) for full details.
