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
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } from '@discordjs/voice';
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

const PREFIX = process.env.PREFIX || 'S!';
const queue = new Map<string, { songs: string[]; player: any }>();

async function playSong(guildId: string) {
  const serverQueue = queue.get(guildId);
  if (!serverQueue || serverQueue.songs.length === 0) {
    const connection = getVoiceConnection(guildId);
    connection?.destroy();
    queue.delete(guildId);
    return;
  }

  const song = serverQueue.songs[0];
  const stream = ytdl(song, { filter: 'audioonly', highWaterMark: 1 << 25, quality: 'highestaudio' });
  const resource = createAudioResource(stream);

  serverQueue.player.play(resource);
  serverQueue.player.once(AudioPlayerStatus.Idle, () => {
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
    serverQueue = {
      songs: [],
      player: createAudioPlayer(),
    };
    queue.set(message.guild.id, serverQueue);

    joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });
  }

  switch (command) {
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
  ];

  const guilds = client.guilds.cache.map(g => g.id);
  for (const guildId of guilds) {
    const guild = client.guilds.cache.get(guildId);
    if (guild) await guild.commands.set(commands.map(c => c.toJSON()));
  }
});

client.on('interactionCreate', async (interaction: any) => {
  if (!interaction.isChatInputCommand() || !interaction.guild) return;

  const command = interaction.commandName;
  const voiceChannel = interaction.member?.voice.channel;
  if (!voiceChannel) return interaction.reply('You need to be in a voice channel!');

  let serverQueue = queue.get(interaction.guild.id);
  if (!serverQueue) {
    serverQueue = { songs: [], player: createAudioPlayer() };
    queue.set(interaction.guild.id, serverQueue);

    joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
    });
  }

  switch (command) {
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
  process.exit(1);
});
