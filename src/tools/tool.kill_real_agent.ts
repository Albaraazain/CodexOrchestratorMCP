import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import path from 'path';
import { RegisteredTool } from './index.js';
import type { Logger } from '../utils/logger.js';
import { resolveTaskWorkspace } from '../utils/workspace.js';
import { fileExists, readJsonFile, writeJsonFile } from '../utils/fs.js';
import { checkTmuxSessionExists, killTmuxSession } from '../utils/tmux.js';

export const killRealAgentSchema = z.object({
  task_id: z.string().min(1),
  agent_id: z.string().min(1),
  reason: z.string().default('Manual termination'),
});

export type KillRealAgentInput = z.infer<typeof killRealAgentSchema>;

export function killRealAgentTool(_logger: Logger): RegisteredTool<KillRealAgentInput> {
  return {
    definition: {
      name: 'kill_real_agent',
      description: 'Terminate a real running agent by killing its tmux session',
      inputSchema: zodToJsonSchema(killRealAgentSchema),
    },
    schema: killRealAgentSchema.strict(),
    handler: async (input) => {
      const { registryPath } = await resolveTaskWorkspace(input.task_id);
      if (!(await fileExists(registryPath))) {
        return [{ type: 'text', text: JSON.stringify({ success: false, error: `Task ${input.task_id} not found` }) }];
      }
      const registry = await readJsonFile<any>(registryPath, {});
      const agent = (registry.agents || []).find((a: any) => a.id === input.agent_id);
      if (!agent) return [{ type: 'text', text: JSON.stringify({ success: false, error: `Agent ${input.agent_id} not found` }) }];

      const sessionName = agent.tmux_session as string | undefined;
      let killed = false;
      if (sessionName && (await checkTmuxSessionExists(sessionName))) {
        killed = await killTmuxSession(sessionName);
      }

      agent.status = 'terminated';
      agent.terminated_at = new Date().toISOString();
      agent.termination_reason = input.reason;
      registry.active_count = Math.max(0, Number(registry.active_count || 0) - 1);
      await writeJsonFile(registryPath, registry);

      return [
        {
          type: 'text',
          text: JSON.stringify({ success: true, agent_id: input.agent_id, tmux_session: sessionName, session_killed: killed, reason: input.reason, status: 'terminated' }),
        },
      ];
    },
  };
}


