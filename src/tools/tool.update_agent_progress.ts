import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import path from 'path';
import { RegisteredTool } from './index.js';
import type { Logger } from '../utils/logger.js';
import { resolveTaskWorkspace } from '../utils/workspace.js';
import { fileExists, readJsonFile, writeJsonFile } from '../utils/fs.js';
import { getComprehensiveTaskStatus } from './util.comprehensive_status.js';

export const updateAgentProgressSchema = z.object({
  task_id: z.string().min(1),
  agent_id: z.string().min(1),
  status: z.string().min(1),
  message: z.string().min(1),
  progress: z.number().int().min(0).max(100).default(0),
});

export type UpdateAgentProgressInput = z.infer<typeof updateAgentProgressSchema>;

export function updateAgentProgressTool(_logger: Logger): RegisteredTool<UpdateAgentProgressInput> {
  return {
    definition: {
      name: 'update_agent_progress',
      description: 'Update agent progress and return comprehensive task status',
      inputSchema: zodToJsonSchema(updateAgentProgressSchema),
    },
    schema: updateAgentProgressSchema.strict(),
    handler: async (input) => {
      const { workspace, registryPath } = await resolveTaskWorkspace(input.task_id);
      if (!(await fileExists(registryPath))) return [{ type: 'text', text: JSON.stringify({ success: false, error: `Task ${input.task_id} not found` }) }];
      const progressDir = path.join(workspace, 'progress');
      const progressFile = path.join(progressDir, `${input.agent_id}_progress.jsonl`);
      const fs = await import('fs');
      await fs.promises.mkdir(progressDir, { recursive: true });
      const entry = {
        timestamp: new Date().toISOString(),
        agent_id: input.agent_id,
        status: input.status,
        message: input.message,
        progress: input.progress,
      };
      fs.appendFileSync(progressFile, JSON.stringify(entry) + '\n');

      const registry = await readJsonFile<any>(registryPath, {});
      for (const agent of registry.agents || []) {
        if (agent.id === input.agent_id) {
          agent.last_update = new Date().toISOString();
          agent.status = input.status;
          agent.progress = input.progress;
          break;
        }
      }
      await writeJsonFile(registryPath, registry);

      const coordination = await getComprehensiveTaskStatus(input.task_id);
      const payload = {
        success: true,
        own_update: {
          agent_id: input.agent_id,
          status: input.status,
          progress: input.progress,
          message: input.message,
          timestamp: entry.timestamp,
        },
        coordination_info: coordination.success ? coordination : null,
      };
      return [{ type: 'text', text: JSON.stringify(payload) }];
    },
  };
}


