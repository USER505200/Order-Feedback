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
const { registerCommands } = require('./registerCommands');
const {
  FEEDBACK_BUTTON_ID,
  buildFeedbackFooterText,
  buildFeedbackModalId,
  parseFeedbackModalMessageId,
  parseFeedbackWorkerIds,
} = require('./utils/feedbackState');
const {
  claimFeedbackSubmission,
  createFeedbackSubmissionKey,
  releaseFeedbackSubmission,
} = require('./utils/feedbackSubmissionLock');
const {
  COMPLETE_ORDER_AUTHOR_NAME,
  parseCompleteOrderOwnerId,
} = require('./utils/completeOrderHelpers');
const { sendSytheVouchMessage, startSytheEmailSync } = require('./sytheEmailSync');

const PREFIX = process.env.PREFIX || '!';
const COMPLETED_ORDERS_CHANNEL_ID = process.env.COMPLETED_ORDERS_CHANNEL_ID || '';
const FEEDBACK_CHANNEL_ID = process.env.FEEDBACK_CHANNEL_ID || '';
const SERVICES_CHANNEL_ID = process.env.SERVICES_CHANNEL_ID || '';
const SERVICES_CHANNEL_LABEL = process.env.SERVICES_CHANNEL_LABEL || 'Explore all services:';
const CREATE_ORDER_CHANNEL_ID = process.env.CREATE_ORDER_CHANNEL_ID || '';
const CREATE_ORDER_CHANNEL_LABEL = process.env.CREATE_ORDER_CHANNEL_LABEL || 'Start a new order:';
const ORDER_COMPLETE_TOP_IMAGE_URL = process.env.ORDER_COMPLETE_TOP_IMAGE_URL || '';
const FEEDBACK_BANNER_URL = process.env.FEEDBACK_BANNER_URL || '';
const SYTHE_VOUCHES_THREAD_URL = process.env.SYTHE_VOUCHES_THREAD_URL || '';

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

function buildFeedbackButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(FEEDBACK_BUTTON_ID)
        .setLabel('⭐ Submit Review')
        .setStyle(ButtonStyle.Primary),
    ),
  ];
}

function parsePipeSegments(value) {
  return String(value || '')
    .split('|')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

async function handleManualSytheVouch(message, rawArgs) {
  const allowedRoles = parseRoleNames(
    process.env.SYTHE_SYNC_ALLOWED_ROLES,
    'support,administration,founder,owner,admin,manager',
  );

  if (!memberHasRole(message.member, allowedRoles)) {
    return message.reply('You do not have permission to use this command.');
  }

  const segments = parsePipeSegments(rawArgs);
  if (segments.length < 2) {
    return message.reply(
      'Use: `!sythemanual username | vouch text | thread url (optional)`',
    );
  }

  const [authorName, vouchText, threadUrl = SYTHE_VOUCHES_THREAD_URL] = segments;
  const defaultThreadTitle =
    process.env.SYTHE_VOUCHES_THREAD_TITLE || 'Grindora Vouches | OSRS Services | Trusted & Fast';
  const imageAttachment = message.attachments.find((attachment) =>
    String(attachment.contentType || '').toLowerCase().startsWith('image/'),
  );

  await sendSytheVouchMessage({
    client,
    parsedMessage: {
      authorName,
      vouchText,
      threadTitle: defaultThreadTitle,
      threadUrl,
      avatarUrl: imageAttachment?.url || '',
      internalDate: Date.now(),
    },
  });

  return message.reply('✅ Manual Sythe vouch sent successfully.');
}

async function handleFeedback(message) {
  if (!memberHasRole(message.member, COMPLETE_ALLOWED_ROLE_NAMES)) {
    return message.reply('You do not have permission to use this command.');
  }

  if (!message.mentions.users.size) {
    return message.reply('Use: `!f @worker @worker2 @worker3 ...`');
  }

  const workers = [...message.mentions.users.values()];
  const workerIds = workers.map((user) => user.id);
  const guildIcon = message.guild?.iconURL({ size: 256 }) || null;
  const linkLines = [
    `${SERVICES_CHANNEL_LABEL} ${SERVICES_CHANNEL_ID ? `<#${SERVICES_CHANNEL_ID}>` : '`Not set`'}`,
    `${CREATE_ORDER_CHANNEL_LABEL} ${CREATE_ORDER_CHANNEL_ID ? `<#${CREATE_ORDER_CHANNEL_ID}>` : '`Not set`'}`,
  ];

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle('💎 Grindora Services Order Complete')
    .setDescription('Your order has been successfully delivered! ✅')
    .setThumbnail(ORDER_COMPLETE_TOP_IMAGE_URL || guildIcon || undefined)
    .setImage(FEEDBACK_BANNER_URL || undefined)
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
        name: '💬 Enjoying your boost?',
        value:
          "If your account got boosted by Grindora, don't forget to leave us your feedback.\n" +
          'Thanks for doing business with Grindora Services.\n' +
          "We're always here to help you grind rares, upgrades, and achievements safely.",
        inline: false,
      },
      {
        name: '🛒 Need more support or want another service?',
        value: "We're always here to help you maximize your account's potential.",
        inline: false,
      },
      {
        name: '🔗 Links',
        value: linkLines.join('\n'),
        inline: false,
      },
    )
    .setFooter({
      text: buildFeedbackFooterText(workerIds),
      iconURL: guildIcon || undefined,
    })
    .setTimestamp();

  return message.reply({
    embeds: [embed],
    components: buildFeedbackButtons(),
  });
}

