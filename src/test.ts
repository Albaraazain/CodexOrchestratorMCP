// Manual test harness for tools
import { getToolRegistry } from './tools/index.js';
import { createLogger } from './utils/logger.js';

async function main() {
  const logger = createLogger(true);
  const registry = getToolRegistry(logger);

  const call = async (name: string, args: any) => {
    const tool = registry.byName.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    const validated = tool.schema.parse(args);
    const res = await tool.handler(validated);
    console.log(`\n== ${name} ==\n`, res[0]?.text);
  };

  await call('create_real_task', { description: 'Test task from TS harness', priority: 'P2' });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


