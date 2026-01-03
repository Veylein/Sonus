// Simple music-focused index (replaces the previous multi-service entrypoint)
// This implements a lightweight queue/player and registers slash commands on ready.
// It uses environment variables for the token and keeps behavior minimal for reliability.

// load .env when available (optional on deploy hosts)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const _d = require('dotenv');
  if (_d && typeof _d.config === 'function') _d.config();
} catch (e) {
  // ignore if dotenv is not installed in the environment
}

import { Client, GatewayIntentBits, SlashCommandBuilder } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection, StreamType } from '@discordjs/voice';
import ytdl from 'ytdl-core';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN missing in environment');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

// ID of the channel to post runtime logs into
const LOG_CHANNEL_ID = '1442605619835179127';

async function sendLog(text: string, level: 'info' | 'error' = 'info') {
  const prefix = `[Sonus ${level.toUpperCase()}]`;
  if (level === 'error') console.error(text);
  else console.log(text);

  try {
    if (!client || !client.isReady()) return;
    const ch = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (!ch) return;
    const msg = `${prefix} ${typeof text === 'string' ? text : JSON.stringify(text)}`;
    const out = msg.length > 1900 ? msg.slice(0, 1900) + '…' : msg;
    // send if channel supports sending messages
    // @ts-ignore
    if (typeof ch.send === 'function') await (ch as any).send(out);
  } catch (err) {
    console.error('sendLog failed:', err);
  }
}

const PREFIX = process.env.PREFIX || 'S!';
const queue = new Map<string, { songs: string[]; player: any }>();

const HELP_TEXT = `Commands:\n- play <url> or /play url: add YouTube URL to queue\n- pause or /pause: pause playback\n- resume or /resume: resume playback\n- skip or /skip: skip current track\n- stop or /stop: stop and clear queue\n- queue or /queue: show current queue\n- join or /join: make bot join your VC\n- leave or /leave: make bot leave VC\n- help or /help: show this help\n- ping or /ping: show latency`;

async function playSong(guildId: string) {
  const serverQueue = queue.get(guildId);
  if (!serverQueue || serverQueue.songs.length === 0) {
    const connection = getVoiceConnection(guildId);
    connection?.destroy();
    queue.delete(guildId);
    return;
  }
  const song = serverQueue.songs[0];
  console.log(`playSong: guild=${guildId} starting ${song}`);
  await sendLog(`playSong: guild=${guildId} starting ${song}`, 'info');
  let stream;
  try {
    stream = ytdl(song, { filter: 'audioonly', highWaterMark: 1 << 25, quality: 'highestaudio', dlChunkSize: 0 });
  } catch (err) {
    console.error(`ytdl failed to create stream for guild ${guildId}:`, err);
    serverQueue.songs.shift();
    // try next
    setImmediate(() => playSong(guildId));
    return;
  }
  stream.on('error', (err) => {
    console.error(`ytdl stream error for guild ${guildId}:`, err);
    void sendLog(`ytdl stream error for guild ${guildId}: ${String(err)}`, 'error');
  });

  let resource;
  try {
    resource = createAudioResource(stream, { inputType: StreamType.Arbitrary, inlineVolume: true });
    // set safe default volume
    try { resource.volume.setVolume(0.8); } catch {}
  } catch (err) {
    console.error(`createAudioResource failed for guild ${guildId}:`, err);
    await sendLog(`createAudioResource failed for guild ${guildId}: ${String(err)}`, 'error');
    serverQueue.songs.shift();
    setImmediate(() => playSong(guildId));
    return;
  }

  serverQueue.player.play(resource);
  console.log(`player.play called for guild=${guildId}`);
  await sendLog(`player.play called for guild=${guildId}`, 'info');
  try {
    await sendLog(`Resource inlineVolume=${Boolean((resource as any)?.volume)} for guild=${guildId}`, 'info');
  } catch {}

  serverQueue.player.once(AudioPlayerStatus.Idle, () => {
    console.log(`player idle for guild=${guildId}, shifting queue`);
    void sendLog(`player idle for guild=${guildId}, shifting queue`, 'info');
    serverQueue.songs.shift();
    playSong(guildId);
  });
}

