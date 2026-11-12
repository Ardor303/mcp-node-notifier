import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { parseWindowsEvent, isAcknowledgement, isWindowsDeliveryFailure, StandardDesktop, LinuxDesktop } from '../src/desktop.js';
import { audioCommands } from '../src/audio.js';

test('Windows UTF-16 callbacks preserve Unicode button labels and notification IDs', () => {
  const label = 'Habe ich gehört';
  const event = parseWindowsEvent(Buffer.from(`notificationId=123;action=buttonClicked;button=${label}\0`, 'utf16le'));
  assert.equal(event.notificationId, '123');
  assert.equal(isAcknowledgement(event, label), true);
});

test('dismiss, timeout and body click are not acknowledgement', () => {
  for (const action of ['closed', 'timeout', 'contentsClicked', 'dismissed']) {
    assert.equal(isAcknowledgement({ activationType: action }, 'Seen'), false);
  }
  assert.equal(isAcknowledgement({ activationType: 'actionClicked', activationValue: 'Seen' }, 'Seen'), true);
});

test('Windows native event-wait timeout is not reported as a delivery failure', () => {
  assert.equal(isWindowsDeliveryFailure(4294967295, 100), true);
  assert.equal(isWindowsDeliveryFailure(-1, 60005), false);
  assert.equal(isWindowsDeliveryFailure(3, 10000), false);
});

test('macOS receives only its supported flags and reports the action label', async () => {
  let received;
  let ack = false;
  const desktop = new StandardDesktop('darwin', () => ({
    notify(options, callback) {
      received = options;
      callback(null, 'actionclicked', { activationType: 'actionClicked', activationValue: 'Seen' });
    }
  }));
  await desktop.show({ id: 'test', title: 'Hello', message: 'World', sound: false, acknowledge: true, label: 'Seen' },
    () => { ack = true; }, error => { throw error; });
  assert.equal(ack, true);
  assert.equal(received.timeout, false);
  assert.equal('app-name' in received, false);
  assert.equal('hint' in received, false);
  await desktop.close();
});

test('Linux keeps action listening alive and stops old helper groups on replacement and shutdown', async () => {
  const children = [];
  const killed = [];
  let acknowledged = 0;
  const desktop = new LinuxDesktop({
    launch() {
      const child = new EventEmitter();
      child.pid = 100 + children.length;
      child.stderr = new EventEmitter();
      child.send = options => { child.options = options; };
      children.push(child);
      return child;
    },
    kill(pid) { killed.push(pid); }
  });
  const options = { id: 'one', title: 'Hello', message: 'Question', acknowledge: true, label: 'Seen' };
  await desktop.show(options, () => acknowledged++, error => { throw error; });
  assert.equal(children[0].options.timeout, 0);
  await desktop.show(options, () => acknowledged++, error => { throw error; });
  children[0].emit('message', { metadata: { activationType: 'actionClicked', activationValue: 'Seen' } });
  assert.equal(acknowledged, 0);
  children[1].emit('message', { metadata: { activationType: 'actionClicked', activationValue: 'Seen' } });
  assert.equal(acknowledged, 1);
  await desktop.close();
  assert.deepEqual(killed, [-100, -101]);
});

test('audio paths are individual arguments, and volume is scaled per platform', () => {
  const audio = { file: '/tmp/a "quote" ; $(test).mp3', volume: 35, maxSeconds: 6 };
  assert.ok(audioCommands(audio, 'win32')[0].args.includes(audio.file));
  assert.deepEqual(audioCommands(audio, 'darwin')[0].args, ['-v', '0.35', audio.file]);
  assert.ok(audioCommands(audio, 'linux')[0].args.includes('35'));
  assert.equal(audioCommands(audio, 'linux').length, 1);
  assert.equal(audioCommands({ ...audio, file: '/tmp/tone.wav' }, 'linux').length, 2);
});
