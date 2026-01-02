import { joinVoiceChannel, createAudioPlayer, AudioPlayerStatus, NoSubscriberBehavior, VoiceConnectionStatus, createAudioResource, StreamType } from '@discordjs/voice';
import type { VoiceConnection, AudioPlayer, AudioResource } from '@discordjs/voice';
import type { VoiceChannel } from 'discord.js';
import ytdl from 'ytdl-core';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import storage from './storage';

type GuildId = string;

class GuildPlayback {
  connection: any = null;
  // current active player
  currentPlayer: any = null;
  // previous player (used during crossfade)
  previousPlayer: any = null;
  // resources for players so we can adjust volumes
  currentResource: any = null;
  previousResource: any = null;
  volume = 1.0; // 0.0 - 2.0
  queue: string[] = [];
  crossfadeSeconds = 1.5;
  // Audio tuning
  eqPreset: string = 'flat';
  // track metadata for seeking
  currentUrl: string | null = null;
  currentStartOffset = 0; // seconds
  currentStartedAt = 0; // timestamp ms
  // DJ role id
  djRoleId: string | null = null;
  // radios: name -> { description?, url?, enabled }
  radios: Record<string, { description?: string; url?: string; enabled?: boolean }> = {};
  // default radio for guild or channel-specific defaults
  defaultRadio: string | null = null;
  channelDefaults: Record<string, string> = {};
}

export class AudioManager {
  private static instance: AudioManager;
  private guilds: Map<GuildId, GuildPlayback> = new Map();

  static getInstance() {
    if (!AudioManager.instance) AudioManager.instance = new AudioManager();
    return AudioManager.instance;
  }

  ensureGuild(guildId: string) {
    if (!this.guilds.has(guildId)) this.guilds.set(guildId, new GuildPlayback());
    return this.guilds.get(guildId)!;
  }

  // Connect to a voice channel and prepare players
  connectTo(channel: any) {
    const guildId = channel.guild.id;
    const gp = this.ensureGuild(guildId);
    if (!gp.connection) {
      gp.connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guildId,
        adapterCreator: channel.guild.voiceAdapterCreator
      } as any);

