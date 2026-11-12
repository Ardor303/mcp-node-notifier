import { parseArgs } from 'node:util';
import { ConfigStore } from '../src/config.js';
import { AudioPlayer } from '../src/audio.js';
import { createDesktop } from '../src/desktop.js';
import { NotificationManager } from '../src/manager.js';

const { values } = parseArgs({ options: { config: { type: 'string' }, lang: { type: 'string', default: 'en' }, silent: { type: 'boolean' }, 'center-test': { type: 'boolean' }, debug: { type: 'boolean' }, 'max-minutes': { type: 'string' } } });
if (!['en', 'de'].includes(values.lang)) throw new Error('--lang must be en or de.');
const maxMinutes = Number(values['max-minutes'] ?? (values['center-test'] ? 3 : 2));
if (!Number.isFinite(maxMinutes) || maxMinutes < 1 || maxMinutes > 15) throw new Error('--max-minutes must be between 1 and 15.');
if (values.debug) process.env.MCP_NOTIFIER_DEBUG = '1';
const config = new ConfigStore(values.config || process.env.MCP_NOTIFIER_CONFIG);
const { acknowledgeLabel } = await config.read();
const german = values.lang === 'de';
const manager = new NotificationManager({
  config,
  desktop: createDesktop(), audio: new AudioPlayer()
});
const result = await manager.notify({
  kind: 'waiting', task_id: 'interactive-demo',
  title: german ? 'MCP Node Notifier – Klicktest' : 'MCP Node Notifier – click test',
  message: values['center-test']
    ? (german
      ? `Bitte nach dem Ausblenden im Benachrichtigungscenter auf „${acknowledgeLabel}“ klicken.`
      : `After the banner disappears, open Notification Center and click “${acknowledgeLabel}”.`)
    : (german
      ? `Bitte „${acknowledgeLabel}“ anklicken. Bis dahin erinnert dieser Test alle 15 Sekunden.`
      : `Click “${acknowledgeLabel}”. Until then, this test repeats every 15 seconds.`),
  sound: !values.silent, repeat_minutes: values['center-test'] ? 2 : 0.25
});
console.log(JSON.stringify(result));
const deadline = Date.now() + maxMinutes * 60000;
await new Promise(resolve => {
  const timer = setInterval(() => {
    const current = manager.list().find(item => item.id === result.id);
    if (current?.status === 'acknowledged' || Date.now() >= deadline) {
      clearInterval(timer);
      console.log(JSON.stringify({ acknowledgementReceived: current?.status === 'acknowledged', notification: current }));
      if (current?.status !== 'acknowledged') process.exitCode = 1;
      resolve();
    }
  }, 250);
});
await manager.close();
