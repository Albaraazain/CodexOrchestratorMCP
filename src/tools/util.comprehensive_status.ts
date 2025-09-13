import path from 'path';
import { resolveTaskWorkspace } from '../utils/workspace.js';
import { fileExists, readJsonFile } from '../utils/fs.js';

export async function getComprehensiveTaskStatus(taskId: string): Promise<any> {
  const { workspace, registryPath } = await resolveTaskWorkspace(taskId);
  if (!(await fileExists(registryPath))) return { success: false, error: `Task ${taskId} not found` };
  const registry = await readJsonFile<any>(registryPath, {});

  const fs = await import('fs');
  const allProgress: any[] = [];
  const progressDir = path.join(workspace, 'progress');
  try {
    for (const file of fs.readdirSync(progressDir)) {
      if (file.endsWith('_progress.jsonl')) {
        const lines = fs.readFileSync(path.join(progressDir, file), 'utf-8').split('\n');
        for (const line of lines) {
          const l = line.trim();
          if (!l) continue;
          try { allProgress.push(JSON.parse(l)); } catch {}
        }
      }
    }
  } catch {}

  const allFindings: any[] = [];
  const findingsDir = path.join(workspace, 'findings');
  try {
    for (const file of fs.readdirSync(findingsDir)) {
      if (file.endsWith('_findings.jsonl')) {
        const lines = fs.readFileSync(path.join(findingsDir, file), 'utf-8').split('\n');
        for (const line of lines) {
          const l = line.trim();
          if (!l) continue;
          try { allFindings.push(JSON.parse(l)); } catch {}
        }
      }
    }
  } catch {}

  allProgress.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  allFindings.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

  return {
    success: true,
    task_info: {
      task_id: taskId,
      description: registry.task_description,
      status: registry.status,
      workspace,
    },
    agents: {
      total_spawned: registry.total_spawned || 0,
      active: registry.active_count || 0,
      completed: registry.completed_count || 0,
      agents_list: registry.agents || [],
    },
    coordination_data: {
      recent_progress: allProgress.slice(0, 20),
      recent_findings: allFindings.slice(0, 10),
      agent_status_summary: Object.fromEntries(
        (registry.agents || []).map((agent: any) => [
          agent.id,
          {
            type: agent.type,
            status: agent.status,
            progress: agent.progress ?? 0,
            last_update: agent.last_update,
          },
        ]),
      ),
    },
    hierarchy: registry.agent_hierarchy || {},
  };
}


