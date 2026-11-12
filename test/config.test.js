import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ConfigStore } from '../src/config.js';

test('profile assets resolve relative to config and edits are reloaded', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mcp-notifier-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'config.json');
  await writeFile(path.join(dir, 'tone.mp3'), 'test');
  await writeFile(path.join(dir, 'message.txt'), 'Task {{task}}: {{message}}');
  await writeFile(file, JSON.stringify({ audio: { file: 'tone.mp3', volume: 25 }, profiles: { waiting: { messageFile: 'message.txt' } } }));
  const store = new ConfigStore(file);
  const profile = await store.profile('waiting');
  assert.equal(profile.audio.file, path.join(dir, 'tone.mp3'));
  assert.equal(profile.audio.volume, 25);
  assert.equal(profile.template, 'Task {{task}}: {{message}}');
  await writeFile(file, JSON.stringify({ audio: { volume: 80 } }));
  assert.equal((await store.profile('waiting')).audio.volume, 80);
  await writeFile(file, JSON.stringify({ audio: { volume: 101 } }));
  await assert.rejects(store.read(), /volume/);
});
