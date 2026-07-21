const SYTHE_POST_ID_PREFIX = 'Grindora Services • Sythe Post ID: ';

function buildSytheFooterText(postId) {
  return `${SYTHE_POST_ID_PREFIX}${String(postId || '').trim()}`;
}

function parseSythePostId(footerText) {
  const raw = String(footerText || '').trim();
  if (!raw.startsWith(SYTHE_POST_ID_PREFIX)) {
    return null;
  }

  const postId = Number(raw.slice(SYTHE_POST_ID_PREFIX.length).trim());
  return Number.isFinite(postId) && postId > 0 ? postId : null;
}

async function findLatestSyncedSythePostId(channel, botUserId) {
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!messages) {
    return null;
  }

  for (const message of messages.values()) {
    if (botUserId && message.author?.id !== botUserId) {
      continue;
    }

    const footerText = message.embeds?.[0]?.footer?.text || '';
    const postId = parseSythePostId(footerText);
    if (postId) {
      return postId;
    }
  }

  return null;
}

module.exports = {
  SYTHE_POST_ID_PREFIX,
  buildSytheFooterText,
  findLatestSyncedSythePostId,
  parseSythePostId,
};
