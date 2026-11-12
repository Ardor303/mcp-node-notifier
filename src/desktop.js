import { NotificationCenter, NotifySend } from 'node-notifier';
import { createRequire } from 'node:module';
import path from 'node:path';
import net from 'node:net';
import { spawn, fork } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';

export function parseWindowsEvent(buffer) {
  const text = buffer.toString('utf16le').replace(/\0+$/, '');
  return Object.fromEntries(text.split(';').flatMap(part => {
    const index = part.indexOf('=');
    return index < 0 ? [] : [[part.slice(0, index), part.slice(index + 1)]];
  }));
}

export function isAcknowledgement(metadata, label) {
  return metadata?.activationType === label
    || metadata?.activationType === 'actionClicked' && metadata?.activationValue === label
    || metadata?.action === 'buttonClicked' && metadata?.button === label;
}

// SnoreToast also returns -1 when its own 60-second event wait expires. That
// does not mean delivery failed; the persistent pipe still accepts later clicks.
export function isWindowsDeliveryFailure(code, elapsedMs) {
  return (code === -1 || code === 4294967295) && elapsedMs < 59000;
}

// node-notifier closes its Windows callback pipe when the banner times out.
// Keep our own pipe open so clicks in Notification Center can still acknowledge
// reminders. The native backend itself comes from the node-notifier dependency.
class WindowsDesktop {
  constructor() {
    const require = createRequire(import.meta.url);
    const packageRoot = path.dirname(require.resolve('node-notifier/package.json'));
    this.binary = path.join(packageRoot, 'vendor/snoreToast', `snoretoast-x${process.arch === 'ia32' ? '86' : '64'}.exe`);
    this.pipe = `\\\\.\\pipe\\mcp-node-notifier-${randomUUID()}`;
    this.entries = new Map();
    this.children = new Set();
    this.sockets = new Set();
    this.ready = null;
  }

