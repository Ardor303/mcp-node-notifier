import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runDemo } from '../scripts/demo.js';

async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mcp-notifier-demo-'));
  assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'config.json');
  const icon = fileURLToPath(new URL('../assets/icons/waiting.png', import.meta.url));
  await writeFile(path.join(dir, 'tone.wav'), 'test');
  await writeFile(path.join(dir, 'message.txt'), '{{task}}: {{message}}');
  await writeFile(file, JSON.stringify({
    acknowledgeLabel: 'Seen',
    profiles: {
      waiting: { title: 'Base question', icon },
      customNotify: {
        kind: 'waiting', title: 'My question', messageFile: 'message.txt',
        audio: { file: 'tone.wav', volume: 35, maxSeconds: 12 }
      },
      customDone: { kind: 'success', title: 'My result', audio: { file: 'tone.wav', maxSeconds: 12 } }
    }
  }));
  const shown = [], played = [], output = [], jobs = new Set();
  let time = 0, desktopClosed = false, audioClosed = false, markReady;
  const ready = new Promise(resolve => { markReady = resolve; });
  const schedule = (callback, ms, interval = false) => {
    const job = { callback, due: time + ms, interval: interval ? ms : 0 };
    jobs.add(job);
    return job;
  };
  const clock = {
    setTimeout: (callback, ms) => schedule(callback, ms),
    clearTimeout: job => jobs.delete(job),
    setInterval: (callback, ms) => { const job = schedule(callback, ms, true); markReady(); return job; },
    clearInterval: job => jobs.delete(job)
  };
  const desktop = {
    show: async (options, ack) => { shown.push({ ...options, ack }); },
    dismiss() {}, close: async () => { desktopClosed = true; }
  };
  const audio = {
    play: async (id, options) => { played.push({ id, ...options }); },
    stop() {}, close: () => { audioClosed = true; }
  };
  return {
    file, icon, shown, played, output, jobs, desktop, ready,
    run: (...args) => runDemo(['--config', file, ...args], {
      desktop, audio, clock, now: () => time,
      log: line => output.push(JSON.parse(line)), errorLog() {}
    }),
    tick: async ms => {
      time += ms;
      for (const job of [...jobs]) {
        if (!jobs.has(job) || job.due > time) continue;
        if (job.interval) job.due = time + job.interval;
        else jobs.delete(job);
        await job.callback();
      }
    },
    assertClosed: () => {
      assert.equal(jobs.size, 0);
      assert.equal(desktopClosed, true);
      assert.equal(audioClosed, true);
    }
  };
}

test('demo selects a custom waiting profile, preserves assets and stops on acknowledgement', async t => {
  const f = await fixture(t);
  const running = f.run('--profile', 'customNotify', '--lang', 'de');
  await f.ready;
  assert.equal(f.shown[0].title, 'My question');
  assert.equal(f.shown[0].icon, f.icon);
  assert.equal(f.shown[0].acknowledge, true);
  assert.match(f.shown[0].message, /^interactive-demo: Bitte/);
  assert.equal(f.played[0].file, path.join(path.dirname(f.file), 'tone.wav'));
  assert.equal(f.played[0].volume, 35);
  assert.equal(f.played[0].maxSeconds, 12);
  assert.equal(f.output[0].profile, 'customNotify');
  await f.tick(15000);
  assert.equal(f.shown.length, 2);
  assert.equal(f.shown[1].title, 'My question');
  f.shown[1].ack();
  await f.tick(250);
  assert.equal(await running, 0);
  assert.equal(f.output.at(-1).acknowledgementReceived, true);
  f.assertClosed();
});

test('one-shot profile demo needs no acknowledgement and leaves time for audio', async t => {
  const f = await fixture(t);
  const running = f.run('--profile', 'customDone');
  await f.ready;
  assert.equal(f.shown[0].title, 'My result');
  assert.equal(f.shown[0].acknowledge, false);
  assert.match(f.shown[0].message, /Test notification/);
  assert.equal(f.output[0].kind, 'success');
  assert.equal(f.output[0].repeating, false);
  await f.tick(10000);
  assert.equal(f.output.length, 1);
  await f.tick(12000);
  assert.equal(await running, 0);
  assert.equal(f.shown.length, 1);
  f.assertClosed();
});

test('default click demo stays localized and reports an unacknowledged timeout', async t => {
  const f = await fixture(t);
  const running = f.run('--lang', 'de', '--silent', '--max-minutes', '1');
  await f.ready;
  assert.equal(f.shown[0].title, 'MCP Node Notifier – Klicktest');
  assert.equal(f.shown[0].sound, false);
  await f.tick(60000);
  assert.equal(await running, 1);
  assert.equal(f.played.length, 0);
  assert.equal(f.output.at(-1).acknowledgementReceived, false);
  f.assertClosed();
});

test('invalid profile selections fail before delivery and delivery failures clean up', async t => {
  const f = await fixture(t);
  await assert.rejects(f.run('--profile', 'missing'), /Unknown notification profile/);
  await assert.rejects(f.run('--profile', 'customDone', '--center-test'), /requires a profile with kind=waiting/);
  assert.equal(f.shown.length, 0);
  f.desktop.show = async () => { throw new Error('Desktop unavailable'); };
  assert.equal(await f.run('--profile', 'customNotify'), 1);
  assert.equal(f.output[0].last_error, 'Desktop unavailable');
  f.assertClosed();
});

test('demo CLI accepts --profile and reports unknown names without a notification', () => {
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('../scripts/demo.js', import.meta.url)), '--profile', 'missing'
  ], { encoding: 'utf8', windowsHide: true, env: { ...process.env, MCP_NOTIFIER_CONFIG: '' } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown notification profile/);
});
