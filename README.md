# @polvallverdu/base-ui-mcp

MCP server that gives AI assistants context about [Base UI](https://base-ui.com) — the unstyled React component library.

## Install

Claude Code:

```bash
claude mcp add base-ui -- npx -y @polvallverdu/base-ui-mcp
```

Codex CLI:

```bash
codex mcp add base-ui -- npx -y @polvallverdu/base-ui-mcp
```

Or add to `~/.codex/config.toml` (global) / `.codex/config.toml` (project):

```toml
[mcp_servers.base-ui]
command = "npx"
args = ["-y", "@polvallverdu/base-ui-mcp"]
```

Cursor — add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "base-ui": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@polvallverdu/base-ui-mcp"]
    }
  }
}
```

VS Code — add to `.vscode/mcp.json` (workspace) or run **MCP: Open User Configuration**:

```json
{
  "servers": {
    "base-ui": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@polvallverdu/base-ui-mcp"]
    }
  }
}
```

opencode — add to `opencode.json`:

```json
{
  "mcp": {
    "base-ui": {
      "type": "local",
      "command": ["npx", "-y", "@polvallverdu/base-ui-mcp"],
      "enabled": true
    }
  }
}
```

Prefer a different runner? Swap `npx -y @polvallverdu/base-ui-mcp` for:

| Runner | Command                              |
| ------ | ------------------------------------ |
| npm    | `npx -y @polvallverdu/base-ui-mcp`   |
| pnpm   | `pnpm dlx @polvallverdu/base-ui-mcp` |
| yarn   | `yarn dlx @polvallverdu/base-ui-mcp` |
| bun    | `bunx @polvallverdu/base-ui-mcp`     |

For JSON/TOML configs, split the runner into `command` + `args` (e.g. `"command": "pnpm"`, `"args": ["dlx", "@polvallverdu/base-ui-mcp"]`).

Works with any MCP client that supports stdio.

## Tools & resources

| Kind     | Name                | Purpose                                                                                                                                      |
| -------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool     | `base_ui_list_docs` | Fetches the Base UI docs index (`llms.txt`) and lists every page as an identifier you can pass to `base_ui_get_doc`.                         |
| Tool     | `base_ui_get_doc`   | Fetches a single Base UI docs page by path identifier (e.g. `react/components/accordion.md`).                                                |
| Resource | `base-ui://{+path}` | Same content as `base_ui_get_doc`, exposed as an MCP resource for clients that prefer resources over tools. Includes `list()` for discovery. |

All tools are read-only and idempotent. The server fetches content directly from `https://base-ui.com` on demand — nothing is cached server-side.

## Remote (legacy)

A hosted version used to run at `https://base-ui-mcp.polv.workers.dev/mcp`. It is being **sunset** in favor of the local npm package. If you're still pointing at it, migrate to the `npx -y @polvallverdu/base-ui-mcp` config above — it's faster, has no rate limits, and keeps working offline for pages you've already fetched.

## Requirements

- Node.js `>= 20` (or Bun `>= 1.2`).
- An MCP client (Cursor, Claude Desktop, Claude Code, Codex CLI, VS Code MCP, opencode, or any other stdio-capable client).

## License

Apache-2.0 — see [LICENSE](./LICENSE).