  start() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      this.server = net.createServer(socket => {
        this.sockets.add(socket);
        const chunks = [];
        let size = 0;
        socket.on('data', chunk => { size += chunk.length; if (size > 16384) socket.destroy(); else chunks.push(chunk); });
        socket.on('error', () => {});
        socket.on('close', () => this.sockets.delete(socket));
        socket.on('end', () => {
          if (size > 16384) return;
          const event = parseWindowsEvent(Buffer.concat(chunks));
          if (process.env.MCP_NOTIFIER_DEBUG === '1') console.error('[toast event]', JSON.stringify(event));
          const nativeId = String(event.notificationId ?? event.id ?? '');
          for (const entry of this.entries.values()) {
            if (String(entry.nativeId) === nativeId && isAcknowledgement(event, entry.label)) entry.onAck();
          }
        });
      });
      this.server.once('error', reject);
      this.server.listen(this.pipe, resolve);
    });
    return this.ready;
  }

  async show(options, onAck, onError) {
    await this.start();
    const entry = this.entries.get(options.id) || { nativeId: randomInt(1, 2147483647) };
    Object.assign(entry, { onAck, label: options.label });
    this.entries.set(options.id, entry);
    const args = ['-t', options.title, '-m', options.message, '-id', String(entry.nativeId), '-pipeName', this.pipe, '-d', 'long'];
    if (options.acknowledge) args.push('-b', options.label);
    if (options.icon) args.push('-p', options.icon);
    args.push(...(options.sound ? ['-s', 'Notification.Default'] : ['-silent']));
    await new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const child = spawn(this.binary, args, { windowsHide: true, stdio: 'ignore' });
      this.children.add(child);
      child.once('spawn', resolve);
      child.once('error', error => { this.children.delete(child); onError(error); reject(error); });
      child.once('exit', code => {
        this.children.delete(child);
        if (process.env.MCP_NOTIFIER_DEBUG === '1') console.error('[toast exit]', code, Date.now() - startedAt);
        if (isWindowsDeliveryFailure(code, Date.now() - startedAt)) onError(new Error('Windows rejected the toast notification.'));
      });
    });
  }

  dismiss(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.entries.delete(id);
    const child = spawn(this.binary, ['-close', String(entry.nativeId)], { windowsHide: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
  }

  async close() {
    for (const id of this.entries.keys()) this.dismiss(id);
    for (const child of this.children) child.kill();
    for (const socket of this.sockets) socket.destroy();
    if (this.server?.listening) await new Promise(resolve => this.server.close(resolve));
  }
}

export class LinuxDesktop {
  constructor({ launch = fork, kill = process.kill.bind(process) } = {}) {
    this.launch = launch;
    this.kill = kill;
    this.children = new Map();
  }
  async show(options, onAck, onError) {
    this.dismiss(options.id);
    const child = this.launch(new URL('./linux-worker.js', import.meta.url), [], {
      detached: true, stdio: ['ignore', 'ignore', 'pipe', 'ipc']
    });
    this.children.set(options.id, child);
    let stderr = '';
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-2000); });
    child.on('message', result => {
      if (this.children.get(options.id) !== child) return;
      if (result.error) onError(new Error(result.error));
      else if (isAcknowledgement(result.metadata, options.label)) onAck();
    });
    child.once('error', onError);
    child.once('exit', code => {
      if (this.children.get(options.id) !== child) return;
      this.children.delete(options.id);
      if (code) onError(new Error(`Linux notification helper exited (${code}): ${stderr.trim()}`));
    });
    child.send({
      title: options.title, message: options.message,
      ...(options.icon ? { icon: options.icon } : {}),
      ...(options.acknowledge ? { actions: [options.label] } : {}),
      'app-name': 'MCP Node Notifier', timeout: options.acknowledge ? 0 : 10,
      hint: options.sound ? 'string:sound-name:dialog-information' : 'boolean:suppress-sound:true'
    }, error => { if (error && this.children.get(options.id) === child) onError(error); });
  }
  dismiss(id) {
    const child = this.children.get(id);
    if (!child) return;
    this.children.delete(id);
    if (child.pid) {
      try { this.kill(-child.pid, 'SIGTERM'); }
      catch (error) { if (error.code !== 'ESRCH') child.kill(); }
    }
  }
  async close() { for (const id of this.children.keys()) this.dismiss(id); }
}

export class StandardDesktop {
  constructor(platform, factory) {
    this.platform = platform;
    this.factory = factory || (() => platform === 'darwin' ? new NotificationCenter({ withFallback: false }) : new NotifySend());
    this.instances = new Map();
  }
  async show(options, onAck, onError) {
    this.dismiss(options.id);
    const notifier = this.factory();
    this.instances.set(options.id, notifier);
    notifier.notify({
      title: options.title, message: options.message,
      ...(options.acknowledge ? { actions: [options.label] } : {}),
      ...(this.platform === 'darwin'
        ? { sound: options.sound, group: options.id, timeout: options.acknowledge ? false : 10 }
        : { ...(options.icon ? { icon: options.icon } : {}), 'app-name': 'MCP Node Notifier', timeout: 10,
            hint: options.sound ? 'string:sound-name:dialog-information' : 'boolean:suppress-sound:true' })
    }, (error, response, metadata) => {
      if (error) onError(error);
      else if (isAcknowledgement(metadata, options.label) || isAcknowledgement(response, options.label)) onAck();
    });
  }
  dismiss(id) { this.instances.get(id)?.clearAll?.(); this.instances.delete(id); }
  async close() { for (const id of this.instances.keys()) this.dismiss(id); }
}

export function createDesktop(platform = process.platform) {
  if (platform === 'win32') return new WindowsDesktop();
  if (platform === 'linux') return new LinuxDesktop();
  if (platform === 'darwin') return new StandardDesktop(platform);
  throw new Error(`Unsupported platform: ${platform}`);
}
