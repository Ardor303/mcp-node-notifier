import { randomUUID } from 'node:crypto';
import { KINDS, range, text, profileName } from './config.js';

export class NotificationManager {
  constructor({ config, desktop, audio, clock = globalThis, now = Date.now, log = console.error }) {
    Object.assign(this, { config, desktop, audio, clock, now, log });
    this.entries = new Map();
    this.tasks = new Map();
    this.closed = false;
  }

  async notify(input) {
    if (this.closed) throw new Error('Notification manager is closed.');
    if (input.kind !== undefined && !KINDS.includes(input.kind)) throw new Error('kind must be success, error, waiting or info.');
    if (input.profile !== undefined) profileName(input.profile);
    if (input.kind === undefined && input.profile === undefined) throw new Error('Provide kind or profile.');
    text(input.message, 'message', 2000);
    if (input.title !== undefined) text(input.title, 'title', 160);
    if (input.task_id !== undefined) text(input.task_id, 'task_id', 200);
    if (input.sound !== undefined && typeof input.sound !== 'boolean') throw new Error('sound must be a boolean.');
    if (input.repeat_minutes !== undefined) range(input.repeat_minutes, 'repeat_minutes', 0, 1440);
    if (input.repeat_minutes > 0 && input.repeat_minutes < 0.1) throw new Error('The minimum repeat interval is 0.1 minutes.');
    if (input.repeat_mode !== undefined && !['both', 'sound', 'notification'].includes(input.repeat_mode)) throw new Error('Invalid repeat_mode.');
    const settings = await this.config.profile(input.profile ?? input.kind);
    if (input.kind !== undefined && input.kind !== settings.kind) throw new Error(`Profile ${settings.profile} has kind=${settings.kind}, not ${input.kind}.`);
    input = { ...input, kind: settings.kind, profile: settings.profile };
    if (input.kind === 'waiting' && !input.task_id) throw new Error('waiting requires a stable task_id, unique to the chat/task.');
    if (input.kind !== 'waiting' && input.repeat_minutes > 0) throw new Error('Only waiting notifications can repeat.');
    const minutes = input.kind === 'waiting' ? input.repeat_minutes ?? settings.repeatMinutes : 0;
    const repeatMode = input.repeat_mode ?? settings.repeatMode;
    if (minutes && repeatMode === 'sound' && (!settings.audio.file || settings.audio.volume === 0 || input.sound === false)) {
      throw new Error('Sound-only reminders need a custom audio file, volume > 0 and sound enabled.');
    }
    const previousId = input.task_id && this.tasks.get(input.task_id);
    if (previousId && input.kind !== 'info') this.acknowledge(previousId, 'superseded');
    const entry = {
      id: randomUUID(), input: { ...input }, status: 'active', createdAt: this.now(),
      intervalMs: minutes * 60000, repeatMode, count: 0, lastError: null, timer: null, pending: null
    };
    this.entries.set(entry.id, entry);
    if (input.kind === 'waiting') this.tasks.set(input.task_id, entry.id);
    await this.deliver(entry, false, settings);
    if (entry.status === 'active' && !entry.intervalMs && input.kind !== 'waiting') entry.status = 'sent';
    this.schedule(entry);
    this.prune();
    return this.summary(entry);
  }

  async deliver(entry, repeat, initialSettings) {
    if (entry.status !== 'active') return;
    try {
      const settings = initialSettings || await this.config.profile(entry.input.profile);
      if (entry.status !== 'active') return;
      if (settings.kind !== entry.input.kind) throw new Error('The profile kind changed. Start a new notification to use its new behavior.');
      const show = !repeat || entry.repeatMode !== 'sound';
      const play = entry.input.sound !== false && (!repeat || entry.repeatMode !== 'notification');
      const onError = error => {
        if (entry.status !== 'active' && entry.status !== 'sent') return;
        entry.lastError = error.message;
        this.log(`[${entry.id}] ${error.message}`);
      };
      if (show) await this.desktop.show({
        id: entry.id, title: entry.input.title || settings.title,
        message: settings.template
          ? settings.template.replace(/\{\{message\}\}/g, () => entry.input.message).replace(/\{\{task\}\}/g, () => entry.input.task_id || '')
          : entry.input.message,
        icon: settings.icon, sound: play && !settings.audio.file && settings.audio.volume > 0,
        acknowledge: entry.input.kind === 'waiting', label: settings.acknowledgeLabel
      }, () => this.acknowledge(entry.id), onError);
      if (entry.status !== 'active') return;
      entry.count += 1;
      entry.lastSentAt = this.now();
      if (play && settings.audio.file) {
        entry.pending = this.audio.play(entry.id, settings.audio).catch(onError);
      }
    } catch (error) {
      entry.lastError = error.message;
      this.log(`[${entry.id}] ${error.message}`);
    }
  }

  schedule(entry) {
    if (this.closed || entry.status !== 'active' || !entry.intervalMs) return;
    entry.timer = this.clock.setTimeout(async () => {
      entry.timer = null;
      await this.deliver(entry, true);
      this.schedule(entry);
    }, entry.intervalMs);
  }

  acknowledge(id, reason = 'acknowledged') {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Unknown notification: ${id}`);
    if (entry.status !== 'active' && entry.status !== 'sent') return this.summary(entry);
    entry.status = reason;
    if (entry.timer) this.clock.clearTimeout(entry.timer);
    entry.timer = null;
    this.audio.stop(id);
    this.desktop.dismiss(id);
    if (this.tasks.get(entry.input.task_id) === id) this.tasks.delete(entry.input.task_id);
    this.log(`[${id}] ${reason}`);
    return this.summary(entry);
  }

  summary(entry) {
    return { id: entry.id, task_id: entry.input.task_id ?? null, kind: entry.input.kind, profile: entry.input.profile, status: entry.status,
      repeating: entry.status === 'active' && entry.intervalMs > 0, repeat_minutes: entry.intervalMs / 60000,
      repeat_mode: entry.repeatMode, deliveries: entry.count, last_error: entry.lastError };
  }
  list() { return [...this.entries.values()].map(entry => this.summary(entry)); }
  listProfiles() { return this.config.listProfiles(); }
  prune() {
    for (const [id, entry] of this.entries) {
      if (this.entries.size <= 200) break;
      if (entry.status !== 'active') { this.desktop.dismiss(id); this.entries.delete(id); }
    }
  }
  async close() {
    this.closed = true;
    for (const entry of this.entries.values()) if (entry.status === 'active' || entry.status === 'sent') this.acknowledge(entry.id, 'stopped');
    this.audio.close();
    await this.desktop.close();
  }
}
