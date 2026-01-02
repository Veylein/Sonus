import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check Sonus latency'),
  async execute(interaction: any) {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    // simple latency measurement
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(`Pong! WS: ${Math.round((interaction.client.ws.ping || 0))}ms • RTT: ${latency}ms`);
  }
};
