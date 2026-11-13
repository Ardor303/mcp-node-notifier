import test from 'node:test';
import assert from 'node:assert/strict';
import { NotificationManager } from '../src/manager.js';

function fixture() {
  const jobs = new Set();
  const shown = [];
  const played = [];
  const stopped = [];
  const config = { profile: async name => ({ profile: name, kind: name, title: 'Title', icon: null, template: null, acknowledgeLabel: 'Seen', repeatMinutes: 5, repeatMode: 'both', audio: { file: '/sound.wav', volume: 50, maxSeconds: 4 } }) };
  const desktop = { show: async (options, ack) => { shown.push({ ...options, ack }); }, dismiss() {}, close: async () => {} };
  const audio = { play: async id => { played.push(id); }, stop: id => stopped.push(id), close() {} };
  const clock = { setTimeout: callback => { const job = { callback }; jobs.add(job); return job; }, clearTimeout: job => jobs.delete(job) };
  const manager = new NotificationManager({ config, desktop, audio, clock, log() {} });
  const tick = async () => { const pending = [...jobs]; jobs.clear(); for (const job of pending) await job.callback(); };
  return { manager, jobs, shown, played, stopped, config, desktop, tick };
}

test('acknowledgement stops exactly one reminder, its audio and future repetitions', async () => {
  const f = fixture();
  const a = await f.manager.notify({ kind: 'waiting', message: 'Question A', task_id: 'chat-a' });
  const b = await f.manager.notify({ kind: 'waiting', message: 'Question B', task_id: 'chat-b' });
  await f.tick();
  assert.equal(f.shown.length, 4);
  f.shown[0].ack();
  assert.equal(f.manager.list().find(n => n.id === a.id).status, 'acknowledged');
  assert.ok(f.stopped.includes(a.id));
  await f.tick();
  assert.equal(f.shown.length, 5);
  assert.equal(f.shown.at(-1).id, b.id);
  f.manager.acknowledge(a.id); // Idempotent.
  assert.equal(f.jobs.size, 1);
  await f.manager.close();
  assert.equal(f.jobs.size, 0);
});

test('new waiting replaces the same task; info preserves it; completion resolves it', async () => {
  const f = fixture();
  const first = await f.manager.notify({ kind: 'waiting', message: 'One', task_id: 'task' });
  const second = await f.manager.notify({ kind: 'waiting', message: 'Two', task_id: 'task' });
  assert.equal(f.manager.list().find(n => n.id === first.id).status, 'superseded');
  assert.equal(f.jobs.size, 1);
  await f.manager.notify({ kind: 'info', message: 'Milestone', task_id: 'task' });
  assert.equal(f.manager.list().find(n => n.id === second.id).status, 'active');
  await f.manager.notify({ kind: 'success', message: 'Done', task_id: 'task' });
  assert.equal(f.jobs.size, 0);
  assert.equal(f.manager.list().find(n => n.id === second.id).status, 'superseded');
});

test('sound-only reminders retain the original button without making more toasts', async () => {
  const f = fixture();
  await f.manager.notify({ kind: 'waiting', message: 'Question', task_id: 'task', repeat_mode: 'sound' });
  await f.tick();
  assert.equal(f.shown.length, 1);
  assert.equal(f.played.length, 2);
  f.shown[0].ack();
  await f.tick();
  assert.equal(f.played.length, 2);
});

test('silent requests never play custom or native sound', async () => {
  const f = fixture();
  await f.manager.notify({ kind: 'waiting', message: 'Question', task_id: 'task', sound: false });
  await f.tick();
  assert.equal(f.played.length, 0);
  assert.ok(f.shown.every(n => n.sound === false));
});

test('acknowledging during an asynchronous repeat does not play audio or rearm the timer', async () => {
  const f = fixture();
  const reminder = await f.manager.notify({ kind: 'waiting', message: 'Question', task_id: 'task' });
  let resume;
  f.config.profile = () => new Promise(resolve => { resume = resolve; });
  const ticking = f.tick();
  f.manager.acknowledge(reminder.id);
  resume({});
  await ticking;
  assert.equal(f.jobs.size, 0);
  assert.equal(f.played.length, 1);
});

test('delivery errors stay visible and can be acknowledged', async () => {
  const f = fixture();
  f.desktop.show = async () => { throw new Error('Desktop unavailable'); };
  const result = await f.manager.notify({ kind: 'waiting', message: 'Question', task_id: 'task' });
  assert.equal(result.last_error, 'Desktop unavailable');
  assert.equal(result.deliveries, 0);
  assert.equal(f.jobs.size, 1);
  f.manager.acknowledge(result.id);
  assert.equal(f.jobs.size, 0);
});

test('invalid intervals and missing task identity never start a timer', async () => {
  const f = fixture();
  for (const input of [
    { kind: 'waiting', message: 'Question' },
    { kind: 'waiting', message: 'Question', task_id: 'x', repeat_minutes: 0.001 },
    { kind: 'success', message: 'Done', repeat_minutes: 1 },
    { kind: 'waiting', message: 'Question', task_id: 'x', sound: false, repeat_mode: 'sound' }
  ]) await assert.rejects(f.manager.notify(input));
  assert.equal(f.jobs.size, 0);
});

test('custom profiles retain waiting behavior and custom completion resolves the same task', async () => {
  const f = fixture();
  const base = f.config.profile;
  const requests = [];
  f.config.profile = async name => {
    requests.push(name);
    const kind = name === 'customNotify' ? 'waiting' : 'success';
    return { ...await base(kind), profile: name, title: name };
  };
  await assert.rejects(f.manager.notify({ profile: 'customNotify', message: 'Question' }), /task_id/);
  const waiting = await f.manager.notify({ profile: 'customNotify', task_id: 'task', message: 'Question' });
  assert.equal(waiting.kind, 'waiting');
  assert.equal(waiting.profile, 'customNotify');
  assert.equal(f.shown[0].title, 'customNotify');
  assert.equal(f.shown[0].acknowledge, true);
  await f.tick();
  assert.equal(requests.at(-1), 'customNotify');
  assert.equal(f.shown.length, 2);
  await assert.rejects(f.manager.notify({ kind: 'success', profile: 'customNotify', task_id: 'task', message: 'Mismatch' }), /has kind=waiting/);
  assert.equal(f.manager.list()[0].status, 'active');
  assert.equal(f.jobs.size, 1);
  const done = await f.manager.notify({ profile: 'customDone', task_id: 'task', message: 'Done' });
  assert.equal(done.kind, 'success');
  assert.equal(f.manager.list()[0].status, 'superseded');
  assert.equal(f.jobs.size, 0);
  await f.manager.close();
});

test('changing a profile kind cannot silently change an active reminder', async () => {
  const f = fixture();
  const base = await f.config.profile('waiting');
  f.config.profile = async () => ({ ...base, profile: 'customNotify' });
  const result = await f.manager.notify({ profile: 'customNotify', task_id: 'task', message: 'Question' });
  f.config.profile = async () => ({ ...base, profile: 'customNotify', kind: 'info' });
  await f.tick();
  assert.equal(f.shown.length, 1);
  assert.equal(f.played.length, 1);
  assert.match(f.manager.list()[0].last_error, /profile kind changed/);
  f.manager.acknowledge(result.id);
  assert.equal(f.jobs.size, 0);
});
