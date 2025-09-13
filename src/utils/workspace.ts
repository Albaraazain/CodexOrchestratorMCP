import path from 'path';
import { getEnv } from '../types/env.js';
import { ensureDir, fileExists, readJsonFile, writeJsonFile } from './fs.js';
import { expandPath } from './pathutil.js';

export interface GlobalRegistry {
  created_at: string;
  total_tasks: number;
  active_tasks: number;
  total_agents_spawned: number;
  active_agents: number;
  max_concurrent_agents: number;
  tasks: Record<string, unknown>;
  agents: Record<string, unknown>;
}

export function resolveWorkspaceBase(): string {
  const env = getEnv();
  const configured = env.codex_ORCHESTRATOR_WORKSPACE?.trim();
  if (configured) return path.resolve(expandPath(configured));
  return path.resolve('.agent-workspace');
}

export function taskWorkspace(taskId: string): string {
  return path.join(resolveWorkspaceBase(), taskId);
}

export async function ensureWorkspace(): Promise<string> {
  const base = resolveWorkspaceBase();
  await ensureDir(path.join(base, 'registry'));
  const globalPath = path.join(base, 'registry', 'GLOBAL_REGISTRY.json');
  if (!(await fileExists(globalPath))) {
    const initial: GlobalRegistry = {
      created_at: new Date().toISOString(),
      total_tasks: 0,
      active_tasks: 0,
      total_agents_spawned: 0,
      active_agents: 0,
      max_concurrent_agents: Number(process.env.codex_ORCHESTRATOR_MAX_CONCURRENT ?? '8'),
      tasks: {},
      agents: {},
    };
    await writeJsonFile(globalPath, initial);
  }
  return base;
}

export async function resolveTaskWorkspace(taskId: string): Promise<{ workspace: string; registryPath: string }>{
  const base = resolveWorkspaceBase();
  const workspace = path.join(base, taskId);
  const registryPath = path.join(workspace, 'AGENT_REGISTRY.json');
  if (await fileExists(registryPath)) return { workspace, registryPath };

  const globalPath = path.join(base, 'registry', 'GLOBAL_REGISTRY.json');
  if (await fileExists(globalPath)) {
    const globalReg = await readJsonFile<Record<string, any>>(globalPath, {});
    const entry = globalReg?.tasks?.[taskId];
    if (entry?.workspace) {
      const mapped = path.resolve(expandPath(String(entry.workspace)));
      const rp = path.join(mapped, 'AGENT_REGISTRY.json');
      if (await fileExists(rp)) return { workspace: mapped, registryPath: rp };
    }
  }
  return { workspace, registryPath };
}


