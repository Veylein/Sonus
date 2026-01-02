// load .env when available (optional on deploy hosts)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const _d = require('dotenv');
  if (_d && typeof _d.config === 'function') _d.config();
} catch (e) {
  // ignore if dotenv is not installed in the environment
}
import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import audioManager from './services/audioManager';
import playlists from './services/playlists';
import owners from '../config/owners.json';
import fs from 'fs';
import path from 'path';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN missing in .env');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
  for (const file of commandFiles) {
    // dynamic import
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const command = require(path.join(commandsPath, file));
    const cmd = command.default ?? command;
    if (cmd && cmd.data && cmd.execute) {
      client.commands.set(cmd.data.name, cmd);
    }
  }
}

client.once('ready', () => {
  console.log(`Sonus ready as ${client.user?.tag}`);
  // load persisted audio settings
  audioManager.init().then(() => console.log('AudioManager settings loaded')).catch(err => console.error(err));
  // Merge configured default radios into all guilds
  try {
    const guildIds = Array.from(client.guilds.cache.keys()) as string[];
    audioManager.loadDefaultsForGuilds(guildIds).then(() => console.log('Default radios merged into guilds')).catch(() => {});
  } catch (err) {
    // ignore
  }
});

client.on('interactionCreate', async (interaction: any) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error('Command error', err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error executing that command.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error executing that command.', ephemeral: true });
    }
  }
});

