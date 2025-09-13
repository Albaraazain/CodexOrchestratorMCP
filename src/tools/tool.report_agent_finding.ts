import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import path from 'path';
import { RegisteredTool } from './index.js';
import type { Logger } from '../utils/logger.js';
import { resolveTaskWorkspace } from '../utils/workspace.js';
import { fileExists, readJsonFile } from '../utils/fs.js';
import { getComprehensiveTaskStatus } from './util.comprehensive_status.js';

export const reportAgentFindingSchema = z.object({
  task_id: z.string().min(1),
  agent_id: z.string().min(1),
  finding_type: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  message: z.string().min(1),
  data: z.record(z.any()).optional(),
});

export type ReportAgentFindingInput = z.infer<typeof reportAgentFindingSchema>;

export function reportAgentFindingTool(_logger: Logger): RegisteredTool<ReportAgentFindingInput> {
  return {
    definition: {
      name: 'report_agent_finding',
      description: 'Report a finding/discovery from an agent and return coordination status',
      inputSchema: zodToJsonSchema(reportAgentFindingSchema),
    },
    schema: reportAgentFindingSchema.strict(),
    handler: async (input) => {
      const { workspace, registryPath } = await resolveTaskWorkspace(input.task_id);
      if (!(await fileExists(registryPath))) return [{ type: 'text', text: JSON.stringify({ success: false, error: `Task ${input.task_id} not found` }) }];
      const findingsFile = path.join(workspace, 'findings', `${input.agent_id}_findings.jsonl`);
      const fs = await import('fs');
      await fs.promises.mkdir(path.dirname(findingsFile), { recursive: true });
      const entry = {
        timestamp: new Date().toISOString(),
        agent_id: input.agent_id,
        finding_type: input.finding_type,
        severity: input.severity,
        message: input.message,
        data: input.data ?? {},
      };
      fs.appendFileSync(findingsFile, JSON.stringify(entry) + '\n');

      const coordination = await getComprehensiveTaskStatus(input.task_id);
      const payload = {
        success: true,
        own_finding: {
          agent_id: input.agent_id,
          finding_type: input.finding_type,
          severity: input.severity,
          message: input.message,
          timestamp: entry.timestamp,
          data: input.data ?? {},
        },
        coordination_info: coordination.success ? coordination : null,
      };
      return [{ type: 'text', text: JSON.stringify(payload) }];
    },
  };
}


