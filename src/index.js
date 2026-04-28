require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const completeOrder = require('./commands/completeOrder');

const PREFIX = process.env.PREFIX || '!';
const COMPLETED_ORDERS_CHANNEL_ID = process.env.COMPLETED_ORDERS_CHANNEL_ID || '';
const FEEDBACK_CHANNEL_ID = process.env.FEEDBACK_CHANNEL_ID || '';
const SERVICES_CHANNEL_ID = process.env.SERVICES_CHANNEL_ID || '';
const SERVICES_CHANNEL_LABEL = process.env.SERVICES_CHANNEL_LABEL || '🛒 Explore all services:';
const CREATE_ORDER_CHANNEL_ID = process.env.CREATE_ORDER_CHANNEL_ID || '';
const CREATE_ORDER_CHANNEL_LABEL = process.env.CREATE_ORDER_CHANNEL_LABEL || '🎫 Start a new order:';
const ORDER_COMPLETE_TOP_IMAGE_URL = process.env.ORDER_COMPLETE_TOP_IMAGE_URL || '';
const FEEDBACK_VOUCHES_URL = process.env.FEEDBACK_VOUCHES_URL || '';

function parseRoleNames(value, fallback) {
  return String(value || fallback)
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

const COMPLETE_ALLOWED_ROLE_NAMES = parseRoleNames(
  process.env.COMPLETE_ALLOWED_ROLES,
  'worker,support,admin,manager,founder,owner,administration',
);
const DELETE_ALLOWED_ROLE_NAMES = parseRoleNames(
  process.env.DELETE_ALLOWED_ROLES,
  'support,administration,founder,owner,admin,manager',
);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

function memberHasRole(member, allowedRoles) {
  const memberRoles = member?.roles?.cache?.map((role) => role.name.toLowerCase()) || [];
  return allowedRoles.some((roleName) => memberRoles.includes(roleName));
}

function buildFeedbackButtons(workerIdsRaw) {
  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`feedback_submit:${workerIdsRaw}`)
        .setLabel('⭐ Submit Review')
        .setStyle(ButtonStyle.Primary),
    ),
  ];

  if (FEEDBACK_VOUCHES_URL) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('🎟 Sythe Vouch')
          .setStyle(ButtonStyle.Link)
          .setURL(FEEDBACK_VOUCHES_URL),
      ),
    );
  }

  return rows;
}

async function handleFeedback(message) {
  if (!memberHasRole(message.member, COMPLETE_ALLOWED_ROLE_NAMES)) {
    return message.reply('You do not have permission to use this command.');
  }

  if (!message.mentions.users.size) {
    return message.reply('Use: `!f @worker` or `!f @worker1 @worker2 @worker3`');
  }

  const workers = [...message.mentions.users.values()];
  const workerIds = workers.map((user) => user.id);
  const guildIcon = message.guild?.iconURL({ size: 256 }) || null;

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle('💎 Order Completed GRINDORA SERVICES 💎')
    .setDescription('Your order has been successfully delivered! ✅')
    .setThumbnail(ORDER_COMPLETE_TOP_IMAGE_URL || guildIcon || null)
    .addFields(
      {
        name: '🔒 Account Safety Reminder',
        value:
          '```diff\n' +
          '- Change your account password immediately\n' +
          '- Log out of all active Jagex Launcher sessions\n' +
          '- Check your linked accounts in Jagex settings\n' +
          '```',
        inline: false,
      },
      {
        name: '💬 Need more support or want another service?',
        value: "We're always here to help you maximize your account's potential.",
        inline: false,
      },
      {
        name: 'Links',
        value:
          `${SERVICES_CHANNEL_LABEL} ${SERVICES_CHANNEL_ID ? `<#${SERVICES_CHANNEL_ID}>` : '`Not set`'}\n` +
          `${CREATE_ORDER_CHANNEL_LABEL} ${CREATE_ORDER_CHANNEL_ID ? `<#${CREATE_ORDER_CHANNEL_ID}>` : '`Not set`'}`,
        inline: false,
      },
    )
    .setFooter({
      text: `Feedback workers: ${workerIds.join(',')}`,
      iconURL: guildIcon || undefined,
    })
    .setTimestamp();

  return message.reply({
    embeds: [embed],
    components: buildFeedbackButtons(workerIds.join(',')),
  });
}

