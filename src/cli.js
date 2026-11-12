#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ConfigStore, KINDS } from './config.js';
import { AudioPlayer } from './audio.js';
import { createDesktop } from './desktop.js';
import { NotificationManager } from './manager.js';
import { createServer } from './server.js';

try {
  const { values } = parseArgs({ options: { config: { type: 'string' }, check: { type: 'boolean' }, help: { type: 'boolean' } } });
  if (values.help) {
    console.log('mcp-node-notifier [--config /path/config.json] [--check]\nSTDIO MCP server. --check validates configuration/assets without sending notifications.');
  } else {
    const config = new ConfigStore(values.config || process.env.MCP_NOTIFIER_CONFIG);
    await config.read();
    if (values.check) {
      for (const kind of KINDS) await config.profile(kind);
      console.log(JSON.stringify({ valid: true, platform: process.platform, config: config.file, settings: await config.read() }, null, 2));
    } else {
      const manager = new NotificationManager({ config, desktop: createDesktop(), audio: new AudioPlayer() });
      const server = createServer(manager);
      let stopping = false;
      const shutdown = async () => {
        if (stopping) return;
        stopping = true;
        await manager.close();
        await server.close();
      };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
      process.stdin.once('end', shutdown);
      await server.connect(new StdioServerTransport());
      server.onclose = shutdown;
      console.error('mcp-node-notifier ready.');
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
