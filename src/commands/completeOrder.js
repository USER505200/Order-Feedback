const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
    .setName('complete-order')
    .setDescription('Send a completed order embed')
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('Write the completed order description')
        .setRequired(true),
    )
    .addAttachmentOption((option) =>
      option
        .setName('image')
        .setDescription('Upload the completion screenshot')
        .setRequired(true),
    ),

  async execute(interaction) {
    try {
      if (!interaction.inGuild()) {
        return await interaction.reply({
          content: 'This command can only be used inside a server.',
          ephemeral: true,
        });
      }

      const allowedRoles = parseRoleNames(
        process.env.COMPLETE_ALLOWED_ROLES,
        'worker,support,admin,manager,founder,owner,administration',
      );

      if (!hasAllowedRole(interaction.member, allowedRoles)) {
        return await interaction.reply({
          content: 'You do not have permission to use this command.',
          ephemeral: true,
        });
      }

      const targetChannelId = process.env.COMPLETED_ORDERS_CHANNEL_ID;
      if (!targetChannelId) {
        return await interaction.reply({
          content: 'COMPLETED_ORDERS_CHANNEL_ID is missing in the .env file.',
          ephemeral: true,
        });
      }

      const targetChannel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);
      if (!targetChannel || !targetChannel.isTextBased()) {
        return await interaction.reply({
          content: 'The completed orders channel is invalid or not accessible.',
          ephemeral: true,
        });
      }

      const description = interaction.options.getString('description', true);
      const image = interaction.options.getAttachment('image');

      if (!image) {
        return await interaction.reply({
          content: 'Please upload a valid image file.',
          ephemeral: true,
        });
      }

      const guildName = interaction.guild.name;
      const guildIcon = interaction.guild.iconURL({ size: 256 }) || null;
      const infoImageUrl = process.env.COMPLETE_ORDER_INFO_IMAGE_URL || guildIcon || null;

      const channel1Id = process.env.COMPLETE_ORDER_CHANNEL_1_ID || '';
      const channel1Label = process.env.COMPLETE_ORDER_CHANNEL_1_LABEL || '🛒 Explore all services:';
      const channel2Id = process.env.COMPLETE_ORDER_CHANNEL_2_ID || '';
      const channel2Label = process.env.COMPLETE_ORDER_CHANNEL_2_LABEL || '🎫 Start a new order:';

      const linkLines = [];
      if (channel1Id) linkLines.push(`${channel1Label} <#${channel1Id}>`);
      if (channel2Id) linkLines.push(`${channel2Label} <#${channel2Id}>`);

      const infoBlock =
        '## ✅ Completed Order ✅\n' +
        '```\n' +
        `${description}\n` +
        '```';

      const embed = new EmbedBuilder()
        .setColor(0xff6a00)
        .setAuthor({
          name: 'Complete Order',
          iconURL: guildIcon || undefined,
        })
        .setDescription(infoBlock)
        .setThumbnail(infoImageUrl || undefined)
        .setImage(image.proxyURL || image.url)
        .addFields(
          ...(linkLines.length
            ? [
                {
                  name: 'Links',
                  value: linkLines.join('\n'),
                  inline: false,
                },
              ]
            : []),
          {
            name: 'Completed by',
            value: `<@${interaction.user.id}>`,
            inline: false,
          },
        )
        .setFooter({
          text: `Completed by: ${interaction.user.id}`,
          iconURL: guildIcon || undefined,
        })
        .setTimestamp();

      await targetChannel.send({ embeds: [embed] });

      return await interaction.reply({
        content: `Complete order sent successfully in <#${targetChannelId}>.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error('complete-order error:', error);

      if (interaction.replied || interaction.deferred) {
        return await interaction.followUp({
          content: 'Something went wrong while sending the completed order.',
          ephemeral: true,
        }).catch(() => {});
      }

      return await interaction.reply({
        content: 'Something went wrong while sending the completed order.',
        ephemeral: true,
      }).catch(() => {});
    }
  },
};
