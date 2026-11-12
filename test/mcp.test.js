import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('real STDIO handshake lists tools and rejects invalid requests without a notification', async t => {
  const client = new Client({ name: 'notifier-test', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../src/cli.js', import.meta.url))], stderr: 'pipe', env: {} });
  t.after(() => client.close());
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name), ['notify', 'acknowledge_notification', 'list_notifications']);
  const invalid = await client.callTool({ name: 'notify', arguments: { kind: 'waiting', message: 'Question' } });
  assert.equal(invalid.isError, true);
  const listing = await client.callTool({ name: 'list_notifications', arguments: {} });
  assert.deepEqual(JSON.parse(listing.content[0].text).notifications, []);
});
