import type { ListResourcesResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { getEnv } from '../types/env.js';
import path from 'path';
import { fileExists, readJsonFile } from './fs.js';
import { resolveTaskWorkspace } from './workspace.js';

export async function listResources(): Promise<ListResourcesResult> {
  // Static resources mirroring Python: tasks://list
  return {
    resources: [
      {
        uri: 'tasks://list',
        mimeType: 'application/json',
        name: 'List all orchestration tasks',
        description: 'Global registry of tasks created by the orchestrator',
      },
    ],
  };
}

export async function readResource(uri: string): Promise<ReadResourceResult> {
  if (uri === 'tasks://list') {
    const env = getEnv();
    const base = env.codex_ORCHESTRATOR_WORKSPACE?.trim()
      ? path.resolve(expandPath(env.codex_ORCHESTRATOR_WORKSPACE))
      : path.resolve('.agent-workspace');
    const globalPath = path.join(base, 'registry', 'GLOBAL_REGISTRY.json');
    const payload = (await fileExists(globalPath))
      ? await readJsonFile(globalPath, { tasks: [], message: 'No tasks found' })
      : { tasks: [], message: 'No tasks found' };
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(payload, null, 2),
        },
      ],
    };
  }

  // task://{task_id}/status
  if (uri.startsWith('task://') && uri.endsWith('/status')) {
    const taskId = uri.slice('task://'.length, -'/status'.length);
    const payload = await computeTaskStatus(taskId);
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(payload, null, 2),
        },
      ],
    };
  }

  // task://{task_id}/progress-timeline
  if (uri.startsWith('task://') && uri.endsWith('/progress-timeline')) {
    const taskId = uri.slice('task://'.length, -'/progress-timeline'.length);
    const payload = await computeTaskTimeline(taskId);
    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(payload, null, 2),
        },
      ],
    };
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({ success: false, error: `Unknown resource: ${uri}` }, null, 2),
      },
    ],
  };
}

function expandPath(inputPath: string): string {
  // Expand ~ and env vars similar to Python os.path.expanduser/expandvars
  let output = inputPath.replace(/^~(?=$|\/|\\)/, process.env.HOME ?? '~');
  output = output.replace(/\$(\w+)|\${(\w+)}/g, (_, a: string, b: string) => {
    const key = a || b;
    return process.env[key] ?? '';
  });
  return output;
}

async function computeTaskStatus(taskId: string): Promise<any> {
  const { workspace, registryPath } = await resolveTaskWorkspace(taskId);
  if (!(await fileExists(registryPath))) return { success: false, error: `Task ${taskId} not found` };
  const registry = await readJsonFile<any>(registryPath, {});

  const fs = await import('fs');
  const pathMod = await import('path');
  const readJsonl = (dir: string, suffix: string) => {
    const out: any[] = [];
    try {
      for (const file of fs.readdirSync(dir)) {
        if (file.endsWith(suffix)) {
          try {
            const lines = fs.readFileSync(pathMod.join(dir, file), 'utf-8').split('\n');
            for (const line of lines) {
              const l = line.trim();
              if (l) {
                try { out.push(JSON.parse(l)); } catch {}
              }
            }
          } catch {}
        }
      }
    } catch {}
    return out;
  };
  const progress = readJsonl(pathMod.join(workspace, 'progress'), '_progress.jsonl');
  const findings = readJsonl(pathMod.join(workspace, 'findings'), '_findings.jsonl');
  progress.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  findings.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

  return {
    success: true,
    task_id: taskId,
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
      recent_updates: progress.slice(0, 10),
      recent_findings: findings.slice(0, 5),
      total_progress_entries: progress.length,
      total_findings: findings.length,
    },
    spiral_status: registry.spiral_checks || {},
    limits: {
      max_agents: registry.max_agents || 10,
      max_concurrent: registry.max_concurrent || 5,
      max_depth: registry.max_depth || 3,
    },
  };
}

async function computeTaskTimeline(taskId: string): Promise<any> {
  const { workspace } = await resolveTaskWorkspace(taskId);
  const fs = await import('fs');
  const pathMod = await import('path');
  const allProgress: any[] = [];
  const allFindings: any[] = [];
  try {
    for (const file of fs.readdirSync(pathMod.join(workspace, 'progress'))) {
      if (file.endsWith('_progress.jsonl')) {
        const lines = fs.readFileSync(pathMod.join(workspace, 'progress', file), 'utf-8').split('\n');
        for (const line of lines) { const l = line.trim(); if (!l) continue; try { allProgress.push(JSON.parse(l)); } catch {} }
      }
    }
  } catch {}
  try {
    for (const file of fs.readdirSync(pathMod.join(workspace, 'findings'))) {
      if (file.endsWith('_findings.jsonl')) {
        const lines = fs.readFileSync(pathMod.join(workspace, 'findings', file), 'utf-8').split('\n');
        for (const line of lines) { const l = line.trim(); if (!l) continue; try { allFindings.push(JSON.parse(l)); } catch {} }
      }
    }
  } catch {}
  allProgress.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  allFindings.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  const timeline = [
    ...allProgress.map((p) => ({ ...p, entry_type: 'progress' })),
    ...allFindings.map((f) => ({ ...f, entry_type: 'finding' })),
  ].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  return {
    task_id: taskId,
    timeline,
    summary: {
      total_progress_entries: allProgress.length,
      total_findings: allFindings.length,
      timeline_span: {
        start: timeline[0]?.timestamp ?? null,
        end: timeline[timeline.length - 1]?.timestamp ?? null,
      },
      agents_active: new Set(timeline.map((e: any) => e.agent_id).filter(Boolean)).size,
    },
  };
}


