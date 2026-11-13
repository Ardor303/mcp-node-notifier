import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigStore } from '../src/config.js';
import { AudioPlayer } from '../src/audio.js';
import { createDesktop } from '../src/desktop.js';
import { NotificationManager } from '../src/manager.js';

export async function runDemo(args, adapters = {}) {
  const { values } = parseArgs({ args, options: {
    config: { type: 'string' }, profile: { type: 'string' },
    lang: { type: 'string', default: 'en' }, silent: { type: 'boolean' },
    'center-test': { type: 'boolean' }, debug: { type: 'boolean' }, 'max-minutes': { type: 'string' }
  } });
  if (!['en', 'de'].includes(values.lang)) throw new Error('--lang must be en or de.');
  const maxMinutes = Number(values['max-minutes'] ?? (values['center-test'] ? 3 : 2));
  if (!Number.isFinite(maxMinutes) || maxMinutes < 1 || maxMinutes > 15) throw new Error('--max-minutes must be between 1 and 15.');
  if (values.debug) process.env.MCP_NOTIFIER_DEBUG = '1';
  const config = new ConfigStore(values.config || process.env.MCP_NOTIFIER_CONFIG);
  const settings = await config.profile(values.profile ?? 'waiting');
  const waiting = settings.kind === 'waiting';
  if (values['center-test'] && !waiting) throw new Error('--center-test requires a profile with kind=waiting.');
  const { acknowledgeLabel } = settings;
  const german = values.lang === 'de';
  const clock = adapters.clock ?? globalThis;
  const now = adapters.now ?? Date.now;
  const log = adapters.log ?? console.log;
  const manager = new NotificationManager({
    config, clock, now, log: adapters.errorLog ?? console.error,
    desktop: adapters.desktop ?? createDesktop(), audio: adapters.audio ?? new AudioPlayer()
  });
  try {
    const result = await manager.notify({
      profile: settings.profile, task_id: 'interactive-demo',
      // Explicit profile tests use the configured title, including inherited titles.
      ...(values.profile === undefined
        ? { title: german ? 'MCP Node Notifier – Klicktest' : 'MCP Node Notifier – click test' }
        : {}),
      message: !waiting
        ? (german ? `Testmeldung für das Profil „${settings.profile}“.` : `Test notification for profile “${settings.profile}”.`)
        : values['center-test']
          ? (german
            ? `Bitte nach dem Ausblenden im Benachrichtigungscenter auf „${acknowledgeLabel}“ klicken.`
            : `After the banner disappears, open Notification Center and click “${acknowledgeLabel}”.`)
          : (german
            ? `Bitte „${acknowledgeLabel}“ anklicken. Bis dahin erinnert dieser Test alle 15 Sekunden.`
            : `Click “${acknowledgeLabel}”. Until then, this test repeats every 15 seconds.`),
      sound: !values.silent, repeat_minutes: waiting ? (values['center-test'] ? 2 : 0.25) : 0
    });
    log(JSON.stringify(result));
    if (result.last_error || result.deliveries === 0) return 1;
    const startedAt = now();
    const deadline = startedAt + maxMinutes * 60000;
    // Keep one-shot tests alive for the banner and custom audio (including player startup).
    const previewMs = Math.max(10000, !values.silent && settings.audio.file && settings.audio.volume > 0
      ? (settings.audio.maxSeconds + 10) * 1000 : 0);
    return await new Promise(resolve => {
      const timer = clock.setInterval(() => {
        const current = manager.list().find(item => item.id === result.id);
        const acknowledged = current?.status === 'acknowledged';
        if (current?.last_error || acknowledged || now() >= deadline || (!waiting && now() >= startedAt + previewMs)) {
          clock.clearInterval(timer);
          log(JSON.stringify({ acknowledgementReceived: acknowledged, notification: current }));
          resolve(current?.last_error || (waiting && !acknowledged) ? 1 : 0);
        }
      }, 250);
    });
  } finally {
    await manager.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await runDemo(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
