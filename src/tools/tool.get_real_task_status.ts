import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import path from 'path';
import { RegisteredTool } from './index.js';
import type { Logger } from '../utils/logger.js';
import { resolveTaskWorkspace } from '../utils/workspace.js';
import { fileExists, readJsonFile, writeJsonFile } from '../utils/fs.js';
import { checkTmuxSessionExists } from '../utils/tmux.js';

export const getRealTaskStatusSchema = z.object({
  task_id: z.string().min(1),
});

export type GetRealTaskStatusInput = z.infer<typeof getRealTaskStatusSchema>;

export function getRealTaskStatusTool(_logger: Logger): RegisteredTool<GetRealTaskStatusInput> {
  return {
    definition: {
      name: 'get_real_task_status',
      description: 'Get detailed status of a real task and its agents',
      inputSchema: zodToJsonSchema(getRealTaskStatusSchema),
    },
    schema: getRealTaskStatusSchema.strict(),
    handler: async (input) => {
      const { workspace, registryPath } = await resolveTaskWorkspace(input.task_id);
      if (!(await fileExists(registryPath))) return [{ type: 'text', text: JSON.stringify({ success: false, error: `Task ${input.task_id} not found` }) }];
      const registry = await readJsonFile<any>(registryPath, {});
      let changed = false;
      for (const agent of registry.agents || []) {
        if (agent.status === 'running' && agent.tmux_session) {
          const exists = await checkTmuxSessionExists(String(agent.tmux_session));
          if (!exists) {
            agent.status = 'completed';
            registry.active_count = Math.max(0, Number(registry.active_count || 0) - 1);
            registry.completed_count = Number(registry.completed_count || 0) + 1;
            changed = true;
          }
        }
      }
      if (changed) await writeJsonFile(registryPath, registry);

      const readJsonl = async (dir: string, suffix: string) => {
        const fs = await import('fs');
        const p = await import('path');
        const out: any[] = [];
        try {
          for (const file of fs.readdirSync(dir)) {
            if (file.endsWith(suffix)) {
              try {
                const lines = fs.readFileSync(p.join(dir, file), 'utf-8').split('\n');
                for (const line of lines) {
                  const l = line.trim();
                  if (!l) continue;
                  try { out.push(JSON.parse(l)); } catch {}
                }
              } catch {}
            }
          }
        } catch {}
        return out;
      };

      const progressEntries = await readJsonl(path.join(workspace, 'progress'), '_progress.jsonl');
      const findingsEntries = await readJsonl(path.join(workspace, 'findings'), '_findings.jsonl');
      progressEntries.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
      findingsEntries.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

      const payload = {
        success: true,
        task_id: input.task_id,
        description: registry.task_description,
        status: registry.status,
        workspace,
        agents: {
          total_spawned: registry.total_spawned || 0,
          active: registry.active_count || 0,
          completed: registry.completed_count || 0,
          agents_list: registry.agents || [],
        },
        hierarchy: registry.agent_hierarchy || {},
        enhanced_progress: {
          recent_updates: progressEntries.slice(0, 10),
          recent_findings: findingsEntries.slice(0, 5),
          total_progress_entries: progressEntries.length,
          total_findings: findingsEntries.length,
        },
        spiral_status: registry.spiral_checks || {},
        limits: {
          max_agents: registry.max_agents || 10,
          max_concurrent: registry.max_concurrent || 5,
          max_depth: registry.max_depth || 3,
        },
      };

      return [{ type: 'text', text: JSON.stringify(payload) }];
    },
  };
}


