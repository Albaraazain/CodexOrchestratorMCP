export interface OrchestratorEnv {
  codex_ORCHESTRATOR_WORKSPACE?: string;
  codex_ORCHESTRATOR_MAX_AGENTS?: string;
  codex_ORCHESTRATOR_MAX_CONCURRENT?: string;
  codex_ORCHESTRATOR_MAX_DEPTH?: string;
  codex_ORCHESTRATOR_ALWAYS_WORKS_ENABLED?: string;
  codex_ORCHESTRATOR_APPEND_PROMPT?: string;
  codex_ORCHESTRATOR_APPEND_PROMPT_FILE?: string;
  codex_EXECUTABLE?: string;
  codex_FLAGS?: string;
  codex_CALLER_CWD?: string;
  codex_ORCHESTRATOR_AGENT_KEEPALIVE_SECS?: string;
}

export function getEnv(): OrchestratorEnv {
  return process.env as unknown as OrchestratorEnv;
}


