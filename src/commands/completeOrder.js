const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const {
  COMPLETE_ORDER_AUTHOR_NAME,
  IMAGE_OPTION_NAMES,
  buildCompleteOrderFooterText,
  buildDurableFiles,
  collectImageAttachments,
  isImageAttachment,
} = require('../utils/completeOrderHelpers');

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

function buildDiscordChannelUrl(guildId, channelId) {
  const cleanGuildId = String(guildId || '').trim();
  const cleanChannelId = String(channelId || '').trim();

  if (!cleanGuildId || !cleanChannelId) {
    return '';
  }

  return `https://discord.com/channels/${cleanGuildId}/${cleanChannelId}`;
}

const commandBuilder = new SlashCommandBuilder()
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
      .setDescription('Upload the first completion screenshot')
      .setRequired(true),
  );

for (const optionName of IMAGE_OPTION_NAMES.slice(1)) {
  commandBuilder.addAttachmentOption((option) =>
    option
      .setName(optionName)
      .setDescription(`Upload additional completion screenshot ${optionName.replace('image_', '#')}`)
      .setRequired(false),
  );
}

module.exports = {
  data: commandBuilder,

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
      const images = collectImageAttachments((optionName, required) =>
        interaction.options.getAttachment(optionName, required),
      );

      if (!images.length) {
        return await interaction.reply({
          content: 'Please upload at least one valid image file.',
          ephemeral: true,
        });
      }

      const invalidImage = images.find((image) => !isImageAttachment(image));
      if (invalidImage) {
        return await interaction.reply({
          content: `The file \`${invalidImage.name || 'unknown'}\` is not a supported image.`,
          ephemeral: true,
        });
      }

      let files;
      try {
        files = await buildDurableFiles(images);
      } catch (error) {
        console.error('complete-order attachment download error:', error);
        return await interaction.reply({
          content: 'Could not process one or more uploaded images. Please try again.',
          ephemeral: true,
        });
      }

      const guildIcon = interaction.guild.iconURL({ size: 256 }) || null;
      const infoImageUrl = process.env.COMPLETE_ORDER_INFO_IMAGE_URL || guildIcon || null;

      const channel1Id = process.env.COMPLETE_ORDER_CHANNEL_1_ID || '';
      const channel1Label = process.env.COMPLETE_ORDER_CHANNEL_1_LABEL || 'Explore all services:';
      const channel2Id = process.env.COMPLETE_ORDER_CHANNEL_2_ID || '';
      const channel2Label = process.env.COMPLETE_ORDER_CHANNEL_2_LABEL || 'Start a new order:';
      const priceListChannelId = process.env.PRICE_LIST_CHANNEL_ID || '1488969938210128134';
      const priceListLabel = process.env.PRICE_LIST_LABEL || 'Price List';

      const linkLines = [];
      if (channel1Id) linkLines.push(`${channel1Label} <#${channel1Id}>`);
      if (channel2Id) linkLines.push(`${channel2Label} <#${channel2Id}>`);
      if (priceListChannelId) linkLines.push(`${priceListLabel} <#${priceListChannelId}>`);

      const sharedUrl =
        buildDiscordChannelUrl(interaction.guildId, channel2Id) ||
        buildDiscordChannelUrl(interaction.guildId, channel1Id) ||
        buildDiscordChannelUrl(interaction.guildId, priceListChannelId);

      const infoBlock =
        '## ✅ Completed Order ✅\n' +
        '```\n' +
        `${description}\n` +
        '```';

      const embeds = [
        new EmbedBuilder()
          .setColor(0xff6a00)
          .setAuthor({
            name: COMPLETE_ORDER_AUTHOR_NAME,
            iconURL: guildIcon || undefined,
          })
          .setURL(sharedUrl || null)
          .setDescription(infoBlock)
          .setThumbnail(infoImageUrl || undefined)
          .setImage(`attachment://${files[0].name}`)
          .addFields(
            ...(linkLines.length
              ? [
                  {
                    name: '🔗 Links',
                    value: linkLines.join('\n'),
                    inline: false,
                  },
                ]
              : []),
            {
              name: '🧑‍💼 Completed by',
              value: `<@${interaction.user.id}>`,
              inline: false,
            },
          )
          .setFooter({
            text: buildCompleteOrderFooterText(interaction.user.id),
            iconURL: guildIcon || undefined,
          })
          .setTimestamp(),
      ];

      for (const file of files.slice(1)) {
        embeds.push(
          new EmbedBuilder()
            .setColor(0xff6a00)
            .setURL(sharedUrl || null)
            .setImage(`attachment://${file.name}`),
        );
      }

      const buttons = [];
      const priceListUrl = buildDiscordChannelUrl(interaction.guildId, priceListChannelId);
      const createOrderUrl = buildDiscordChannelUrl(interaction.guildId, channel2Id);

      if (priceListUrl) {
        buttons.push(
          new ButtonBuilder()
            .setLabel(priceListLabel)
            .setStyle(ButtonStyle.Link)
            .setURL(priceListUrl),
        );
      }

      if (createOrderUrl) {
        buttons.push(
          new ButtonBuilder()
            .setLabel(channel2Label)
            .setStyle(ButtonStyle.Link)
            .setURL(createOrderUrl),
        );
      }

      const components = buttons.length
        ? [new ActionRowBuilder().addComponents(buttons)]
        : [];

      await targetChannel.send({ embeds, files, components });

      return await interaction.reply({
        content: `✅ Complete order sent successfully in <#${targetChannelId}>.`,
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
