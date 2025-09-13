#!/usr/bin/env node
import { startServer } from './server.js';

const debug = process.env.DEBUG?.toLowerCase() === 'true' || process.env.DEBUG === '1';

startServer({ debug }).catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error(`[codex-orchestrator-mcp] failed to start: ${message}`);
  process.exit(1);
});


