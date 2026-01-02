import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

type GuildSettings = Record<string, any>;

async function ensureDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

export async function loadAll(): Promise<Record<string, GuildSettings>> {
  try {
    await ensureDir();
    const raw = await fs.readFile(SETTINGS_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    return {};
  }
}

export async function getSetting(guildId: string, key: string, def?: any) {
  const all = await loadAll();
  const g = all[guildId] || {};
  return g.hasOwnProperty(key) ? g[key] : def;
}

export async function setSetting(guildId: string, key: string, value: any) {
  const all = await loadAll();
  all[guildId] = all[guildId] || {};
  all[guildId][key] = value;
  await ensureDir();
  // atomic write
  const tmp = SETTINGS_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(all, null, 2), 'utf8');
  await fs.rename(tmp, SETTINGS_FILE);
}

export async function deleteGuild(guildId: string) {
  const all = await loadAll();
  delete all[guildId];
  const tmp = SETTINGS_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(all, null, 2), 'utf8');
  await fs.rename(tmp, SETTINGS_FILE);
}

export default { loadAll, getSetting, setSetting, deleteGuild };
