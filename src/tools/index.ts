import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Logger } from '../utils/logger.js';
import { createRealTaskTool } from './tool.create_real_task.js';
import { deployHeadlessAgentTool } from './tool.deploy_headless_agent.js';
import { getRealTaskStatusTool } from './tool.get_real_task_status.js';
import { killRealAgentTool } from './tool.kill_real_agent.js';
import { getAgentOutputTool } from './tool.get_agent_output.js';
import { updateAgentProgressTool } from './tool.update_agent_progress.js';
import { reportAgentFindingTool } from './tool.report_agent_finding.js';
import { spawnChildAgentTool } from './tool.spawn_child_agent.js';

export interface RegisteredTool<Input> {
  definition: {
    name: string;
    description: string;
    inputSchema: unknown;
  };
  schema: z.ZodTypeAny;
  handler: (input: any) => Promise<{ type: 'text'; text: string }[]>;
}

export interface ToolRegistry {
  tools: RegisteredTool<unknown>[];
  byName: Map<string, RegisteredTool<unknown>>;
}

export function getToolRegistry(logger: Logger): ToolRegistry {
  const tools: RegisteredTool<unknown>[] = [
    createRealTaskTool(logger) as RegisteredTool<unknown>,
    deployHeadlessAgentTool(logger) as RegisteredTool<unknown>,
    getRealTaskStatusTool(logger) as RegisteredTool<unknown>,
    killRealAgentTool(logger) as RegisteredTool<unknown>,
    getAgentOutputTool(logger) as RegisteredTool<unknown>,
    updateAgentProgressTool(logger) as RegisteredTool<unknown>,
    reportAgentFindingTool(logger) as RegisteredTool<unknown>,
    spawnChildAgentTool(logger) as RegisteredTool<unknown>,
  ];

  const byName = new Map<string, RegisteredTool<unknown>>();
  for (const t of tools) {
    byName.set(t.definition.name, t);
  }
  return { tools, byName };
}


