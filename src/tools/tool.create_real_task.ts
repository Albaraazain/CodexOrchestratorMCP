import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import path from 'path';
import { ensureDir, readJsonFile, writeJsonFile } from '../utils/fs.js';
import { ensureWorkspace, resolveWorkspaceBase } from '../utils/workspace.js';
import { getEnv } from '../types/env.js';
import { RegisteredTool } from './index.js';
import type { Logger } from '../utils/logger.js';
import { expandPath } from '../utils/pathutil.js';

export const createRealTaskSchema = z.object({
  description: z.string().min(1),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']).default('P2'),
  workspace_base: z.string().optional(),
  caller_cwd: z.string().optional(),
});

export type CreateRealTaskInput = z.infer<typeof createRealTaskSchema>;

export function createRealTaskTool(logger: Logger): RegisteredTool<CreateRealTaskInput> {
  return {
    definition: {
      name: 'create_real_task',
      description: 'Create a real orchestration task with proper workspace',
      inputSchema: zodToJsonSchema(createRealTaskSchema),
    },
    schema: createRealTaskSchema.strict(),
    handler: async (input) => {
      const env = getEnv();
      await ensureWorkspace();

      const rawCaller = input.caller_cwd ?? env.codex_CALLER_CWD ?? process.cwd();
      const callerDir = path.resolve(expandPath(rawCaller));
      const requestedBase = input.workspace_base ? path.resolve(expandPath(input.workspace_base)) : undefined;
      // Treat '.' or callerDir (or empty) as "use default" to avoid creating TASK-* at project root
      const base = !requestedBase || requestedBase === '.' || requestedBase === callerDir
        ? path.join(callerDir, '.agent-workspace')
        : requestedBase;

      const taskId = `TASK-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 15)}-${Math.random().toString(16).slice(2, 10)}`;
      const workspace = path.join(base, taskId);

      await ensureDir(path.join(workspace, 'progress'));
      await ensureDir(path.join(workspace, 'logs'));
      await ensureDir(path.join(workspace, 'findings'));
      await ensureDir(path.join(workspace, 'output'));
      const contextDir = path.join(workspace, 'context');
      await ensureDir(contextDir);

      const taskGuidance = `TASK GUIDANCE\n\nWorkspace: ${workspace}\nCaller CWD: ${callerDir}\n\nWhen creating orchestrator tasks from this project, pass:\n- workspace_base=\"${callerDir}/.agent-workspace\"\n- caller_cwd=\"${callerDir}\"\n\nAgents should:\n- Use regular providers in use cases (no realtime)\n- Keep filters stable (never create maps in build)\n- Use generated providers directly; compose, don’t wrap\n- Treat MFC and Velocity Profile as separate methods\n\nSupabase MCP: project_id=xvhvkekbwesdaotcuwyh\nClaude headless model: claude-sonnet-4-20250514\n`;

      await writeJsonFile(path.join(workspace, 'AGENT_REGISTRY.json'), {
        task_id: taskId,
        task_description: input.description,
        created_at: new Date().toISOString(),
        workspace,
        workspace_base: base,
        caller_cwd: callerDir,
        guidance: taskGuidance,
        status: 'INITIALIZED',
        priority: input.priority,
        agents: [],
        agent_hierarchy: { orchestrator: [] },
        max_agents: Number(process.env.codex_ORCHESTRATOR_MAX_AGENTS ?? '25'),
        max_depth: Number(process.env.codex_ORCHESTRATOR_MAX_DEPTH ?? '5'),
        max_concurrent: Number(process.env.codex_ORCHESTRATOR_MAX_CONCURRENT ?? '8'),
        total_spawned: 0,
        active_count: 0,
        completed_count: 0,
        orchestration_guidance: {
          min_specialization_depth: 2,
          recommended_child_agents_per_parent: 3,
          specialization_domains: [],
          complexity_score: calculateTaskComplexity(input.description),
        },
        spiral_checks: {
          enabled: true,
          last_check: new Date().toISOString(),
          violations: 0,
        },
      });

      // Write guidance file for agents to read
      const guidancePath = path.join(contextDir, 'TASK_GUIDANCE.md');
      const fs = await import('fs');
      await fs.promises.writeFile(guidancePath, taskGuidance, 'utf-8');

      const globalPath = path.join(resolveWorkspaceBase(), 'registry', 'GLOBAL_REGISTRY.json');
      const globalReg = await readJsonFile<Record<string, any>>(globalPath, {
        created_at: new Date().toISOString(),
        total_tasks: 0,
        active_tasks: 0,
        total_agents_spawned: 0,
        active_agents: 0,
        max_concurrent_agents: Number(process.env.codex_ORCHESTRATOR_MAX_CONCURRENT ?? '8'),
        tasks: {},
        agents: {},
      });
      globalReg.tasks = globalReg.tasks || {};
      globalReg.total_tasks = (globalReg.total_tasks || 0) + 1;
      globalReg.active_tasks = (globalReg.active_tasks || 0) + 1;
      globalReg.tasks[taskId] = {
        description: input.description,
        created_at: new Date().toISOString(),
        status: 'INITIALIZED',
        workspace,
        workspace_base: base,
        caller_cwd: callerDir,
        guidance: taskGuidance,
      };
      await writeJsonFile(globalPath, globalReg);

      const response = {
        success: true,
        task_id: taskId,
        description: input.description,
        priority: input.priority,
        workspace,
        status: 'INITIALIZED',
      };

      return [
        {
          type: 'text',
          text: JSON.stringify(response),
        },
      ];
    },
  };
}

function calculateTaskComplexity(description: string): number {
  const complexityKeywords: Record<string, number> = {
    comprehensive: 5,
    complete: 4,
    full: 4,
    entire: 4,
    system: 3,
    platform: 3,
    application: 3,
    website: 2,
    frontend: 2,
    backend: 2,
    database: 2,
    api: 2,
    testing: 2,
    security: 2,
    performance: 2,
    optimization: 2,
    deployment: 2,
    'ci/cd': 2,
    monitoring: 2,
    analytics: 2,
    authentication: 2,
    authorization: 2,
    integration: 2,
  };
  let score = 1;
  const lower = description.toLowerCase();
  for (const [k, v] of Object.entries(complexityKeywords)) {
    if (lower.includes(k)) score += v;
  }
  if (description.length > 200) score += 2;
  if (lower.includes('layers') || lower.includes('multi')) score += 3;
  if (lower.includes('specialist') || lower.includes('expert')) score += 2;
  return Math.min(score, 20);
}


