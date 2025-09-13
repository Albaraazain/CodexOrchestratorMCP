## codex Orchestrator MCP (TypeScript)

TypeScript/Node.js MCP server to orchestrate headless codex agents with anti-spiral protection. This replaces the legacy Python server.

### Quick Start

```bash
npm install
npm run build
node dist/esm/cli.js
```

### Editor Config (example)

See `examples/config.json` or `src/examples/config.json` for a ready-to-use MCP config pointing to `node ./dist/esm/cli.js` with environment variables.

### Tools

Implements: `create_real_task`, `deploy_headless_agent`, `get_real_task_status`, `get_agent_output`, `kill_real_agent`, `update_agent_progress`, `report_agent_finding`, `spawn_child_agent`.

### Environment

`codex_ORCHESTRATOR_WORKSPACE`, `codex_ORCHESTRATOR_MAX_CONCURRENT`, `codex_ORCHESTRATOR_MAX_AGENTS`, `codex_ORCHESTRATOR_MAX_DEPTH`, `codex_EXECUTABLE`, `codex_FLAGS`, `codex_ORCHESTRATOR_ALWAYS_WORKS_ENABLED`, `codex_ORCHESTRATOR_APPEND_PROMPT`, `codex_ORCHESTRATOR_APPEND_PROMPT_FILE`.

### Notes

- Uses stdio transport and Zod validation
- All file operations are async
- tmux is required for background agents