// Prefix message commands (S!)
const prefix = process.env.PREFIX || 'S!';
client.on('messageCreate', async (message: any) => {
  if (message.author?.bot) return;
  if (!message.content.startsWith(prefix)) return;
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();
  if (!cmd) return;

  // Simple prefix help
  if (cmd === 'help') {
    const help = `Commands (prefix ${prefix}):
• play <query|url> — join VC and play or queue a YouTube track
• pause / resume / skip / stop / rewind <seconds>
• eq <preset|list|current> — set audio EQ preset
• djrole set @role | clear | view — manage DJ role (admin only)
• radio create|delete|list|enable|disable|setdefault|view — manage radios
• playlist create|delete|list|show|add|remove|play — per-user playlists
• say / setpresence / shutdown — owner-only utilities
Use slash commands for many actions as well (/play, /eq, /playlist, /radio, /djrole)`;
    await message.reply(help);
    return;
  }

  if (cmd === 'play') {
    const query = args.join(' ');
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      await message.reply('You must be in a voice channel to use S!play');
      return;
    }
    // if URL, play directly; else search
    let url = query;
    const isUrl = /(https?:\/\/)/i.test(query);
    if (!isUrl) {
      // lazy dynamic import of yt-search
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const yts = require('yt-search');
        const r = await yts(query);
        if (r && r.videos && r.videos.length > 0) url = r.videos[0].url;
        else {
          await message.reply('No results found for that query.');
          return;
        }
      } catch (err) {
        console.error('Search failed', err);
        await message.reply('Search failed; try with a YouTube link.');
        return;
      }
    }
    try {
      const res = await audioManager.play(voiceChannel, url);
      await message.reply(`Queued: ${url} (position ${res.position})`);
    } catch (err) {
      console.error('Play failed', err);
      await message.reply('Failed to play track.');
    }
  }

  // Playlist commands (per-user)
  if (cmd === 'playlist') {
    const sub = (args.shift() || '').toLowerCase();
    const userId = message.author.id;
    if (sub === 'create') {
      const name = args.join(' ').trim();
      if (!name) { await message.reply('Usage: S!playlist create <name>'); return; }
      const ok = await playlists.createPlaylist(userId, name);
      if (!ok) await message.reply('Playlist already exists.'); else await message.reply(`Playlist '${name}' created.`);
      return;
    }
    if (sub === 'delete') {
      const name = args.join(' ').trim();
      if (!name) { await message.reply('Usage: S!playlist delete <name>'); return; }
      const ok = await playlists.deletePlaylist(userId, name);
      if (!ok) await message.reply('Playlist not found.'); else await message.reply(`Playlist '${name}' deleted.`);
      return;
    }
    if (sub === 'list') {
      const list = await playlists.listPlaylists(userId);
      if (list.length === 0) await message.reply('You have no playlists.'); else await message.reply(`Your playlists:\n${list.join('\n')}`);
      return;
    }
    if (sub === 'show') {
      const name = args.join(' ').trim();
      if (!name) { await message.reply('Usage: S!playlist show <name>'); return; }
      const pl = await playlists.getPlaylist(userId, name);
      if (!pl) { await message.reply('Playlist not found.'); return; }
      const lines = pl.map((t: any, i: number) => `${i+1}. ${t.title ?? t.url}`);
      await message.reply(`Playlist '${name}':\n${lines.join('\n')}`);
      return;
    }
    if (sub === 'add') {
      const name = args.shift();
      const query = args.join(' ');
      if (!name || !query) { await message.reply('Usage: S!playlist add <name> <url or query>'); return; }
      let url = query;
      const isUrl = /(https?:\/\/)/i.test(query);
      let title: string | undefined;
      if (!isUrl) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const yts = require('yt-search');
          const r = await yts(query);
          if (r && r.videos && r.videos.length > 0) { url = r.videos[0].url; title = r.videos[0].title; } else { await message.reply('No results found.'); return; }
        } catch (err) { console.error(err); await message.reply('Search failed.'); return; }
      }
      await playlists.addTrack(userId, name, { title, url });
      await message.reply(`Added to '${name}': ${title ?? url}`);
      return;
    }
    if (sub === 'remove') {
      const name = args.shift();
      const index = parseInt(args.shift() || '0', 10) - 1;
      if (!name || isNaN(index)) { await message.reply('Usage: S!playlist remove <name> <index>'); return; }
      const ok = await playlists.removeTrack(userId, name, index);
      if (!ok) await message.reply('Failed to remove track.'); else await message.reply('Removed track.');
      return;
    }
    if (sub === 'play') {
      const name = args.join(' ').trim();
      if (!name) { await message.reply('Usage: S!playlist play <name>'); return; }
      const pl = await playlists.getPlaylist(userId, name);
      if (!pl) { await message.reply('Playlist not found.'); return; }
      const voiceChannel = message.member?.voice?.channel;
      if (!voiceChannel) { await message.reply('You must be in a voice channel to play a playlist.'); return; }
      for (const track of pl) {
        await audioManager.play(voiceChannel, track.url);
      }
      await message.reply(`Queued playlist '${name}' (${pl.length} tracks).`);
      return;
    }
    await message.reply('Unknown playlist command. Available: create, delete, list, show, add, remove, play');
    return;
  }

  // Owner-only quick commands (prefix)
  if (cmd === 'say') {
    const userId = message.author.id;
    if (!owners.includes(userId)) { await message.reply('You are not a bot owner.'); return; }
    const msg = args.join(' ');
    if (!msg) { await message.reply('Usage: S!say [#channel] <message>'); return; }
    if (message.mentions.channels.size > 0) {
      const ch = message.mentions.channels.first();
      // @ts-ignore
      await ch.send(msg.replace(/<#[0-9]+>/g, '').trim());
      await message.reply('Sent.');
    } else {
      await message.channel.send(msg);
      await message.reply('Sent.');
    }
    return;
  }

  if (cmd === 'setpresence') {
    const userId = message.author.id;
    if (!owners.includes(userId)) { await message.reply('You are not a bot owner.'); return; }
    const text = args.join(' ');
    if (!text) { await message.reply('Usage: S!setpresence <text>'); return; }
    try {
      // @ts-ignore
      await client.user.setPresence({ activities: [{ name: text }], status: 'online' });
      await message.reply('Presence updated.');
    } catch (err) { console.error(err); await message.reply('Failed to set presence.'); }
    return;
  }

  if (cmd === 'shutdown') {
    const userId = message.author.id;
    if (!owners.includes(userId)) { await message.reply('You are not a bot owner.'); return; }
    await message.reply('Shutting down...');
    setTimeout(() => process.exit(0), 500);
    return;
  }

  // DJ role prefix management: S!djrole set|clear|view
  if (cmd === 'djrole') {
    const sub = (args.shift() || '').toLowerCase();
    const guildId = message.guildId;
    if (!guildId) { await message.reply('This command must be used in a guild.'); return; }
    const member = await message.guild?.members.fetch(message.author.id).catch(() => null);
    const isAdmin = !!member && member.permissions?.has && member.permissions.has(8); // Administrator bit
    if (sub === 'set') {
      if (!isAdmin) { await message.reply('You must be a server administrator to set the DJ role.'); return; }
      const role = message.mentions.roles.first();
      if (!role) { await message.reply('Usage: S!djrole set @role'); return; }
      audioManager.setDjRole(guildId, role.id);
      await message.reply(`DJ role set to ${role.name}`);
      return;
    }
    if (sub === 'clear') {
      if (!isAdmin) { await message.reply('You must be a server administrator to clear the DJ role.'); return; }
      audioManager.setDjRole(guildId, null);
      await message.reply('DJ role cleared.');
      return;
    }
    if (sub === 'view') {
      const id = audioManager.getDjRole(guildId);
      if (!id) await message.reply('No DJ role set.'); else await message.reply(`DJ role ID: ${id}`);
      return;
    }
    await message.reply('Usage: S!djrole set @role | clear | view');
  }

  // Radio management (prefix): S!radio create|delete|list|enable|disable|setdefault|view
  if (cmd === 'radio') {
    const sub = (args.shift() || '').toLowerCase();
    const guildId = message.guildId;
    if (!guildId) { await message.reply('This command must be used in a guild.'); return; }
    const member = await message.guild?.members.fetch(message.author.id).catch(() => null);
    const djRoleId = audioManager.getDjRole(guildId);
    const isAdmin = !!member && member.permissions?.has && member.permissions.has(8);
    const isDj = !!member && !!djRoleId && member.roles.cache.has(djRoleId);

    if (sub === 'create') {
      if (!isAdmin && !isDj) { await message.reply('You need to be an administrator or have the DJ role to create radios.'); return; }
      const name = args.shift();
      const url = args.shift();
      const description = args.join(' ') || undefined;
      if (!name) { await message.reply('Usage: S!radio create <name> [url] [description]'); return; }
      const ok = audioManager.createRadio(guildId, name, { description, url });
      if (!ok) await message.reply('A radio with that name already exists.'); else await message.reply(`Radio '${name}' created.`);
      return;
    }

    if (sub === 'delete') {
      if (!isAdmin && !isDj) { await message.reply('You need to be an administrator or have the DJ role to delete radios.'); return; }
      const name = args.join(' ');
      if (!name) { await message.reply('Usage: S!radio delete <name>'); return; }
      const ok = audioManager.deleteRadio(guildId, name);
      if (!ok) await message.reply('Radio not found.'); else await message.reply(`Radio '${name}' deleted.`);
      return;
    }

    if (sub === 'list') {
      const radios = audioManager.listRadios(guildId);
      const entries = Object.entries(radios);
      if (entries.length === 0) { await message.reply('No radios defined.'); return; }
      const lines = entries.map(([k, v]) => `- ${k} ${v.enabled ? '' : '(disabled)'}${v.description ? ` — ${v.description}` : ''}`);
      await message.reply(lines.join('\n'));
      return;
    }

    if (sub === 'enable' || sub === 'disable') {
      if (!isAdmin && !isDj) { await message.reply('You need to be an administrator or have the DJ role to enable/disable radios.'); return; }
      const name = args.join(' ');
      if (!name) { await message.reply(`Usage: S!radio ${sub} <name>`); return; }
      const ok = audioManager.setRadioEnabled(guildId, name, sub === 'enable');
      if (!ok) await message.reply('Radio not found.'); else await message.reply(`Radio '${name}' ${sub === 'enable' ? 'enabled' : 'disabled'}.`);
      return;
    }

    if (sub === 'setdefault') {
      if (!isAdmin && !isDj) { await message.reply('You need to be an administrator or have the DJ role to set the default radio.'); return; }
      const name = args.join(' ');
      if (!name) { await message.reply('Usage: S!radio setdefault <name>'); return; }
      const radios = audioManager.listRadios(guildId);
      if (!radios[name]) { await message.reply('Radio not found.'); return; }
      audioManager.setDefaultRadio(guildId, name);
      await message.reply(`Default radio set to '${name}'.`);
      return;
    }

    if (sub === 'view') {
      const name = args.join(' ');
      if (!name) { const def = audioManager.getDefaultRadio(guildId); await message.reply(`Default radio: ${def ?? 'none'}`); return; }
      const radios = audioManager.listRadios(guildId);
      const r = radios[name];
      if (!r) { await message.reply('Radio not found.'); return; }
      await message.reply(`Radio '${name}': ${r.description ?? 'no description'} ${r.url ? `\nURL: ${r.url}` : ''} ${r.enabled ? '' : '\n(DISABLED)'} `);
      return;
    }

    await message.reply('Unknown radio command. Available: create, delete, list, enable, disable, setdefault, view');
    return;
  }

  if (cmd === 'pause') {
    const ok = audioManager.pause(message.guildId);
    if (ok) await message.reply('Paused.'); else await message.reply('Nothing is playing.');
  }

  if (cmd === 'resume') {
    const ok = audioManager.resume(message.guildId);
    if (ok) await message.reply('Resumed.'); else await message.reply('Nothing to resume.');
  }

  if (cmd === 'skip') {
    const ok = await audioManager.skip(message.guildId);
    if (ok) await message.reply('Skipped.'); else await message.reply('Nothing is playing.');
  }

  if (cmd === 'stop') {
    audioManager.stop(message.guildId);
    await message.reply('Stopped and cleared queue.');
  }

  if (cmd === 'rewind') {
    const seconds = parseInt(args[0] || '10', 10) || 10;
    const ok = await audioManager.rewind(message.guildId, seconds);
    if (ok) await message.reply(`Rewound ${seconds}s.`); else await message.reply('Nothing is playing.');
  }
  // EQ control: S!eq <preset|list|current>
  if (cmd === 'eq') {
    const arg = (args[0] || '').toLowerCase();
    const allowed = ['flat', 'bass', 'vocal', 'night', 'studio'];
    if (!arg || arg === 'help') {
      await message.reply(`Usage: ${prefix}eq <preset|list|current>. Available: ${allowed.join(', ')}`);
      return;
    }
    if (arg === 'list') {
      await message.reply(`Available presets: ${allowed.join(', ')}`);
      return;
    }
    if (arg === 'current') {
      const cur = audioManager.getEqPreset(message.guildId);
      await message.reply(`Current preset: ${cur}`);
      return;
    }
    if (!allowed.includes(arg)) {
      await message.reply(`Unknown preset. Use ${prefix}eq list to see available presets.`);
      return;
    }
    audioManager.setEqPreset(message.guildId, arg);
    await message.reply(`EQ preset set to ${arg}.`);
  }
});

client.login(token).catch(err => {
  console.error('Login failed', err);
  process.exit(1);
});

export default client;