      gp.connection.on(VoiceConnectionStatus.Disconnected, () => {
        // clean up if disconnected
      });
    }
    return gp;
  }

  setVolume(guildId: string, volume: number) {
    const gp = this.ensureGuild(guildId);
    gp.volume = Math.max(0, Math.min(2, volume));
    if (gp.currentResource && gp.currentResource.volume) gp.currentResource.volume.setVolume(gp.volume);
  }

  setEqPreset(guildId: string, preset: string) {
    const gp = this.ensureGuild(guildId);
    gp.eqPreset = preset;
    // persist the chosen preset
    storage.setSetting(guildId, 'eqPreset', preset).catch(err => console.error('Failed to save EQ preset', err));
  }

  getEqPreset(guildId: string) {
    const gp = this.ensureGuild(guildId);
    return gp.eqPreset || 'flat';
  }

  // Load persisted settings for guilds
  async init() {
    try {
      const all = await storage.loadAll();
      for (const [guildId, settings] of Object.entries(all)) {
        const gp = this.ensureGuild(guildId);
        if (settings && typeof settings.eqPreset === 'string') gp.eqPreset = settings.eqPreset;
        if (settings && typeof settings.djRoleId === 'string') gp.djRoleId = settings.djRoleId;
        if (settings && settings.radios && typeof settings.radios === 'object') gp.radios = settings.radios;
        if (settings && typeof settings.defaultRadio === 'string') gp.defaultRadio = settings.defaultRadio;
        if (settings && settings.channelDefaults && typeof settings.channelDefaults === 'object') gp.channelDefaults = settings.channelDefaults;
      }
      // Note: defaults merge for existing guilds happens here; full merge for all guilds
      // is performed by `loadDefaultsForGuilds` which should be called after the client is ready.
    } catch (err) {
      console.error('AudioManager init failed:', err);
    }
  }

  // Merge configured default radios into the given guild IDs (call after client ready)
  async loadDefaultsForGuilds(guildIds: string[]) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cfg = require('../../config/radios.json');
      const defaults = cfg?.defaultRadios ?? {};
      for (const guildId of guildIds) {
        const gp = this.ensureGuild(guildId);
        for (const [name, def] of Object.entries(defaults)) {
          if (!gp.radios[name]) {
            gp.radios[name] = { description: (def as any).description, url: (def as any).url, enabled: true };
          }
        }
        // persist radios for guild if new defaults were added
        storage.setSetting(guildId, 'radios', gp.radios).catch(() => {});
      }
    } catch (err) {
      // ignore if config missing
    }
  }

  // DJ role APIs
  setDjRole(guildId: string, roleId: string | null) {
    const gp = this.ensureGuild(guildId);
    gp.djRoleId = roleId;
    storage.setSetting(guildId, 'djRoleId', roleId).catch(err => console.error('Failed to save DJ role', err));
  }

  getDjRole(guildId: string) {
    const gp = this.ensureGuild(guildId);
    return gp.djRoleId;
  }

  // Radio management
  createRadio(guildId: string, name: string, opts: { description?: string; url?: string }) {
    const gp = this.ensureGuild(guildId);
    if (gp.radios[name]) return false;
    gp.radios[name] = { description: opts.description, url: opts.url, enabled: true };
    storage.setSetting(guildId, 'radios', gp.radios).catch(err => console.error('Failed to save radios', err));
    return true;
  }

  deleteRadio(guildId: string, name: string) {
    const gp = this.ensureGuild(guildId);
    if (!gp.radios[name]) return false;
    delete gp.radios[name];
    storage.setSetting(guildId, 'radios', gp.radios).catch(err => console.error('Failed to save radios', err));
    return true;
  }

  listRadios(guildId: string) {
    const gp = this.ensureGuild(guildId);
    return gp.radios;
  }

  setRadioEnabled(guildId: string, name: string, enabled: boolean) {
    const gp = this.ensureGuild(guildId);
    if (!gp.radios[name]) return false;
    gp.radios[name].enabled = enabled;
    storage.setSetting(guildId, 'radios', gp.radios).catch(err => console.error('Failed to save radios', err));
    return true;
  }

  setDefaultRadio(guildId: string, name: string | null) {
    const gp = this.ensureGuild(guildId);
    gp.defaultRadio = name;
    storage.setSetting(guildId, 'defaultRadio', name).catch(err => console.error('Failed to save default radio', err));
  }

  setChannelDefault(guildId: string, channelId: string, name: string | null) {
    const gp = this.ensureGuild(guildId);
    if (!name) delete gp.channelDefaults[channelId]; else gp.channelDefaults[channelId] = name;
    storage.setSetting(guildId, 'channelDefaults', gp.channelDefaults).catch(err => console.error('Failed to save channel defaults', err));
  }

  getDefaultRadio(guildId: string) {
    const gp = this.ensureGuild(guildId);
    return gp.defaultRadio;
  }

  getChannelDefault(guildId: string, channelId: string) {
    const gp = this.ensureGuild(guildId);
    return gp.channelDefaults[channelId] ?? null;
  }

  // build ffmpeg filter string from preset name
  private _buildFilter(preset: string) {
    // basic presets mapping to ffmpeg -af filters
    const presets: Record<string, string> = {
      // flat: gentle loudness normalization
      flat: 'dynaudnorm=g=11',
      // bass: low-frequency boost then normalize
      bass: 'equalizer=f=60:width_type=o:width=2:g=6,dynaudnorm=g=11',
      // vocal: mid-range clarity
      vocal: 'equalizer=f=1000:width_type=o:width=2:g=3,dynaudnorm=g=11',
      // night: compressed for late-night listening
      night: 'acompressor=threshold=-12dB:ratio=4:attack=5:release=250,dynaudnorm=g=8',
      // studio: mild multi-band shaping
      studio: 'equalizer=f=100:width_type=o:width=2:g=2,equalizer=f=1000:width_type=o:width=2:g=1,dynaudnorm=g=11',
      // loud: stronger loudness + limiter
      loud: 'dynaudnorm=g=12,alimiter=limit=0.98',
      // focus: reduced highs, slightly bright mids for focus
      focus: 'equalizer=f=3000:width_type=o:width=2:g=-2,equalizer=f=800:width_type=o:width=2:g=2,dynaudnorm=g=10'
    };
    return presets[preset] ?? presets['flat'];
  }

  // Add a URL to the queue and ensure playback
  async play(channel: any, url: string) {
    const guildId = channel.guild.id;
    const gp = this.connectTo(channel);
    gp.queue.push(url);
    // start playback if nothing is playing
    if (!gp.currentPlayer) {
      await this._startNext(guildId);
    }
    return { queued: true, position: gp.queue.length };
  }

  // Skip current track
  async skip(guildId: string) {
    const gp = this.ensureGuild(guildId);
    if (gp.currentPlayer) {
      gp.currentPlayer.stop(true);
      return true;
    }
    return false;
  }

  private async _startNext(guildId: string) {
    const gp = this.ensureGuild(guildId);
    const nextUrl = gp.queue.shift();
    if (!nextUrl) {
      // nothing to play
      return;
    }

    // create stream from ytdl and pipe through ffmpeg with filters (loudness normalization + EQ)
    const startSeconds = 0;
    const ytdlStream = ytdl(nextUrl, { filter: 'audioonly', highWaterMark: 1 << 25, quality: 'highestaudio', begin: `${startSeconds}s` });
    const filter = this._buildFilter(gp.eqPreset);
    const args = [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-vn',
      '-af', filter,
      '-ar', '48000',
      '-ac', '2',
      '-f', 's16le',
      'pipe:1'
    ];
    console.log(`Starting playback for ${nextUrl} using ffmpeg at ${ffmpegPath || 'ffmpeg'}`);
    const ff = spawn(ffmpegPath || 'ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    ytdlStream.pipe(ff.stdin);

    // attach error listeners so we can fallback if ffmpeg fails
    ytdlStream.on('error', (err: any) => {
      console.error('ytdl stream error for', nextUrl, err);
    });
    ff.on('error', (err: any) => {
      console.error('ffmpeg spawn error', err);
    });
    ff.stderr.on('data', (b: Buffer) => {
      const s = b.toString();
      // only log non-empty messages
      if (s.trim()) console.error('ffmpeg:', s.trim());
    });
    ff.on('close', (code) => {
      if (code && code !== 0) console.warn(`ffmpeg exited with code ${code} for ${nextUrl}`);
    });

    // create resource from ffmpeg stdout; if that fails, fallback to ytdl stream directly
    let resource;
    try {
      resource = createAudioResource(ff.stdout, { inputType: StreamType.Raw, inlineVolume: true });
    } catch (err) {
      console.error('Failed to create resource from ffmpeg stdout, falling back to ytdl stream', err);
      try {
        resource = createAudioResource(ytdlStream, { inputType: StreamType.Arbitrary, inlineVolume: true });
      } catch (err2) {
        console.error('Fallback createAudioResource from ytdl also failed', err2);
        throw err2;
      }
    }
    // set desired starting volume
    if (resource.volume) resource.volume.setVolume(gp.volume);

    // prepare new player
    const newPlayer = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });

    // move current -> previous for crossfade if exists
    if (gp.currentPlayer && gp.currentResource) {
      gp.previousPlayer = gp.currentPlayer;
      gp.previousResource = gp.currentResource;
    }

    gp.currentPlayer = newPlayer;
    gp.currentResource = resource;
    gp.currentUrl = nextUrl;
    gp.currentStartOffset = 0;
    gp.currentStartedAt = Date.now();

    // subscribe player
    if (gp.connection) gp.connection.subscribe(newPlayer);

    newPlayer.play(resource);

    // If we have a previous resource, perform crossfade
    if (gp.previousResource && gp.previousPlayer) {
      await this._crossfade(gp);
      // after crossfade, stop previous player
      try { gp.previousPlayer.stop(true); } catch {}
      gp.previousPlayer = null;
      gp.previousResource = null;
    }

    // when newPlayer becomes idle, start next track
    newPlayer.on(AudioPlayerStatus.Idle, async () => {
      // short delay to allow for transitions
      gp.currentPlayer = null;
      gp.currentResource = null;
      gp.currentUrl = null;
      gp.currentStartOffset = 0;
      gp.currentStartedAt = 0;
      if (gp.queue.length > 0) await this._startNext(guildId);
    });
  }

  // Crossfade previous -> current using volume ramps
  private async _crossfade(gp: GuildPlayback) {
    const prevRes = gp.previousResource!;
    const currRes = gp.currentResource!;
    const seconds = Math.max(0.1, gp.crossfadeSeconds);
    const steps = Math.max(8, Math.floor(seconds / 0.1));
    const interval = (seconds * 1000) / steps;
    let step = 0;
    // initialize current at 0 volume
    if (currRes.volume) currRes.volume.setVolume(0);
    return new Promise<void>((resolve) => {
      const iv = setInterval(() => {
        step++;
        const t = step / steps;
        // ramp prev down, curr up
        if (prevRes.volume) prevRes.volume.setVolume(gp.volume * (1 - t));
        if (currRes.volume) currRes.volume.setVolume(gp.volume * t);
        if (step >= steps) {
          clearInterval(iv);
          resolve();
        }
      }, interval);
    });
  }

  pause(guildId: string) {
    const gp = this.ensureGuild(guildId);
    if (gp.currentPlayer) {
      gp.currentPlayer.pause();
      return true;
    }
    return false;
  }

  resume(guildId: string) {
    const gp = this.ensureGuild(guildId);
    if (gp.currentPlayer) {
      gp.currentPlayer.unpause();
      return true;
    }
    return false;
  }

  stop(guildId: string) {
    const gp = this.ensureGuild(guildId);
    if (gp.currentPlayer) {
      try { gp.currentPlayer.stop(true); } catch {}
    }
    gp.queue = [];
    gp.currentUrl = null;
    gp.currentResource = null;
    gp.currentPlayer = null;
    gp.currentStartOffset = 0;
    gp.currentStartedAt = 0;
  }

  // Rewind current track by `seconds`. If seconds omitted, restarts track.
  async rewind(guildId: string, seconds = 10) {
    const gp = this.ensureGuild(guildId);
    if (!gp.currentUrl) return false;
    // compute elapsed
    const elapsed = gp.currentStartedAt ? (Date.now() - gp.currentStartedAt) / 1000 : 0;
    const newStart = Math.max(0, gp.currentStartOffset + elapsed - seconds);
    // stop current player and restart same track at newStart
    if (gp.currentPlayer) {
      try { gp.currentPlayer.stop(true); } catch {}
    }
    // create new stream with begin
    const stream = ytdl(gp.currentUrl, { filter: 'audioonly', highWaterMark: 1 << 25, quality: 'highestaudio', begin: `${Math.floor(newStart)}s` });
    const resource = createAudioResource(stream, { inlineVolume: true });
    if (resource.volume) resource.volume.setVolume(gp.volume);
    const newPlayer = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    gp.previousPlayer = gp.currentPlayer;
    gp.previousResource = gp.currentResource;
    gp.currentPlayer = newPlayer;
    gp.currentResource = resource;
    gp.currentStartOffset = newStart;
    gp.currentStartedAt = Date.now();
    if (gp.connection) gp.connection.subscribe(newPlayer);
    newPlayer.play(resource);
    newPlayer.on(AudioPlayerStatus.Idle, async () => {
      gp.currentPlayer = null;
      gp.currentResource = null;
      gp.currentUrl = null;
      gp.currentStartOffset = 0;
      gp.currentStartedAt = 0;
      if (gp.queue.length > 0) await this._startNext(guildId);
    });
    return true;
  }
}

export default AudioManager.getInstance();
