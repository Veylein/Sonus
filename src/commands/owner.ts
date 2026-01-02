import { SlashCommandBuilder } from 'discord.js';
import owners from '../../config/owners.json';

export default {
  data: new SlashCommandBuilder()
    .setName('owner')
    .setDescription('Bot owner-only commands')
    .addSubcommand(sub => sub.setName('say').setDescription('Make the bot say something').addChannelOption(c => c.setName('channel').setDescription('Channel to send in')).addStringOption(s => s.setName('message').setDescription('Message').setRequired(true)))
    .addSubcommand(sub => sub.setName('presence').setDescription('Set bot presence').addStringOption(s => s.setName('text').setDescription('Activity text').setRequired(true)))
    .addSubcommand(sub => sub.setName('shutdown').setDescription('Shutdown bot')),

  async execute(interaction: any) {
    const userId = interaction.user.id;
    if (!owners.includes(userId)) {
      await interaction.reply({ content: 'You are not a bot owner.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    if (sub === 'say') {
      const ch = interaction.options.getChannel('channel') ?? interaction.channel;
      const msg = interaction.options.getString('message', true);
      // @ts-ignore
      await ch.send(msg);
      await interaction.reply({ content: 'Sent.', ephemeral: true });
      return;
    }

    if (sub === 'presence') {
      const text = interaction.options.getString('text', true);
      try {
        await interaction.client.user.setPresence({ activities: [{ name: text }], status: 'online' });
        await interaction.reply({ content: 'Presence updated.', ephemeral: true });
      } catch (err) {
        await interaction.reply({ content: 'Failed to set presence.', ephemeral: true });
      }
      return;
    }

    if (sub === 'shutdown') {
      await interaction.reply({ content: 'Shutting down...', ephemeral: true });
      setTimeout(() => interaction.client.destroy(), 500);
      return;
    }
  }
};
