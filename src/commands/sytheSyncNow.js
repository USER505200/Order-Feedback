const { SlashCommandBuilder } = require('discord.js');

function parseRoleNames(value, fallback) {
  return String(value || fallback)
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

function hasAllowedRole(member, allowedRoles) {
  const memberRoles = member?.roles?.cache?.map((role) => role.name.toLowerCase()) || [];
  return allowedRoles.some((roleName) => memberRoles.includes(roleName));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sythe-sync-now')
    .setDescription('Run Sythe vouch sync immediately'),

  async execute(interaction, { runManualSync }) {
    if (!interaction.inGuild()) {
      return await interaction.reply({
        content: 'This command can only be used inside a server.',
        ephemeral: true,
      });
    }

    const allowedRoles = parseRoleNames(
      process.env.SYTHE_SYNC_ALLOWED_ROLES || process.env.DELETE_ALLOWED_ROLES,
      'support,administration,founder,owner,admin,manager',
    );

    if (!hasAllowedRole(interaction.member, allowedRoles)) {
      return await interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    if (typeof runManualSync !== 'function') {
      return await interaction.reply({
        content: 'Sythe sync is not available right now.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const result = await runManualSync();

    return await interaction.editReply({
      content: result.sentCount
        ? `✅ Sythe sync completed. Sent ${result.sentCount} vouch(es).`
        : '✅ Sythe sync completed. No new vouches were found.',
    });
  },
};
