import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import audioManager from '../services/audioManager';

export default {
  data: new SlashCommandBuilder()
    .setName('radio')
    .setDescription('Manage radios for this server')
    .addSubcommand((sub) => sub.setName('create').setDescription('Create a radio').addStringOption((o) => o.setName('name').setDescription('Radio name').setRequired(true)).addStringOption((o) => o.setName('description').setDescription('Description').setRequired(false)).addStringOption((o) => o.setName('url').setDescription('Optional stream/seed URL').setRequired(false)))
    .addSubcommand((sub) => sub.setName('delete').setDescription('Delete a radio').addStringOption((o) => o.setName('name').setDescription('Radio name').setRequired(true)))
    .addSubcommand((sub) => sub.setName('list').setDescription('List radios'))
    .addSubcommand((sub) => sub.setName('enable').setDescription('Enable a radio').addStringOption((o) => o.setName('name').setDescription('Radio name').setRequired(true)))
    .addSubcommand((sub) => sub.setName('disable').setDescription('Disable a radio').addStringOption((o) => o.setName('name').setDescription('Radio name').setRequired(true)))
    .addSubcommand((sub) => sub.setName('setdefault').setDescription('Set default radio for server').addStringOption((o) => o.setName('name').setDescription('Radio name').setRequired(true)))
    .addSubcommand((sub) => sub.setName('view').setDescription('View radio details').addStringOption((o) => o.setName('name').setDescription('Radio name').setRequired(false))),

  async execute(interaction: any) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'This command must be used in a guild.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    // fetch member for permission checks
    const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
    const djRoleId = audioManager.getDjRole(guildId);
    const isAdmin = !!member && member.permissions?.has(PermissionsBitField.Flags.Administrator);
    const isDj = !!member && !!djRoleId && member.roles.cache.has(djRoleId);
    if (sub === 'create') {
      if (!isAdmin && !isDj) {
        await interaction.reply({ content: 'You need to be an administrator or have the DJ role to create radios.', ephemeral: true });
        return;
      }
      const name = interaction.options.getString('name', true);
      const description = interaction.options.getString('description');
      const url = interaction.options.getString('url');
      const ok = audioManager.createRadio(guildId, name, { description: description ?? undefined, url: url ?? undefined });
      if (!ok) {
        await interaction.reply({ content: 'A radio with that name already exists.', ephemeral: true });
      } else {
        await interaction.reply({ content: `Radio '${name}' created.`, ephemeral: false });
      }
      return;
    }

    if (sub === 'delete') {
      if (!isAdmin && !isDj) {
        await interaction.reply({ content: 'You need to be an administrator or have the DJ role to delete radios.', ephemeral: true });
        return;
      }
      const name = interaction.options.getString('name', true);
      const ok = audioManager.deleteRadio(guildId, name);
      if (!ok) await interaction.reply({ content: 'Radio not found.', ephemeral: true }); else await interaction.reply({ content: `Radio '${name}' deleted.`, ephemeral: false });
      return;
    }

    if (sub === 'list') {
      const radios = audioManager.listRadios(guildId);
      const entries = Object.entries(radios);
      if (entries.length === 0) {
        await interaction.reply({ content: 'No radios defined.', ephemeral: true });
        return;
      }
      const lines = entries.map(([k, v]) => `- ${k} ${v.enabled ? '' : '(disabled)'}${v.description ? ` — ${v.description}` : ''}`);
      await interaction.reply({ content: lines.join('\n'), ephemeral: false });
      return;
    }

    if (sub === 'enable' || sub === 'disable') {
      if (!isAdmin && !isDj) {
        await interaction.reply({ content: 'You need to be an administrator or have the DJ role to enable/disable radios.', ephemeral: true });
        return;
      }
      const name = interaction.options.getString('name', true);
      const ok = audioManager.setRadioEnabled(guildId, name, sub === 'enable');
      if (!ok) await interaction.reply({ content: 'Radio not found.', ephemeral: true }); else await interaction.reply({ content: `Radio '${name}' ${sub === 'enable' ? 'enabled' : 'disabled'}.`, ephemeral: false });
      return;
    }

    if (sub === 'setdefault') {
      if (!isAdmin && !isDj) {
        await interaction.reply({ content: 'You need to be an administrator or have the DJ role to set the default radio.', ephemeral: true });
        return;
      }
      const name = interaction.options.getString('name', true);
      const radios = audioManager.listRadios(guildId);
      if (!radios[name]) {
        await interaction.reply({ content: 'Radio not found.', ephemeral: true });
        return;
      }
      audioManager.setDefaultRadio(guildId, name);
      await interaction.reply({ content: `Default radio set to '${name}'.`, ephemeral: false });
      return;
    }

    if (sub === 'view') {
      const name = interaction.options.getString('name');
      if (!name) {
        const def = audioManager.getDefaultRadio(guildId);
        await interaction.reply({ content: `Default radio: ${def ?? 'none'}`, ephemeral: true });
        return;
      }
      const radios = audioManager.listRadios(guildId);
      const r = radios[name];
      if (!r) {
        await interaction.reply({ content: 'Radio not found.', ephemeral: true });
        return;
      }
      await interaction.reply({ content: `Radio '${name}': ${r.description ?? 'no description'} ${r.url ? `\nURL: ${r.url}` : ''} ${r.enabled ? '' : '\n(DISABLED)'}`, ephemeral: false });
      return;
    }
  }
};
