import { SlashCommandBuilder } from 'discord.js';
import audioManager from '../services/audioManager';

const PRESETS = [
  { name: 'Flat', value: 'flat' },
  { name: 'Bass', value: 'bass' },
  { name: 'Vocal', value: 'vocal' },
  { name: 'Night', value: 'night' },
  { name: 'Studio', value: 'studio' }
];

export default {
  data: new SlashCommandBuilder()
    .setName('eq')
    .setDescription('Set or view EQ preset for this server')
    .addStringOption(opt =>
      opt
        .setName('preset')
        .setDescription('EQ preset to apply (omit to view current)')
        .setRequired(false)
        .addChoices(...PRESETS.map(p => ({ name: p.name, value: p.value })))
    ),

  async execute(interaction: any) {
    const preset = interaction.options.getString('preset', false);
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'This command must be used in a guild.', ephemeral: true });
      return;
    }
    if (!preset) {
      const current = audioManager.getEqPreset(guildId);
      await interaction.reply({ content: `Current EQ preset: ${current}`, ephemeral: false });
      return;
    }
    audioManager.setEqPreset(guildId, preset);
    await interaction.reply({ content: `EQ preset set to ${preset}.`, ephemeral: false });
  }
};