client.on('messageCreate', async (message: any) => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  const voiceChannel = message.member?.voice.channel;
  if (!voiceChannel) return message.reply('You need to be in a voice channel!');

  let serverQueue = queue.get(message.guild.id);
  if (!serverQueue) {
    const player = createAudioPlayer();
    player.on('error', (error) => {
      console.error(`Audio player error (message) guild=${message.guild?.id}:`, error);
      void sendLog(`Audio player error (message) guild=${message.guild?.id}: ${String(error)}`, 'error');
    });
    player.on(AudioPlayerStatus.Playing, () => {
      console.log(`player status Playing (message) guild=${message.guild?.id}`);
      void sendLog(`player status Playing (message) guild=${message.guild?.id}`,'info');
    });
    player.on(AudioPlayerStatus.Idle, () => {
      console.log(`player status Idle (message) guild=${message.guild?.id}`);
      void sendLog(`player status Idle (message) guild=${message.guild?.id}`,'info');
    });

    serverQueue = {
      songs: [],
      player,
    };
    queue.set(message.guild.id, serverQueue);

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });
    connection.subscribe(player);
  }

  switch (command) {
    case 'help':
      message.reply(HELP_TEXT);
      break;
    case 'ping':
      message.reply(`Pong! ${Math.round(client.ws.ping)}ms`);
      break;
    case 'join':
      {
        const existing = getVoiceConnection(message.guild.id);
        if (existing) return message.reply('Already connected.');
        const conn = joinVoiceChannel({ channelId: voiceChannel.id, guildId: message.guild.id, adapterCreator: message.guild.voiceAdapterCreator });
        conn.subscribe(serverQueue.player);
        message.reply('Joined voice channel.');
      }
      break;
    case 'leave':
      {
        serverQueue.songs = [];
        serverQueue.player.stop();
        const conn = getVoiceConnection(message.guild.id);
        conn?.destroy();
        queue.delete(message.guild.id);
        message.reply('Left voice channel.');
      }
      break;
    case 'play':
      if (!args[0]) return message.reply('Provide a YouTube URL!');
      serverQueue.songs.push(args[0]);
      if (serverQueue.player.state.status !== AudioPlayerStatus.Playing) {
        playSong(message.guild.id);
      }
      message.reply(`Added to queue: ${args[0]}`);
      break;

    case 'pause':
      serverQueue.player.pause();
      message.reply('Paused!');
      break;

    case 'resume':
      serverQueue.player.unpause();
      message.reply('Resumed!');
      break;

    case 'skip':
      serverQueue.player.stop();
      message.reply('Skipped!');
      break;

    case 'stop':
      serverQueue.songs = [];
      serverQueue.player.stop();
      const connection = getVoiceConnection(message.guild.id);
      connection?.destroy();
      queue.delete(message.guild.id);
      message.reply('Stopped playback and cleared the queue!');
      break;

    case 'queue':
      message.reply(`Queue:\n${serverQueue.songs.join('\n') || 'Empty'}`);
      break;

    default:
      message.reply('Unknown command.');
  }
});

client.on('ready', async () => {
  console.log(`${client.user?.tag} is online!`);

  const commands = [
    new SlashCommandBuilder().setName('play').setDescription('Play a YouTube URL').addStringOption(option => option.setName('url').setDescription('YouTube URL').setRequired(true)),
    new SlashCommandBuilder().setName('pause').setDescription('Pause playback'),
    new SlashCommandBuilder().setName('resume').setDescription('Resume playback'),
    new SlashCommandBuilder().setName('skip').setDescription('Skip current song'),
    new SlashCommandBuilder().setName('stop').setDescription('Stop playback'),
    new SlashCommandBuilder().setName('queue').setDescription('Show current queue'),
    new SlashCommandBuilder().setName('help').setDescription('Show help about bot commands'),
    new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
    new SlashCommandBuilder().setName('join').setDescription('Make the bot join your voice channel'),
    new SlashCommandBuilder().setName('leave').setDescription('Make the bot leave voice channel'),
  ];

  try {
    console.log('Registering slash commands (global + per-guild)');
    // register global commands (may take up to an hour to appear)
    if (client.application?.commands) {
      await client.application.commands.set(commands.map(c => c.toJSON()));
      console.log('Registered global application commands');
      await sendLog('Registered global application commands', 'info');
    }

    // also try to set per-guild immediately for cached guilds
    const guildIds = client.guilds.cache.map(g => g.id);
    console.log('Found guilds:', guildIds);
    void sendLog(`Found guilds: ${guildIds.join(',')}`, 'info');
    for (const guildId of guildIds) {
      const guild = client.guilds.cache.get(guildId);
      if (guild) {
        try {
          await guild.commands.set(commands.map(c => c.toJSON()));
          console.log(`Registered commands for guild ${guildId}`);
          await sendLog(`Registered commands for guild ${guildId}`, 'info');
        } catch (err) {
          console.error(`Failed to register commands for guild ${guildId}:`, err);
          void sendLog(`Failed to register commands for guild ${guildId}: ${String(err)}`, 'error');
        }
      }
    }
  } catch (err) {
    console.error('Error registering commands:', err);
  }
});

