import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import path from 'path';
import { RegisteredTool } from './index.js';
import type { Logger } from '../utils/logger.js';
import { resolveTaskWorkspace } from '../utils/workspace.js';
import { fileExists, readJsonFile } from '../utils/fs.js';
import { checkTmuxSessionExists, getTmuxSessionOutput } from '../utils/tmux.js';

export const getAgentOutputSchema = z.object({
  task_id: z.string().min(1),
  agent_id: z.string().min(1),
});

export type GetAgentOutputInput = z.infer<typeof getAgentOutputSchema>;

export function getAgentOutputTool(_logger: Logger): RegisteredTool<GetAgentOutputInput> {
  return {
    definition: {
      name: 'get_agent_output',
      description: "Get the current output from a running agent's tmux session",
      inputSchema: zodToJsonSchema(getAgentOutputSchema),
    },
    schema: getAgentOutputSchema.strict(),
    handler: async (input) => {
      const { workspace, registryPath } = await resolveTaskWorkspace(input.task_id);
      if (!(await fileExists(registryPath))) {
        return [{ type: 'text', text: JSON.stringify({ success: false, error: `Task ${input.task_id} not found` }) }];
      }
      const registry = await readJsonFile<any>(registryPath, {});
      const agent = (registry.agents || []).find((a: any) => a.id === input.agent_id);
      if (!agent) {
        return [{ type: 'text', text: JSON.stringify({ success: false, error: `Agent ${input.agent_id} not found` }) }];
      }
      if (!agent.tmux_session) {
        return [{ type: 'text', text: JSON.stringify({ success: false, error: `Agent ${input.agent_id} has no tmux session` }) }];
      }
      const sessionName = agent.tmux_session as string;
      if (!(await checkTmuxSessionExists(sessionName))) {
        return [{ type: 'text', text: JSON.stringify({ success: true, agent_id: input.agent_id, session_status: 'terminated', output: 'Agent session has terminated' }) }];
      }
      const output = await getTmuxSessionOutput(sessionName);
      return [
        {
          type: 'text',
          text: JSON.stringify({ success: true, agent_id: input.agent_id, tmux_session: sessionName, session_status: 'running', output }),
        },
      ];
    },
  };
}


