const {
  buildSytheVouchEmbed,
  normalizeThreadUrl,
  parseSytheEmailMessage,
} = require('./utils/sytheVouchHelpers');

function parseBoolean(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function fetchGmailAccessToken() {
  const clientId = process.env.GMAIL_CLIENT_ID || '';
  const clientSecret = process.env.GMAIL_CLIENT_SECRET || '';
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN || '';

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, or GMAIL_REFRESH_TOKEN.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(`Failed to refresh Gmail access token: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

async function gmailRequest(accessToken, path, options = {}) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Gmail API request failed: ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
}

async function markMessageAsRead(accessToken, userEmail, messageId) {
  await gmailRequest(accessToken, `users/${encodeURIComponent(userEmail)}/messages/${messageId}/modify`, {
    method: 'POST',
    body: JSON.stringify({
      removeLabelIds: ['UNREAD'],
    }),
  });
}

function buildGmailQuery() {
  return (
    process.env.SYTHE_EMAIL_SYNC_QUERY ||
    'from:sythe@sythe.org is:unread'
  );
}

async function fetchUnreadSytheMessages(accessToken, userEmail) {
  const query = encodeURIComponent(buildGmailQuery());
  const result = await gmailRequest(
    accessToken,
    `users/${encodeURIComponent(userEmail)}/messages?q=${query}&maxResults=25`,
  );

  return result.messages || [];
}

async function sendSytheVouchMessage({ client, parsedMessage }) {
  const channelId = process.env.SYTHE_VOUCHES_CHANNEL_ID || '';
  if (!channelId) {
    throw new Error('SYTHE_VOUCHES_CHANNEL_ID is missing.');
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    throw new Error('SYTHE_VOUCHES_CHANNEL_ID is invalid or inaccessible.');
  }

  const logoUrl =
    process.env.SYTHE_VOUCHES_LOGO_URL ||
    process.env.ORDER_COMPLETE_TOP_IMAGE_URL ||
    '';
  const bannerUrl =
    process.env.SYTHE_VOUCHES_BANNER_URL ||
    process.env.FEEDBACK_BANNER_URL ||
    '';

  const embed = buildSytheVouchEmbed({
    EmbedBuilder: require('discord.js').EmbedBuilder,
    authorName: parsedMessage.authorName,
    vouchText: parsedMessage.vouchText,
    threadTitle: parsedMessage.threadTitle,
    threadUrl: parsedMessage.threadUrl,
    sentAt: parsedMessage.internalDate,
    logoUrl,
    bannerUrl,
    avatarUrl: parsedMessage.avatarUrl,
  });

  await channel.send({ embeds: [embed] });
}

function isTargetThread(threadUrl) {
  const targetThreadUrl = process.env.SYTHE_VOUCHES_THREAD_URL || '';
  if (!targetThreadUrl) {
    return true;
  }

  const normalizedThreadUrl = normalizeThreadUrl(threadUrl);
  const normalizedTargetUrl = normalizeThreadUrl(targetThreadUrl);

  return (
    normalizedThreadUrl === normalizedTargetUrl ||
    normalizedThreadUrl.startsWith(`${normalizedTargetUrl}/`)
  );
}

async function syncSytheEmailsOnce(client) {
  const userEmail = process.env.GMAIL_USER_EMAIL || '';
  if (!userEmail) {
    throw new Error('GMAIL_USER_EMAIL is missing.');
  }

  const accessToken = await fetchGmailAccessToken();
  const unreadMessages = await fetchUnreadSytheMessages(accessToken, userEmail);
  console.log(`[sythe-email-sync] found ${unreadMessages.length} unread Sythe message(s).`);

  for (const item of unreadMessages) {
    try {
      const message = await gmailRequest(
        accessToken,
        `users/${encodeURIComponent(userEmail)}/messages/${item.id}?format=full`,
      );
      const parsedMessage = parseSytheEmailMessage(message);

      if (!parsedMessage.threadUrl || !isTargetThread(parsedMessage.threadUrl)) {
        console.warn(
          `[sythe-email-sync] kept unread: thread URL did not match. ` +
            `subject=${JSON.stringify(parsedMessage.subject)} url=${JSON.stringify(parsedMessage.threadUrl)}`,
        );
        continue;
      }

      if (!parsedMessage.authorName || !parsedMessage.vouchText) {
        console.warn(
          `[sythe-email-sync] kept unread: parser could not find enough data. ` +
            `subject=${JSON.stringify(parsedMessage.subject)} author=${JSON.stringify(parsedMessage.authorName)}`,
        );
        continue;
      }

      await sendSytheVouchMessage({ client, parsedMessage });
      await markMessageAsRead(accessToken, userEmail, item.id);
      console.log(`[sythe-email-sync] sent vouch from ${parsedMessage.authorName}.`);
    } catch (error) {
      console.error('[sythe-email-sync] message processing error:', error);
    }
  }
}

function startSytheEmailSync(client) {
  if (!parseBoolean(process.env.SYTHE_EMAIL_SYNC_ENABLED)) {
    console.log('[sythe-email-sync] disabled.');
    return;
  }

  const intervalMs = parsePositiveInteger(process.env.SYTHE_EMAIL_SYNC_INTERVAL_MS, 300000);

  const run = async () => {
    try {
      await syncSytheEmailsOnce(client);
    } catch (error) {
      console.error('[sythe-email-sync] sync error:', error);
    }
  };

  run().catch(() => {});
  setInterval(run, intervalMs);
  console.log(`[sythe-email-sync] enabled. Polling every ${intervalMs}ms.`);
}

module.exports = {
  sendSytheVouchMessage,
  startSytheEmailSync,
  syncSytheEmailsOnce,
};