client.on('interactionCreate', async (interaction: any) => {
  if (!interaction.isChatInputCommand() || !interaction.guild) return;

  const command = interaction.commandName;
  const voiceChannel = interaction.member?.voice.channel;
  if (!voiceChannel) return interaction.reply('You need to be in a voice channel!');

  let serverQueue = queue.get(interaction.guild.id);
  if (!serverQueue) {
    const player = createAudioPlayer();
    player.on('error', (error) => {
      console.error(`Audio player error (interaction) guild=${interaction.guild?.id}:`, error);
      void sendLog(`Audio player error (interaction) guild=${interaction.guild?.id}: ${String(error)}`, 'error');
    });
    player.on(AudioPlayerStatus.Playing, () => {
      console.log(`player status Playing (interaction) guild=${interaction.guild?.id}`);
      void sendLog(`player status Playing (interaction) guild=${interaction.guild?.id}`,'info');
    });
    player.on(AudioPlayerStatus.Idle, () => {
      console.log(`player status Idle (interaction) guild=${interaction.guild?.id}`);
      void sendLog(`player status Idle (interaction) guild=${interaction.guild?.id}`,'info');
    });

    serverQueue = { songs: [], player };
    queue.set(interaction.guild.id, serverQueue);

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
    });
    connection.subscribe(player);
  }

  switch (command) {
    case 'help':
      await interaction.reply(HELP_TEXT);
      break;
    case 'ping':
      await interaction.reply(`Pong! ${Math.round(client.ws.ping)}ms`);
      break;
    case 'join':
      {
        const existing = getVoiceConnection(interaction.guild.id);
        if (existing) return interaction.reply('Already connected.');
        const conn = joinVoiceChannel({ channelId: voiceChannel.id, guildId: interaction.guild.id, adapterCreator: interaction.guild.voiceAdapterCreator });
        conn.subscribe(serverQueue.player);
        await interaction.reply('Joined voice channel.');
      }
      break;
    case 'leave':
      {
        serverQueue.songs = [];
        serverQueue.player.stop();
        const conn = getVoiceConnection(interaction.guild.id);
        conn?.destroy();
        queue.delete(interaction.guild.id);
        await interaction.reply('Left voice channel.');
      }
      break;
    case 'play':
      const url = interaction.options.getString('url', true);
      serverQueue.songs.push(url);
      if (serverQueue.player.state.status !== AudioPlayerStatus.Playing) playSong(interaction.guild.id);
      await interaction.reply(`Added to queue: ${url}`);
      break;
    case 'pause':
      serverQueue.player.pause();
      await interaction.reply('Paused!');
      break;
    case 'resume':
      serverQueue.player.unpause();
      await interaction.reply('Resumed!');
      break;
    case 'skip':
      serverQueue.player.stop();
      await interaction.reply('Skipped!');
      break;
    case 'stop':
      serverQueue.songs = [];
      serverQueue.player.stop();
      const connection2 = getVoiceConnection(interaction.guild.id);
      connection2?.destroy();
      queue.delete(interaction.guild.id);
      await interaction.reply('Stopped playback and cleared the queue!');
      break;
    case 'queue':
      await interaction.reply(`Queue:\n${serverQueue.songs.join('\n') || 'Empty'}`);
      break;
  }
});

client.login(token).catch(err => {
  console.error('Login failed', err);
  void sendLog(`Login failed: ${String(err)}`, 'error');
  process.exit(1);
});