async function handleDeleteComplete(message) {
  if (!COMPLETED_ORDERS_CHANNEL_ID || message.channelId !== COMPLETED_ORDERS_CHANNEL_ID) return;
  if (!message.reference?.messageId) return;

  const targetMessage = await message.channel.messages
    .fetch(message.reference.messageId)
    .catch(() => null);
  if (!targetMessage) return;
  if (targetMessage.author.id !== client.user.id) return;

  const embed = targetMessage.embeds?.[0];
  if (!embed || embed.author?.name !== COMPLETE_ORDER_AUTHOR_NAME) return;

  const ownerId = parseCompleteOrderOwnerId(embed.footer?.text || '');
  if (!ownerId) return;

  const isOwner = ownerId === message.author.id;
  const hasStaffDeleteRole = memberHasRole(message.member, DELETE_ALLOWED_ROLE_NAMES);

  if (!isOwner && !hasStaffDeleteRole) return;

  await targetMessage.delete().catch(() => {});
  await message.delete().catch(() => {});
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  startSytheEmailSync(readyClient);
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot || !message.guild || !message.content.startsWith(PREFIX)) return;

    const raw = message.content.slice(PREFIX.length).trim();
    if (!raw) return;

    const parts = raw.split(/\s+/);
    const command = (parts.shift() || '').toLowerCase();
    const rawArgs = raw.slice(command.length).trim();

    if (command === 'f') return await handleFeedback(message);
    if (command === 'd') return await handleDeleteComplete(message);
    if (command === 'sythemanual' || command === 'sythesend') {
      return await handleManualSytheVouch(message, rawArgs);
    }
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
      if (
        interaction.customId === FEEDBACK_BUTTON_ID ||
        interaction.customId.startsWith('feedback_submit:')
      ) {
        const modal = new ModalBuilder()
          .setCustomId(buildFeedbackModalId(interaction.message.id))
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
      const sourceMessageId = parseFeedbackModalMessageId(interaction.customId);
      if (sourceMessageId) {
        const reviewText = interaction.fields.getTextInputValue('review_text');
        const showNameRaw = interaction.fields.getTextInputValue('show_name') || '';
        const showName = showNameRaw.trim().toLowerCase() === 'yes';
        const submissionKey = createFeedbackSubmissionKey({
          sourceMessageId,
          userId: interaction.user.id,
          reviewText,
          showName,
        });

        if (!claimFeedbackSubmission(submissionKey)) {
          return await interaction
            .reply({
              content: 'Your review is already being processed. Please wait a moment.',
              ephemeral: true,
            })
            .catch(() => {});
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          const feedbackChannel = await interaction.guild.channels
            .fetch(FEEDBACK_CHANNEL_ID)
            .catch(() => null);
          if (!feedbackChannel || !feedbackChannel.isTextBased()) {
            releaseFeedbackSubmission(submissionKey);
            return await interaction.editReply({
              content: 'Feedback channel is invalid or inaccessible.',
            });
          }

          const sourceMessage = await interaction.channel?.messages
            .fetch(sourceMessageId)
            .catch(() => null);
          const workerIds = parseFeedbackWorkerIds(sourceMessage?.embeds?.[0]?.footer?.text || '');
          if (!workerIds.length) {
            releaseFeedbackSubmission(submissionKey);
            return await interaction.editReply({
              content: 'Could not read the worker list from the feedback message.',
            });
          }

          const workerMentions = workerIds.map((id) => `<@${id}>`).join(', ');
          const guildIcon = interaction.guild?.iconURL({ size: 256 }) || null;

          const feedbackEmbed = new EmbedBuilder()
            .setColor(0xdc2626)
            .setTitle('⭐ New Feedback Received')
            .addFields(
              {
                name: '📝 Review',
                value: `\`\`\`\n${reviewText}\n\`\`\``,
                inline: false,
              },
              {
                name: '💎 Rating',
                value: '⭐⭐⭐⭐⭐',
                inline: false,
              },
              {
                name: '👤 Customer',
                value: showName ? `<@${interaction.user.id}>` : 'Hidden',
                inline: false,
              },
              {
                name: '🛠️ Worked by',
                value: workerMentions || 'Not set',
                inline: false,
              },
            )
            .setThumbnail(ORDER_COMPLETE_TOP_IMAGE_URL || guildIcon || undefined)
            .setImage(FEEDBACK_BANNER_URL || undefined)
            .setTimestamp();

          await feedbackChannel.send({ embeds: [feedbackEmbed] });

          return await interaction.editReply({
            content: '✅ Your review has been submitted successfully.',
          });
        } catch (modalError) {
          releaseFeedbackSubmission(submissionKey);
          throw modalError;
        }
      }

      return;
    }
  } catch (error) {
    console.error('Interaction error:', error);

    if (interaction.replied || interaction.deferred) {
      return await interaction
        .followUp({
          content: 'Something went wrong while running this action.',
          ephemeral: true,
        })
        .catch(() => {});
    }

    return await interaction
      .reply({
        content: 'Something went wrong while running this action.',
        ephemeral: true,
      })
      .catch(() => {});
  }
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

async function main() {
  await registerCommands();
  await client.login(process.env.DISCORD_TOKEN);
}

main().catch((error) => {
  console.error('Startup error:', error);
  process.exit(1);
});
