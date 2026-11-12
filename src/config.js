import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const KINDS = ['success', 'error', 'waiting', 'info'];
const titles = { success: 'Aufgabe abgeschlossen', error: 'Aufgabe fehlgeschlagen', waiting: 'Antwort benötigt', info: 'Zwischenstand' };
export const DEFAULTS = {
  acknowledgeLabel: "Hab's mitbekommen",
  repeatMinutes: 5,
  repeatMode: 'both',
  audio: { file: null, volume: 70, maxSeconds: 10 },
  profiles: Object.fromEntries(KINDS.map(kind => [kind, { title: titles[kind], icon: null }]))
};

export function range(value, name, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }
  return value;
}

export function text(value, name, max = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || value.includes('\0')) {
    throw new Error(`${name} must be a nonempty string of at most ${max} characters.`);
  }
  return value;
}

export class ConfigStore {
  constructor(file) { this.file = file ? path.resolve(file) : null; }

  async read() {
    const raw = this.file ? JSON.parse(await readFile(this.file, 'utf8')) : {};
    const value = {
      ...DEFAULTS, ...raw,
      audio: { ...DEFAULTS.audio, ...raw.audio },
      profiles: Object.fromEntries(KINDS.map(kind => [kind, { ...DEFAULTS.profiles[kind], ...raw.profiles?.[kind] }]))
    };
    text(value.acknowledgeLabel, 'acknowledgeLabel', 60);
    if (value.acknowledgeLabel.startsWith('-') || /[;=\r\n]/.test(value.acknowledgeLabel)) {
      throw new Error('acknowledgeLabel must not start with - or contain ;, = or newlines.');
    }
    range(value.repeatMinutes, 'repeatMinutes', 0.1, 1440);
    if (!['both', 'sound', 'notification'].includes(value.repeatMode)) throw new Error('Invalid repeatMode.');
    this.validateAudio(value.audio);
    for (const [kind, profile] of Object.entries(value.profiles)) {
      text(profile.title, `profiles.${kind}.title`, 160);
      this.validateAudio({ ...value.audio, ...profile.audio });
    }
    return value;
  }

  validateAudio(audio) {
    range(audio.volume, 'audio.volume', 0, 100);
    range(audio.maxSeconds, 'audio.maxSeconds', 0.1, 60);
    if (audio.file !== null && typeof audio.file !== 'string') throw new Error('audio.file must be a path or null.');
  }

  resolve(file) { return path.resolve(this.file ? path.dirname(this.file) : process.cwd(), file); }

  async profile(kind) {
    const config = await this.read();
    const profile = config.profiles[kind];
    const audio = { ...config.audio, ...profile.audio };
    if (audio.file) {
      audio.file = this.resolve(audio.file);
      if (!['.wav', '.mp3'].includes(path.extname(audio.file).toLowerCase())) throw new Error('Audio must be WAV or MP3.');
      if (!(await stat(audio.file)).isFile()) throw new Error('Audio path is not a file.');
    }
    let icon = profile.icon;
    if (icon) {
      icon = this.resolve(icon);
      const data = await readFile(icon);
      const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      if (data.length < 24 || !data.subarray(0, 8).equals(signature)
        || data.length > 200 * 1024 || data.readUInt32BE(16) > 1024 || data.readUInt32BE(20) > 1024) {
        throw new Error('Icons must be PNG, at most 1024 × 1024 and 200 KiB.');
      }
    }
    let template = null;
    if (profile.messageFile) template = await readFile(this.resolve(profile.messageFile), 'utf8');
    return { ...config, ...profile, icon, audio, template };
  }
}
