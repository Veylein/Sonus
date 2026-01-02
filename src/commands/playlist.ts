import { SlashCommandBuilder } from 'discord.js';
import playlists from '../services/playlists';
import audioManager from '../services/audioManager';

export default {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage your playlists')
    .addSubcommand(sub => sub.setName('create').setDescription('Create a playlist').addStringOption(o => o.setName('name').setDescription('Playlist name').setRequired(true)))
    .addSubcommand(sub => sub.setName('delete').setDescription('Delete a playlist').addStringOption(o => o.setName('name').setDescription('Playlist name').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List your playlists'))
    .addSubcommand(sub => sub.setName('show').setDescription('Show playlist tracks').addStringOption(o => o.setName('name').setDescription('Playlist name').setRequired(true)))
    .addSubcommand(sub => sub.setName('add').setDescription('Add a track to a playlist').addStringOption(o => o.setName('name').setDescription('Playlist name').setRequired(true)).addStringOption(o => o.setName('query').setDescription('URL or search query').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove').setDescription('Remove a track by index').addStringOption(o => o.setName('name').setDescription('Playlist name').setRequired(true)).addIntegerOption(i => i.setName('index').setDescription('1-based index').setRequired(true)))
    .addSubcommand(sub => sub.setName('play').setDescription('Play a playlist in your voice channel').addStringOption(o => o.setName('name').setDescription('Playlist name').setRequired(true))),

  async execute(interaction: any) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    if (sub === 'create') {
      const name = interaction.options.getString('name', true);
      const ok = await playlists.createPlaylist(userId, name);
      if (!ok) await interaction.reply({ content: 'Playlist already exists.', ephemeral: true }); else await interaction.reply({ content: `Playlist '${name}' created.`, ephemeral: false });
      return;
    }
    if (sub === 'delete') {
      const name = interaction.options.getString('name', true);
      const ok = await playlists.deletePlaylist(userId, name);
      if (!ok) await interaction.reply({ content: 'Playlist not found.', ephemeral: true }); else await interaction.reply({ content: `Playlist '${name}' deleted.`, ephemeral: false });
      return;
    }
    if (sub === 'list') {
      const list = await playlists.listPlaylists(userId);
      if (list.length === 0) await interaction.reply({ content: 'You have no playlists.', ephemeral: true }); else await interaction.reply({ content: `Your playlists:\n${list.join('\n')}`, ephemeral: true });
      return;
    }
    if (sub === 'show') {
      const name = interaction.options.getString('name', true);
      const pl = await playlists.getPlaylist(userId, name);
      if (!pl) { await interaction.reply({ content: 'Playlist not found.', ephemeral: true }); return; }
      const lines = pl.map((t: any, i: number) => `${i+1}. ${t.title ?? t.url}`);
      await interaction.reply({ content: `Playlist '${name}':\n${lines.join('\n')}`, ephemeral: true });
      return;
    }
    if (sub === 'add') {
      const name = interaction.options.getString('name', true);
      let query = interaction.options.getString('query', true);
      // search if not a URL
      const isUrl = /(https?:\/\/)/i.test(query);
      let title: string | undefined;
      if (!isUrl) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const yts = require('yt-search');
          const r = await yts(query);
          if (r && r.videos && r.videos.length > 0) { query = r.videos[0].url; title = r.videos[0].title; } else { await interaction.reply({ content: 'No results found.', ephemeral: true }); return; }
        } catch (err) { console.error(err); await interaction.reply({ content: 'Search failed.', ephemeral: true }); return; }
      }
      await playlists.addTrack(userId, name, { title, url: query });
      await interaction.reply({ content: `Added to '${name}': ${title ?? query}`, ephemeral: false });
      return;
    }
    if (sub === 'remove') {
      const name = interaction.options.getString('name', true);
      const index = interaction.options.getInteger('index', true) - 1;
      const ok = await playlists.removeTrack(userId, name, index);
      if (!ok) await interaction.reply({ content: 'Failed to remove track.', ephemeral: true }); else await interaction.reply({ content: 'Removed track.', ephemeral: false });
      return;
    }
    if (sub === 'play') {
      const name = interaction.options.getString('name', true);
      const pl = await playlists.getPlaylist(userId, name);
      if (!pl) { await interaction.reply({ content: 'Playlist not found.', ephemeral: true }); return; }
      const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
      const voiceChannel = member?.voice?.channel;
      if (!voiceChannel) { await interaction.reply({ content: 'You must be in a voice channel to play a playlist.', ephemeral: true }); return; }
      for (const track of pl) {
        await audioManager.play(voiceChannel, track.url);
      }
      await interaction.reply({ content: `Queued playlist '${name}' (${pl.length} tracks).`, ephemeral: false });
      return;
    }
  }
};
