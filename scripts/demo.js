import { parseArgs } from 'node:util';
import { ConfigStore } from '../src/config.js';
import { AudioPlayer } from '../src/audio.js';
import { createDesktop } from '../src/desktop.js';
import { NotificationManager } from '../src/manager.js';

const { values } = parseArgs({ options: { config: { type: 'string' }, silent: { type: 'boolean' }, 'center-test': { type: 'boolean' }, debug: { type: 'boolean' }, 'max-minutes': { type: 'string' } } });
const maxMinutes = Number(values['max-minutes'] ?? (values['center-test'] ? 3 : 2));
if (!Number.isFinite(maxMinutes) || maxMinutes < 1 || maxMinutes > 15) throw new Error('--max-minutes must be between 1 and 15.');
if (values.debug) process.env.MCP_NOTIFIER_DEBUG = '1';
const manager = new NotificationManager({
  config: new ConfigStore(values.config || process.env.MCP_NOTIFIER_CONFIG),
  desktop: createDesktop(), audio: new AudioPlayer()
});
const result = await manager.notify({
  kind: 'waiting', task_id: 'interactive-demo',
  title: 'MCP Node Notifier – Klicktest',
  message: values['center-test']
    ? 'Bitte nach dem Ausblenden im Benachrichtigungscenter auf "Hab\'s mitbekommen" klicken.'
    : 'Bitte "Hab\'s mitbekommen" anklicken. Bis dahin erinnert dieser Test alle 15 Sekunden.',
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
