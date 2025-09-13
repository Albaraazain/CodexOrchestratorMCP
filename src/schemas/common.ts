import { z } from 'zod';

export const taskIdSchema = z.string().min(1, 'task_id is required');
export const agentIdSchema = z.string().min(1, 'agent_id is required');
export const prioritySchema = z.enum(['P1', 'P2', 'P3', 'P4']).default('P2');


