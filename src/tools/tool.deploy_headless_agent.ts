import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import path from 'path';
import { RegisteredTool } from './index.js';
import type { Logger } from '../utils/logger.js';
import { resolveTaskWorkspace } from '../utils/workspace.js';
import { fileExists, readJsonFile, writeJsonFile } from '../utils/fs.js';
import { checkTmuxAvailable, createTmuxSession } from '../utils/tmux.js';
import { getAppendPromptSnippet } from '../utils/prompt.js';
import { getEnv } from '../types/env.js';

export const deployHeadlessAgentSchema = z.object({
  task_id: z.string().min(1),
  agent_type: z.string().min(1),
  prompt: z.string().min(1),
  parent: z.string().default('orchestrator'),
});

export type DeployHeadlessAgentInput = z.infer<typeof deployHeadlessAgentSchema>;

export function deployHeadlessAgentTool(logger: Logger): RegisteredTool<DeployHeadlessAgentInput> {
  return {
    definition: {
      name: 'deploy_headless_agent',
      description: 'Deploy a headless codex agent using tmux for background execution',
      inputSchema: zodToJsonSchema(deployHeadlessAgentSchema),
    },
    schema: deployHeadlessAgentSchema.strict(),
    handler: async (input) => {
      if (!(await checkTmuxAvailable())) {
        return [{ type: 'text', text: JSON.stringify({ success: false, error: 'tmux is not available - required for background execution' }) }];
      }
      const { workspace, registryPath } = await resolveTaskWorkspace(input.task_id);
      if (!(await fileExists(registryPath))) return [{ type: 'text', text: JSON.stringify({ success: false, error: `Task ${input.task_id} not found` }) }];
      const registry = await readJsonFile<any>(registryPath, {});

      const active = Number(registry.active_count || 0);
      const maxConcurrent = Number(registry.max_concurrent ?? process.env.codex_ORCHESTRATOR_MAX_CONCURRENT ?? '8');
      if (active >= maxConcurrent) {
        return [{ type: 'text', text: JSON.stringify({ success: false, error: `Too many active agents (${active}/${maxConcurrent})` }) }];
      }
      const totalSpawned = Number(registry.total_spawned || 0);
      const maxAgents = Number(registry.max_agents ?? process.env.codex_ORCHESTRATOR_MAX_AGENTS ?? '25');
      if (totalSpawned >= maxAgents) {
        return [{ type: 'text', text: JSON.stringify({ success: false, error: `Max agents reached (${totalSpawned}/${maxAgents})` }) }];
      }

      const agentId = `${input.agent_type}-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(8, 14)}-${Math.random().toString(16).slice(2, 8)}`;
      const sessionName = `agent_${agentId}`;

      let depth = input.parent === 'orchestrator' ? 1 : 2;
      for (const a of registry.agents || []) {
        if (a.id === input.parent) {
          depth = Number(a.depth || 1) + 1;
          break;
        }
      }

      const taskDescription = String(registry.task_description ?? '');
      const maxDepth = Number(registry.max_depth ?? process.env.codex_ORCHESTRATOR_MAX_DEPTH ?? '5');
      const orchestrationPrompt = createOrchestrationGuidancePrompt(input.agent_type, taskDescription, depth, maxDepth);

      let agentPrompt = `You are a headless codex agent in an orchestrator system.\n\nAGENT IDENTITY:\n- Agent ID: ${agentId}\n- Agent Type: ${input.agent_type}\n- Task ID: ${input.task_id}\n- Parent Agent: ${input.parent}\n- Depth Level: ${depth}\n- Workspace: ${workspace}\n\nMISSION:\n${input.prompt}\n\n${orchestrationPrompt}\n`;
      const taskGuidance: string | undefined = registry.guidance;
      if (taskGuidance) agentPrompt += `\n\nーーー\nTASK GUIDANCE (Auto-Included)\n\n${taskGuidance}`;
      const alwaysEnabled = String(process.env.codex_ORCHESTRATOR_ALWAYS_WORKS_ENABLED ?? '1').toLowerCase() in { '1': 1, true: 1, yes: 1, on: 1 };
      if (alwaysEnabled) {
        try {
          const appendSnippet = await getAppendPromptSnippet();
          if (appendSnippet) agentPrompt += `\n\nーーー\nALWAYS WORKS STANDARD (Auto-Appended)\n\n${appendSnippet}`;
        } catch {}
      }

      // Explicit logging instructions so agents persist progress/findings even without MCP tool access
      const progressFilePath = path.join(workspace, 'progress', `${agentId}_progress.jsonl`);
      const findingsFilePath = path.join(workspace, 'findings', `${agentId}_findings.jsonl`);
      agentPrompt += `\n\nーーー\nPROGRESS & FINDINGS LOGGING (Required)\n\nWrite concise JSONL entries regularly so orchestration can track you.\n\n- Progress file: ${progressFilePath}\n- Findings file: ${findingsFilePath}\n\nProgress entry (example):\n{"timestamp":"$(date -Iseconds)","agent_id":"${agentId}","status":"working","message":"<what you are doing>","progress":10}\nShell command:\nexport _now=\"$(date -Iseconds)\"; echo '{"timestamp":"'"'"${_now}"'"'","agent_id":"${agentId}","status":"working","message":"<what you are doing>","progress":10}' >> "${progressFilePath}"\n\nFinding entry (example):\n{"timestamp":"$(date -Iseconds)","agent_id":"${agentId}","finding_type":"<type>","severity":"low|medium|high|critical","message":"<summary>","data":{}}\nShell command:\nexport _now=\"$(date -Iseconds)\"; echo '{"timestamp":"'"'"${_now}"'"'","agent_id":"${agentId}","finding_type":"<type>","severity":"low","message":"<summary>","data":{}}' >> "${findingsFilePath}"`;

      const promptFile = path.join(workspace, `agent_prompt_${agentId}.txt`);
      const fs = await import('fs');
      await fs.promises.mkdir(workspace, { recursive: true });
      await fs.promises.writeFile(promptFile, agentPrompt, 'utf-8');

      const callingProjectDir = registry.caller_cwd || process.cwd();
      const env = getEnv();
      const codexExecutable = env.codex_EXECUTABLE || 'codex';
      const codexFlags = env.codex_FLAGS || '--full-auto';
      const keepAliveSecs = Number(env.codex_ORCHESTRATOR_AGENT_KEEPALIVE_SECS ?? '120');
      // Wrap in a login shell so PATH and subshell $(cat ...) expand correctly, and keep the session alive briefly for inspection
      const inner = `${codexExecutable} exec -C "${callingProjectDir}" ${codexFlags} "$(cat '${promptFile}')"; sleep ${keepAliveSecs}`;
      const codexCommand = `bash -lc ${JSON.stringify(inner)}`;

      const tmux = await createTmuxSession(sessionName, codexCommand, callingProjectDir);
      if (!tmux.success) {
        return [{ type: 'text', text: JSON.stringify({ success: false, error: tmux.error || 'Failed to create tmux session' }) }];
      }

      const agentEntry = {
        id: agentId,
        type: input.agent_type,
        parent: input.parent,
        depth,
        status: 'running',
        started_at: new Date().toISOString(),
        progress: 0,
        tmux_session: sessionName,
      };
      registry.agents = registry.agents || [];
      registry.agents.push(agentEntry);
      registry.total_spawned = Number(registry.total_spawned || 0) + 1;
      registry.active_count = Number(registry.active_count || 0) + 1;
      await writeJsonFile(registryPath, registry);

      const payload = {
        success: true,
        agent_id: agentId,
        tmux_session: sessionName,
        type: input.agent_type,
        parent: input.parent,
        task_id: input.task_id,
        status: 'deployed',
        workspace,
        deployment_method: 'tmux session',
      };
      return [{ type: 'text', text: JSON.stringify(payload) }];
    },
  };
}

