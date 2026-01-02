import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'playlists.json');

async function ensureDir() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch {}
}

type Track = { title?: string; url: string };
type UserPlaylists = Record<string, Track[]>;

async function loadAll(): Promise<Record<string, UserPlaylists>> {
  try {
    await ensureDir();
    const raw = await fs.readFile(FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

async function saveAll(data: Record<string, UserPlaylists>) {
  await ensureDir();
  const tmp = FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, FILE);
}

export async function listPlaylists(userId: string) {
  const all = await loadAll();
  const user = all[userId] || {};
  return Object.keys(user);
}

export async function getPlaylist(userId: string, name: string) {
  const all = await loadAll();
  const user = all[userId] || {};
  return user[name] ?? null;
}

export async function createPlaylist(userId: string, name: string) {
  const all = await loadAll();
  all[userId] = all[userId] || {};
  if (all[userId][name]) return false;
  all[userId][name] = [];
  await saveAll(all);
  return true;
}

export async function deletePlaylist(userId: string, name: string) {
  const all = await loadAll();
  if (!all[userId] || !all[userId][name]) return false;
  delete all[userId][name];
  await saveAll(all);
  return true;
}

export async function addTrack(userId: string, name: string, track: Track) {
  const all = await loadAll();
  all[userId] = all[userId] || {};
  all[userId][name] = all[userId][name] || [];
  all[userId][name].push(track);
  await saveAll(all);
  return true;
}

export async function removeTrack(userId: string, name: string, index: number) {
  const all = await loadAll();
  const list = all[userId]?.[name];
  if (!list || index < 0 || index >= list.length) return false;
  list.splice(index, 1);
  await saveAll(all);
  return true;
}

export default { listPlaylists, getPlaylist, createPlaylist, deletePlaylist, addTrack, removeTrack };