async function handleDeleteComplete(message) {
  if (!COMPLETED_ORDERS_CHANNEL_ID || message.channelId !== COMPLETED_ORDERS_CHANNEL_ID) return;
  if (!message.reference?.messageId) return;

  const targetMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
  if (!targetMessage) return;
  if (targetMessage.author.id !== client.user.id) return;

  const embed = targetMessage.embeds?.[0];
  if (!embed || embed.author?.name !== 'Complete Order') return;

  const footerText = embed.footer?.text || '';
  if (!footerText.startsWith('Completed by: ')) return;

  const ownerId = footerText.replace('Completed by: ', '').trim();
  const isOwner = ownerId === message.author.id;
  const hasStaffDeleteRole = memberHasRole(message.member, DELETE_ALLOWED_ROLE_NAMES);

  if (!isOwner && !hasStaffDeleteRole) return;

  await targetMessage.delete().catch(() => {});
  await message.delete().catch(() => {});
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot || !message.guild || !message.content.startsWith(PREFIX)) return;

    const raw = message.content.slice(PREFIX.length).trim();
    if (!raw) return;

    const parts = raw.split(/\s+/);
    const command = (parts.shift() || '').toLowerCase();

    if (command === 'f') return await handleFeedback(message, parts);
    if (command === 'd') return await handleDeleteComplete(message);
  } catch (error) {
    console.error('Message command error:', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'complete-order') {
        return await completeOrder.execute(interaction);
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('feedback_submit:')) {
        const workerIdsRaw = interaction.customId.split(':')[1];

        const modal = new ModalBuilder()
          .setCustomId(`feedback_modal:${workerIdsRaw}`)
          .setTitle('Submit Review');

        const reviewInput = new TextInputBuilder()
          .setCustomId('review_text')
          .setLabel('Write your review')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);

        const showNameInput = new TextInputBuilder()
          .setCustomId('show_name')
          .setLabel('Do you want your name to appear?')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('yes or no')
          .setMaxLength(10);

        modal.addComponents(
          new ActionRowBuilder().addComponents(reviewInput),
          new ActionRowBuilder().addComponents(showNameInput),
        );

        return await interaction.showModal(modal);
      }

      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('feedback_modal:')) {
        const workerIdsRaw = interaction.customId.split(':')[1];
        const reviewText = interaction.fields.getTextInputValue('review_text');
        const showNameRaw = interaction.fields.getTextInputValue('show_name') || '';
        const showName = showNameRaw.trim().toLowerCase() === 'yes';

        const feedbackChannel = await interaction.guild.channels.fetch(FEEDBACK_CHANNEL_ID).catch(() => null);
        if (!feedbackChannel || !feedbackChannel.isTextBased()) {
          return await interaction.reply({
            content: 'Feedback channel is invalid or inaccessible.',
            ephemeral: true,
          });
        }

        const workerIds = workerIdsRaw.split(',').map((x) => x.trim()).filter(Boolean);
        const workerMentions = workerIds.map((id) => `<@${id}>`).join(', ');
        const guildIcon = interaction.guild?.iconURL({ size: 256 }) || null;

        const feedbackEmbed = new EmbedBuilder()
          .setColor(0xf59e0b)
          .setTitle('⭐ New Feedback Received ⭐')
          .addFields(
            {
              name: 'Review',
              value: `\`\`\`\n${reviewText}\n\`\`\``,
              inline: false,
            },
            {
              name: 'Rating',
              value: '⭐⭐⭐⭐⭐',
              inline: false,
            },
            {
              name: 'Customer',
              value: showName ? `<@${interaction.user.id}>` : 'Hidden',
              inline: false,
            },
            {
              name: 'Worked by',
              value: workerMentions || 'Not set',
              inline: false,
            },
          )
          .setThumbnail(ORDER_COMPLETE_TOP_IMAGE_URL || guildIcon || null)
          .setTimestamp();

        await feedbackChannel.send({ embeds: [feedbackEmbed] });

        return await interaction.reply({
          content: '✅ Your review has been submitted successfully.',
          ephemeral: true,
        });
      }

      return;
    }
  } catch (error) {
    console.error('Interaction error:', error);

    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp({
        content: 'Something went wrong while running this action.',
        ephemeral: true,
      }).catch(() => {});
    }

    return await interaction.reply({
      content: 'Something went wrong while running this action.',
      ephemeral: true,
    }).catch(() => {});
  }
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

client.login(process.env.DISCORD_TOKEN);
