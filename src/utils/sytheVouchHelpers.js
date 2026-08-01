const SYTHE_VOUCH_AUTHOR_PATTERNS = [
  /,\s*([^,\n]+?)\s+replied to a thread you are watching\b/i,
  /,\s*([^,\n]+?)\s+posted in a thread you are watching\b/i,
  /,\s*([^,\n]+?)\s+quoted your post in the thread\b/i,
  /,\s*([^,\n]+?)\s+posted a message in the thread you are watching\b/i,
];

function decodeBase64Url(value) {
  const raw = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  if (!raw) {
    return '';
  }

  const padding = raw.length % 4 === 0 ? '' : '='.repeat(4 - (raw.length % 4));
  return Buffer.from(raw + padding, 'base64').toString('utf8');
}

function findHeader(payload, name) {
  const headers = payload?.headers || [];
  const header = headers.find((item) => item?.name?.toLowerCase() === String(name).toLowerCase());
  return header?.value || '';
}

function extractMessagePart(payload, mimeType) {
  if (!payload) {
    return '';
  }

  if (payload.mimeType === mimeType && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  for (const part of payload.parts || []) {
    const nested = extractMessagePart(part, mimeType);
    if (nested) {
      return nested;
    }
  }

  return '';
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, '/');
}

function stripHtml(value) {
  return decodeHtmlEntities(
    String(value || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  );
}

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function normalizeThreadUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) {
    return '';
  }

  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/+$/, '').toLowerCase();
  } catch {
    return raw.replace(/\/+$/, '').toLowerCase();
  }
}

function extractThreadUrlFromHtml(html) {
  const match = String(html || '').match(
    /<a[^>]+href="([^"]+)"[^>]*>\s*View This Thread\s*<\/a>/i,
  );
  return decodeHtmlEntities(match?.[1] || '');
}

function unwrapGoogleImageProxy(url) {
  const raw = String(url || '').trim();
  if (!raw) {
    return '';
  }

  try {
    const parsed = new URL(raw);
    const proxied = parsed.searchParams.get('url');
    return proxied ? decodeURIComponent(proxied) : raw;
  } catch {
    return raw;
  }
}

function extractAvatarUrlFromHtml(html) {
  const matches = [...String(html || '').matchAll(/<img[^>]+src="([^"]+)"[^>]*>/gi)];
  const urls = matches
    .map((match) => unwrapGoogleImageProxy(decodeHtmlEntities(match[1])))
    .filter(Boolean)
    .filter((url) => /^https?:\/\//i.test(url))
    .filter((url) => !/sythe\.org\/styles\//i.test(url))
    .filter((url) => !/googleusercontent\.com\/gmail/i.test(url));

  return urls[0] || '';
}

function getUsefulLines(text) {
  return normalizeWhitespace(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractAuthorName(lines) {
  const introLine = lines.find((line) =>
    /thread you are watching|quoted your post/i.test(line),
  );

  if (!introLine) {
    return '';
  }

  for (const pattern of SYTHE_VOUCH_AUTHOR_PATTERNS) {
    const match = introLine.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return '';
}

function removeBoilerplateLines(lines, threadTitle) {
  const normalizedTitle = String(threadTitle || '').trim().toLowerCase();

  return lines.filter((line) => {
    const lower = line.toLowerCase();
    if (!line) return false;
    if (normalizedTitle && lower === normalizedTitle) return false;
    if (/^sell & trade game items/i.test(line)) return false;
    if (/thread you are watching|quoted your post/i.test(line)) return false;
    if (/^view this thread$/i.test(line)) return false;
    if (/^unread watched threads$/i.test(line)) return false;
    if (/^please do not reply to this email/i.test(line)) return false;
    if (/^this message was sent to you because/i.test(line)) return false;
    if (/^if you no longer wish to receive/i.test(line)) return false;
    if (/^https?:\/\//i.test(line)) return false;
    return true;
  });
}

function extractVouchText(lines, threadTitle) {
  const cleanedLines = removeBoilerplateLines(lines, threadTitle);
  if (!cleanedLines.length) {
    return '';
  }

  const cutoffIndex = cleanedLines.findIndex((line) =>
    /^view this thread$/i.test(line) || /^please do not reply/i.test(line),
  );

  const bodyLines = cutoffIndex === -1 ? cleanedLines : cleanedLines.slice(0, cutoffIndex);
  return normalizeWhitespace(bodyLines.join('\n'));
}

function buildSytheVouchEmbed({
  EmbedBuilder,
  authorName,
  vouchText,
  threadTitle,
  threadUrl,
  sentAt,
  logoUrl,
  bannerUrl,
  avatarUrl,
}) {
  const embed = new EmbedBuilder()
    .setColor(0xdc2626)
    .setTitle('💎 Grindora Sythe Vouch')
    .setThumbnail(logoUrl || undefined)
    .setImage(bannerUrl || undefined)
    .addFields(
      {
        name: '👤 Vouched By',
        value: authorName || 'Unknown',
        inline: false,
      },
      {
        name: '📝 Review',
        value: `\`\`\`\n${vouchText || 'No text found.'}\n\`\`\``,
        inline: false,
      },
      {
        name: '🔗 View Thread',
        value: threadUrl ? `[Open Thread](${threadUrl})` : threadTitle || 'Not available',
        inline: false,
      },
    )
    .setTimestamp(sentAt ? new Date(sentAt) : new Date());

  if (avatarUrl) {
    embed.setAuthor({
      name: `${authorName || 'Unknown'} left a vouch`,
      iconURL: avatarUrl,
      url: threadUrl || undefined,
    });
  } else {
    embed.setAuthor({
      name: `${authorName || 'Unknown'} left a vouch`,
      url: threadUrl || undefined,
    });
  }

  if (threadTitle) {
    embed.setFooter({ text: threadTitle });
  }

  return embed;
}

function parseSytheEmailMessage(message) {
  const payload = message?.payload || {};
  const subject = findHeader(payload, 'Subject');
  const html = extractMessagePart(payload, 'text/html');
  const text = extractMessagePart(payload, 'text/plain') || stripHtml(html);
  const lines = getUsefulLines(text);
  const threadTitle = normalizeWhitespace(
    subject.replace(/\s*-\s*new reply to watched thread\s*$/i, ''),
  );
  const threadUrl = extractThreadUrlFromHtml(html);
  const authorName = extractAuthorName(lines);
  const vouchText = extractVouchText(lines, threadTitle);
  const avatarUrl = extractAvatarUrlFromHtml(html);

  return {
    subject,
    threadTitle,
    threadUrl,
    authorName,
    vouchText,
    avatarUrl,
    internalDate: Number(message?.internalDate || Date.now()),
    rawText: text,
  };
}

module.exports = {
  buildSytheVouchEmbed,
  decodeBase64Url,
  extractAvatarUrlFromHtml,
  extractThreadUrlFromHtml,
  findHeader,
  normalizeThreadUrl,
  parseSytheEmailMessage,
};