function createOrchestrationGuidancePrompt(agentType: string, taskDescription: string, currentDepth: number, maxDepth: number): string {
  const complexity = calculateTaskComplexity(taskDescription);
  const recommendations = generateSpecializationRecommendations(taskDescription, currentDepth + 1);
  if (currentDepth >= maxDepth - 1) return '\n⚠️  DEPTH LIMIT REACHED - Focus on implementation rather than spawning children.';
  let intensity = 'may consider';
  let childCount = '1-2 child agents';
  if (complexity >= 15) { intensity = 'STRONGLY ENCOURAGED'; childCount = '3-4 child agents'; }
  else if (complexity >= 10) { intensity = 'ENCOURAGED'; childCount = '2-3 child agents'; }
  const bullet = recommendations.slice(0, 6).map((a) => `• ${a}`).join('\n');
  return `\n\n🎯 ORCHESTRATION GUIDANCE (Depth ${currentDepth}/${maxDepth}, Complexity: ${complexity}/20):\n\nYou are ${intensity} to spawn specialized child agents for better implementation quality.\n\nRECOMMENDED CHILD SPECIALISTS:\n${bullet}\n\n🚀 ORCHESTRATION STRATEGY:\n1. ANALYZE if your task benefits from specialization\n2. SPAWN ${childCount} with focused, specific roles\n3. COORDINATE their work efficiently\n4. Each child should handle a distinct domain\n\n💡 NAMING CONVENTION: Use clear, descriptive names:\n   - 'css_responsive_specialist' not just 'css'\n   - 'api_authentication_handler' not just 'auth'\n   - 'database_optimization_expert' not just 'db'\n\n⭐ SUCCESS CRITERIA: Balance specialization with efficiency:\n   - Spawn specialists only when beneficial\n   - Coordinate effectively without micro-management\n   - Deliver comprehensive, integrated results`;
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

function generateSpecializationRecommendations(taskDescription: string, currentDepth: number): string[] {
  const lower = taskDescription.toLowerCase();
  const domainPatterns: Record<string, string[]> = {
    frontend: ['frontend', 'ui', 'ux', 'react', 'vue', 'angular', 'css', 'javascript', 'html'],
    backend: ['backend', 'api', 'server', 'database', 'sql', 'node', 'python', 'java'],
    design: ['design', 'ui/ux', 'visual', 'branding', 'typography', 'layout', 'user experience'],
    data: ['data', 'analytics', 'metrics', 'tracking', 'database', 'sql', 'mongodb'],
    security: ['security', 'auth', 'authentication', 'authorization', 'encryption', 'ssl'],
    performance: ['performance', 'optimization', 'speed', 'caching', 'load', 'scalability'],
    testing: ['testing', 'qa', 'test', 'validation', 'e2e', 'unit test', 'integration'],
    devops: ['deployment', 'ci/cd', 'docker', 'kubernetes', 'infrastructure', 'monitoring'],
    mobile: ['mobile', 'ios', 'android', 'react native', 'flutter', 'responsive'],
    ai_ml: ['ai', 'ml', 'machine learning', 'recommendation', 'algorithm', 'intelligence'],
  };
  const recs = new Set<string>();
  for (const [domain, keywords] of Object.entries(domainPatterns)) {
    if (keywords.some((k) => lower.includes(k))) {
      if (currentDepth === 1) recs.add(`${domain}_lead`);
      else if (currentDepth === 2) {
        if (domain === 'frontend') ['css_specialist', 'js_specialist', 'component_specialist', 'animation_specialist'].forEach((x) => recs.add(x));
        else if (domain === 'backend') ['api_specialist', 'database_specialist', 'auth_specialist', 'integration_specialist'].forEach((x) => recs.add(x));
        else if (domain === 'design') ['visual_designer', 'ux_researcher', 'interaction_designer', 'brand_specialist'].forEach((x) => recs.add(x));
        else if (domain === 'data') ['data_engineer', 'analytics_specialist', 'visualization_expert', 'etl_specialist'].forEach((x) => recs.add(x));
      } else if (currentDepth >= 3) {
        ['optimizer', 'validator', 'implementer', 'tester'].forEach((suffix) => recs.add(`${domain}_${suffix}`));
      }
    }
  }
  if (currentDepth <= 2) ['architect', 'quality_assurance', 'documentation_specialist'].forEach((x) => recs.add(x));
  return Array.from(recs);
}


