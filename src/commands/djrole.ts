import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import audioManager from '../services/audioManager';

export default {
  data: new SlashCommandBuilder()
    .setName('djrole')
    .setDescription('Manage the DJ role for this server')
    .addSubcommand(sub => sub.setName('set').setDescription('Set the DJ role').addRoleOption(r => r.setName('role').setDescription('Role to give DJ permissions').setRequired(true)))
    .addSubcommand(sub => sub.setName('clear').setDescription('Clear the DJ role'))
    .addSubcommand(sub => sub.setName('view').setDescription('View current DJ role')),

  async execute(interaction: any) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'This command must be used in a guild.', ephemeral: true });
      return;
    }
    const sub = interaction.options.getSubcommand();
    // fetch member to check permissions
    const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);

    // Only administrators can set/clear DJ role
    if (sub === 'set' || sub === 'clear') {
      const isAdmin = !!member && member.permissions?.has(PermissionsBitField.Flags.Administrator);
      if (!isAdmin) {
        await interaction.reply({ content: 'You must be a server administrator to set or clear the DJ role.', ephemeral: true });
        return;
      }
      if (sub === 'set') {
        const role = interaction.options.getRole('role');
        audioManager.setDjRole(guildId, role.id);
        await interaction.reply({ content: `DJ role set to ${role.name}`, ephemeral: false });
        return;
      }
      // clear
      audioManager.setDjRole(guildId, null);
      await interaction.reply({ content: 'DJ role cleared.', ephemeral: false });
      return;
    }

    if (sub === 'view') {
      const id = audioManager.getDjRole(guildId);
      if (!id) {
        await interaction.reply({ content: 'No DJ role set.', ephemeral: true });
      } else {
        await interaction.reply({ content: `DJ role ID: ${id}`, ephemeral: true });
      }
      return;
    }
  }
};
