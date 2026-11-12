import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export function audioCommands(audio, platform = process.platform) {
  if (platform === 'win32') return [{
    command: path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-File',
      path.join(root, '../scripts/play-audio.ps1'), '-AudioFile', audio.file, '-Volume', String(audio.volume),
      '-MaxSeconds', String(audio.maxSeconds)]
  }];
  if (platform === 'darwin') return [{ command: '/usr/bin/afplay', args: ['-v', String(audio.volume / 100), audio.file] }];
  if (platform === 'linux') return [
    { command: 'ffplay', args: ['-nodisp', '-autoexit', '-loglevel', 'error', '-volume', String(audio.volume), '-t', String(audio.maxSeconds), '-i', audio.file] },
    ...(path.extname(audio.file).toLowerCase() === '.wav'
      ? [{ command: 'paplay', args: [`--volume=${Math.round(audio.volume / 100 * 65536)}`, audio.file] }] : [])
  ];
  throw new Error(`Custom audio is not supported on ${platform}.`);
}

export class AudioPlayer {
  constructor() { this.active = new Map(); }

  async play(id, audio) {
    this.stop(id);
    if (!audio.file || audio.volume === 0) return { status: 'muted' };
    let error;
    for (const candidate of audioCommands(audio)) {
      try { return await this.launch(id, candidate, audio.maxSeconds); }
      catch (cause) { error = cause; if (cause.code !== 'ENOENT') throw cause; }
    }
    throw new Error(`No audio player available. On Linux install ffplay (FFmpeg), or paplay for WAV. ${error?.message || ''}`);
  }

  launch(id, { command, args }, maxSeconds) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      const job = { child, cancelled: false, timedOut: false };
      this.active.set(id, job);
      let stderr = '';
      child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
      const timer = setTimeout(() => { job.timedOut = true; child.kill(); }, (maxSeconds + (process.platform === 'win32' ? 10 : 0)) * 1000);
      const cleanup = () => { clearTimeout(timer); if (this.active.get(id) === job) this.active.delete(id); };
      child.once('error', cause => { cleanup(); reject(cause); });
      child.once('exit', code => {
        cleanup();
        if (job.cancelled) resolve({ status: 'stopped' });
        else if (job.timedOut && process.platform !== 'win32') resolve({ status: 'played', truncated: true });
        else if (code === 0) resolve({ status: 'played' });
        else reject(new Error(`Audio playback failed (${code}): ${stderr.trim()}`));
      });
    });
  }

  stop(id) { const job = this.active.get(id); if (job) { job.cancelled = true; job.child.kill(); this.active.delete(id); } }
  close() { for (const id of this.active.keys()) this.stop(id); }
}
