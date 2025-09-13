## codex Orchestrator MCP (TypeScript)

Production-ready TypeScript/Node.js MCP server to orchestrate headless codex agents with anti-spiral protection. Converted from the original Python implementation.

### Install

```bash
npm i -g codex-orchestrator-mcp  # when published
# or run via npx (zero install)
npx -y codex-orchestrator-mcp
```

### Run (stdio)

```bash
# Dev
npm run dev

# Build & start
npm run build && npm start
```

### MCP Config Example (Cursor/Claude Code)

```json
{
  "mcpServers": {
    "codex-orchestrator-mcp": {
      "command": "node",
      "args": ["./dist/cjs/cli.js"],
      "env": {
        "codex_ORCHESTRATOR_WORKSPACE": "${workspaceFolder}/.agent-workspace",
        "codex_ORCHESTRATOR_MAX_CONCURRENT": "8",
        "codex_ORCHESTRATOR_MAX_AGENTS": "25",
        "codex_ORCHESTRATOR_MAX_DEPTH": "5"
      }
    }
  }
}
```

### Tools

- create_real_task(description, priority?, workspace_base?, caller_cwd?)
- deploy_headless_agent(task_id, agent_type, prompt, parent?)
- get_real_task_status(task_id)
- kill_real_agent(task_id, agent_id, reason?)
- get_agent_output(task_id, agent_id)
- update_agent_progress(task_id, agent_id, status, message, progress?)
- report_agent_finding(task_id, agent_id, finding_type, severity, message, data?)
- spawn_child_agent(task_id, parent_agent_id, child_agent_type, child_prompt)

### Environment

- codex_ORCHESTRATOR_WORKSPACE
- codex_ORCHESTRATOR_MAX_CONCURRENT
- codex_ORCHESTRATOR_MAX_AGENTS
- codex_ORCHESTRATOR_MAX_DEPTH
- codex_EXECUTABLE (default: codex)
- codex_FLAGS (default: --full-auto)
- codex_ORCHESTRATOR_ALWAYS_WORKS_ENABLED (default: 1)
- codex_ORCHESTRATOR_APPEND_PROMPT / codex_ORCHESTRATOR_APPEND_PROMPT_FILE

### Scripts

- build: compile ESM and CJS
- build:single: bundle CLI via ncc
- dev: run CLI with tsx
- start: run built CJS CLI


