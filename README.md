# base-ui-mcp

MCP server for easy access to base-ui documentation

This server reads the live Base UI markdown docs from `https://base-ui.com`, including the current `llms.txt` index and release notes such as [`v1.2.0`](https://base-ui.com/react/overview/releases/v1-2-0.md).

## Usage

### Remote

```json
{
  "mcpServers": {
    "base-ui": {
      "url": "https://base-ui-mcp.polv.workers.dev/mcp"
    }
  }
}
```

### Local

1. Install dependencies with `bun install`
2. Build the server with `bun run build`
3. Run it over stdio with `bun run start:stdio`

Example MCP configuration:

```json
{
  "mcpServers": {
    "base-ui": {
      "command": "bun",
      "args": [
        "run",
        "/absolute/path/to/base-ui-mcp/dist/index.js"
      ]
    }
  }
}
```

To inspect the current docs index manually, open [`https://base-ui.com/llms.txt`](https://base-ui.com/llms.txt).
