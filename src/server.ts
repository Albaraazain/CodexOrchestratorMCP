import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { ListToolsResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { getToolRegistry } from './tools/index.js';
import { listResources, readResource } from './utils/resources.js';
import { createLogger } from './utils/logger.js';

export interface StartOptions {
  debug?: boolean;
}

export async function startServer(options: StartOptions = {}): Promise<void> {
  const logger = createLogger(options.debug ?? false);

  const server = new Server(
    {
      name: 'codex Orchestrator',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  const registry = getToolRegistry(logger);

  // tools/list handler
  server.setRequestHandler(ListToolsRequestSchema, async (): Promise<ListToolsResult> => {
    const tools: Tool[] = registry.tools.map((t) => ({
      name: t.definition.name,
      description: t.definition.description,
      inputSchema: t.definition.inputSchema as any,
    }));
    return { tools };
  });

  // tools/call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const tool = registry.byName.get(request.params.name);
      if (!tool) {
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${(request as any).params.name}`,
            },
          ],
          isError: true,
        } as const;
      }

      const validatedInput = tool.schema.parse(request.params.arguments ?? {});
      const content = await tool.handler(validatedInput);
      return { content } as const;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('tools/call failed', { name: request.params?.name, error: message });
      return {
        content: [
          {
            type: 'text',
            text: `Tool execution failed: ${message}`,
          },
        ],
        isError: true,
      } as const;
    }
  });

  // resources/list handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      return await listResources();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('resources/list failed', { error: message });
      return { resources: [] };
    }
  });

  // resources/read handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      return await readResource(request.params.uri);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('resources/read failed', { uri: request.params.uri, error: message });
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'application/json',
            text: JSON.stringify({ success: false, error: message }, null, 2),
          },
        ],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('codex Orchestrator MCP server started on stdio');
}


