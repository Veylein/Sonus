import { SlashCommandBuilder } from 'discord.js';
import audioManager from '../services/audioManager';

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a track or URL')
    .addStringOption(opt => opt.setName('query').setDescription('Song name or URL').setRequired(true)),
  async execute(interaction: any) {
    const query = interaction.options.getString('query', true);
    const member = interaction.member;
    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) {
      await interaction.reply({ content: 'You must be in a voice channel to use /play.', ephemeral: true });
      return;
    }
    await interaction.deferReply();
    try {
      const res = await audioManager.play(voiceChannel, query);
      await interaction.editReply({ content: `Queued: ${query} (position ${res.position})` });
    } catch (err) {
      console.error('Play error', err);
      await interaction.editReply({ content: 'Failed to queue track.', ephemeral: true });
    }
  }
};
