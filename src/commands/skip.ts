import { SlashCommandBuilder } from 'discord.js';
import audioManager from '../services/audioManager';

export default {
  data: new SlashCommandBuilder().setName('skip').setDescription('Skip the current track'),
  async execute(interaction: any) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'This command must be used in a guild.', ephemeral: true });
      return;
    }
    const ok = await audioManager.skip(guildId);
    if (ok) await interaction.reply({ content: 'Skipped current track.' });
    else await interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
  }
};
