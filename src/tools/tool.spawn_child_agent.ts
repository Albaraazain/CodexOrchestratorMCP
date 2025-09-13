import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { RegisteredTool } from './index.js';
import type { Logger } from '../utils/logger.js';
import { deployHeadlessAgentSchema } from './tool.deploy_headless_agent.js';
import { deployHeadlessAgentTool } from './tool.deploy_headless_agent.js';

export const spawnChildAgentSchema = z.object({
  task_id: z.string().min(1),
  parent_agent_id: z.string().min(1),
  child_agent_type: z.string().min(1),
  child_prompt: z.string().min(1),
});

export type SpawnChildAgentInput = z.infer<typeof spawnChildAgentSchema>;

export function spawnChildAgentTool(logger: Logger): RegisteredTool<SpawnChildAgentInput> {
  const deploy = deployHeadlessAgentTool(logger);
  return {
    definition: {
      name: 'spawn_child_agent',
      description: 'Spawn a child agent (delegates to deploy_headless_agent)',
      inputSchema: zodToJsonSchema(spawnChildAgentSchema),
    },
    schema: spawnChildAgentSchema.strict(),
    handler: async (input) => {
      const mapped = {
        task_id: input.task_id,
        agent_type: input.child_agent_type,
        prompt: input.child_prompt,
        parent: input.parent_agent_id,
      };
      const valid = deployHeadlessAgentSchema.parse(mapped);
      return deploy.handler(valid);
    },
  };
}


