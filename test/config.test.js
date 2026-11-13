import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ConfigStore } from '../src/config.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

test('custom profiles inherit global and configured kind defaults, and discovery reloads changes', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mcp-notifier-profiles-'));
  assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'config.json');
  await writeFile(path.join(dir, 'base.wav'), 'test');
  await writeFile(path.join(dir, 'custom.mp3'), 'test');
  await writeFile(path.join(dir, 'waiting.txt'), '{{task}}: {{message}}');
  const raw = {
    audio: { volume: 25, maxSeconds: 4 },
    profiles: {
      waiting: { title: 'Base question', audio: { file: 'base.wav', volume: 40 }, messageFile: 'waiting.txt' },
      customNotify: { kind: 'waiting', title: 'Custom question', description: 'Questions during a build', audio: { file: 'custom.mp3' } }
    }
  };
  await writeFile(file, JSON.stringify(raw));
  const store = new ConfigStore(file);
  const custom = await store.profile('customNotify');
  assert.equal(custom.kind, 'waiting');
  assert.equal(custom.profile, 'customNotify');
  assert.equal(custom.title, 'Custom question');
  assert.equal(custom.template, '{{task}}: {{message}}');
  assert.deepEqual(custom.audio, { file: path.join(dir, 'custom.mp3'), volume: 40, maxSeconds: 4 });
  assert.equal((await store.profile('waiting')).audio.file, path.join(dir, 'base.wav'));
  assert.deepEqual((await store.listProfiles()).find(p => p.name === 'customNotify'), {
    name: 'customNotify', kind: 'waiting', title: 'Custom question', description: 'Questions during a build'
  });
  raw.profiles.waiting.audio.volume = 55;
  await writeFile(file, JSON.stringify(raw));
  assert.equal((await store.profile('customNotify')).audio.volume, 55);
  raw.profiles.customNotify.audio = { file: null, volume: 0 };
  await writeFile(file, JSON.stringify(raw));
  assert.deepEqual((await store.profile('customNotify')).audio, { file: null, volume: 0, maxSeconds: 4 });
  delete raw.profiles.customNotify;
  await writeFile(file, JSON.stringify(raw));
  assert.equal((await store.listProfiles()).length, 4);
  await assert.rejects(store.profile('customNotify'), /Unknown notification profile/);
  await assert.rejects(store.profile('toString'), /Unknown notification profile/);
});

test('invalid custom definitions fail clearly and --check also validates custom assets', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mcp-notifier-invalid-profile-'));
  assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'config.json');
  const store = new ConfigStore(file);
  for (const [profiles, expected] of [
    [{ customNotify: { title: 'No kind' } }, /kind must be/],
    [{ customNotify: { kind: 'custom' } }, /kind must be/],
    [{ waiting: { kind: 'success' } }, /must keep kind/],
    [{ 'bad name': { kind: 'info' } }, /Profile names/],
    [{ customNotify: { kind: 'waiting', audio: null } }, /must be an object/]
  ]) {
    await writeFile(file, JSON.stringify({ profiles }));
    await assert.rejects(store.read(), expected);
  }
  await writeFile(file, JSON.stringify({ profiles: { customNotify: { kind: 'waiting', audio: { file: 'missing.mp3' } } } }));
  const checked = spawnSync(process.execPath, [fileURLToPath(new URL('../src/cli.js', import.meta.url)), '--config', file, '--check'], { encoding: 'utf8', windowsHide: true });
  assert.equal(checked.status, 1);
  assert.match(checked.stderr, /missing.mp3/);
});
