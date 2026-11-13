import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const KINDS = ['success', 'error', 'waiting', 'info'];
const titles = { success: 'Task completed', error: 'Task failed', waiting: 'Your input is needed', info: 'Progress update' };
export const DEFAULTS = {
  acknowledgeLabel: 'Got it',
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

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object.`);
  return value;
}

export function profileName(value) {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)) {
    throw new Error('Profile names must start with a letter and contain at most 64 letters, digits, underscores or hyphens.');
  }
  return value;
}

export class ConfigStore {
  constructor(file) { this.file = file ? path.resolve(file) : null; }

  async read() {
    const raw = object(this.file ? JSON.parse(await readFile(this.file, 'utf8')) : {}, 'Configuration');
    const configured = object(raw.profiles ?? {}, 'profiles');
    if (raw.audio !== undefined) object(raw.audio, 'audio');
    for (const [name, profile] of Object.entries(configured)) {
      profileName(name);
      object(profile, `profiles.${name}`);
      if (profile.audio !== undefined) object(profile.audio, `profiles.${name}.audio`);
      if (KINDS.includes(name)) {
        if (profile.kind !== undefined && profile.kind !== name) throw new Error(`Built-in profile ${name} must keep kind=${name}.`);
      } else if (!KINDS.includes(profile.kind)) {
        throw new Error(`profiles.${name}.kind must be success, error, waiting or info.`);
      }
    }
    const profiles = Object.fromEntries(KINDS.map(kind => [kind, {
      ...DEFAULTS.profiles[kind], ...configured[kind], kind
    }]));
    for (const [name, profile] of Object.entries(configured)) {
      if (KINDS.includes(name)) continue;
      const base = profiles[profile.kind];
      profiles[name] = { ...base, ...profile, audio: { ...base.audio, ...profile.audio } };
    }
    const value = {
      ...DEFAULTS, ...raw,
      audio: { ...DEFAULTS.audio, ...raw.audio },
      profiles
    };
    text(value.acknowledgeLabel, 'acknowledgeLabel', 60);
    if (value.acknowledgeLabel.startsWith('-') || /[;=\r\n]/.test(value.acknowledgeLabel)) {
      throw new Error('acknowledgeLabel must not start with - or contain ;, = or newlines.');
    }
    range(value.repeatMinutes, 'repeatMinutes', 0.1, 1440);
    if (!['both', 'sound', 'notification'].includes(value.repeatMode)) throw new Error('Invalid repeatMode.');
    this.validateAudio(value.audio);
    for (const [name, profile] of Object.entries(value.profiles)) {
      text(profile.title, `profiles.${name}.title`, 160);
      if (profile.description !== undefined) text(profile.description, `profiles.${name}.description`, 1000);
      for (const key of ['icon', 'messageFile']) {
        if (profile[key] != null && typeof profile[key] !== 'string') throw new Error(`profiles.${name}.${key} must be a path or null.`);
      }
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

  async listProfiles() {
    const config = await this.read();
    return Object.entries(config.profiles).map(([name, profile]) => ({
      name, kind: profile.kind, title: profile.title, description: profile.description ?? null
    }));
  }

  async profile(name) {
    profileName(name);
    const config = await this.read();
    if (!Object.hasOwn(config.profiles, name)) throw new Error(`Unknown notification profile: ${name}. Use list_notification_profiles to discover available profiles.`);
    const profile = config.profiles[name];
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
    return { ...config, profile: name, kind: profile.kind, title: profile.title, icon, audio, template };
  }
}
