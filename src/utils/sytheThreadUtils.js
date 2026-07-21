function normalizeSytheThreadUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function buildSythePageUrl(threadUrl, pageNumber) {
  const normalizedUrl = normalizeSytheThreadUrl(threadUrl);
  if (!normalizedUrl) {
    return '';
  }

  if (!pageNumber || pageNumber <= 1) {
    return normalizedUrl;
  }

  return `${normalizedUrl}/page-${pageNumber}`;
}

function parseSythePageNumber(value) {
  const match = String(value || '').match(/\/page-(\d+)$/i);
  return match ? Number(match[1]) : 1;
}

function truncateDiscordField(value, maxLength = 1024) {
  const text = String(value || '').trim();
  if (!text) {
    return 'Not available';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function sortSythePostsAscending(posts) {
  return [...posts].sort((left, right) => left.id - right.id);
}

function dedupeSythePosts(posts) {
  const seenPostIds = new Set();
  const dedupedPosts = [];

  for (const post of posts) {
    if (!post?.id || seenPostIds.has(post.id)) {
      continue;
    }

    seenPostIds.add(post.id);
    dedupedPosts.push(post);
  }

  return dedupedPosts;
}

function buildSytheThreadEmbed(post) {
  const dateLabel = String(post?.postedAtLabel || '').trim();
  if (dateLabel) {
    return { dateLabel };
  }

  if (post?.postedAtIso) {
    return {
      dateLabel: new Date(post.postedAtIso).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    };
  }

  return { dateLabel: 'Not available' };
}

module.exports = {
  buildSythePageUrl,
  buildSytheThreadEmbed,
  dedupeSythePosts,
  normalizeSytheThreadUrl,
  parseSythePageNumber,
  sortSythePostsAscending,
  truncateDiscordField,
};
