const { chromium } = require('playwright');
const { EmbedBuilder } = require('discord.js');
const {
  buildSytheFooterText,
  findLatestSyncedSythePostId,
} = require('./utils/sytheSyncState');
const {
  buildSythePageUrl,
  buildSytheThreadEmbed,
  dedupeSythePosts,
  normalizeSytheThreadUrl,
  sortSythePostsAscending,
  truncateDiscordField,
} = require('./utils/sytheThreadUtils');

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SYTHE_POST_SELECTOR =
  'article.message, article[data-content^="post-"], article[id^="js-post-"]';
const ZENROWS_API_URL = 'https://api.zenrows.com/v1/';

let sytheSyncInterval = null;
let runningSyncPromise = null;

function readBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return String(value).trim().toLowerCase() === 'true';
}

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getSytheConfig() {
  const threadUrl = normalizeSytheThreadUrl(process.env.SYTHE_VOUCHES_THREAD_URL || '');
  const channelId = String(process.env.SYTHE_VOUCHES_CHANNEL_ID || '').trim();
  const browserWsEndpoint = String(process.env.SYTHE_BROWSER_WS_ENDPOINT || '').trim();
  const useLocalBrowser = readBoolean(process.env.SYTHE_USE_LOCAL_BROWSER, false);

  return {
    enabled:
      readBoolean(process.env.SYTHE_SYNC_ENABLED, false) &&
      Boolean(threadUrl && channelId) &&
      Boolean(browserWsEndpoint || useLocalBrowser),
    threadUrl,
    channelId,
    browserWsEndpoint,
    useLocalBrowser,
    logoUrl: String(process.env.SYTHE_VOUCHES_LOGO_URL || process.env.ORDER_COMPLETE_TOP_IMAGE_URL || '').trim(),
    bannerUrl: String(process.env.SYTHE_VOUCHES_BANNER_URL || '').trim(),
    syncIntervalMs: readNumber(process.env.SYTHE_SYNC_INTERVAL_MS, 300000),
    postSendDelayMs: readNumber(process.env.SYTHE_POST_SEND_DELAY_MS, 1200),
    backfillLimit: readNumber(process.env.SYTHE_BACKFILL_LIMIT, 0),
    incrementalPageScanLimit: readNumber(process.env.SYTHE_INCREMENTAL_PAGE_SCAN_LIMIT, 25),
    skipThreadStarter: readBoolean(process.env.SYTHE_SKIP_THREAD_STARTER, true),
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isZenRowsEndpoint(endpoint) {
  return /browser\.zenrows\.com/i.test(String(endpoint || '').trim());
}

function isCloudflareChallengeText(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return Boolean(
    normalized &&
      /(just a moment|checking your browser|verify you are human|attention required|cf-challenge|cloudflare)/i.test(
        normalized,
      ),
  );
}

function summarizeText(value, maxLength = 240) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return '';
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
    : normalized;
}

function buildSytheBaseHref(pageUrl) {
  const normalizedUrl = normalizeSytheThreadUrl(pageUrl);
  if (!normalizedUrl) {
    return 'https://www.sythe.org/';
  }

  const match = normalizedUrl.match(/^(.*)\/page-\d+$/i);
  const baseUrl = match ? match[1] : normalizedUrl;
  return `${baseUrl.replace(/\/+$/, '')}/`;
}

function extractZenRowsApiSettings(browserWsEndpoint) {
  if (!isZenRowsEndpoint(browserWsEndpoint)) {
    return null;
  }

  try {
    const parsed = new URL(browserWsEndpoint);
    const apiKey = parsed.searchParams.get('apikey');
    if (!apiKey) {
      return null;
    }

    return {
      apiKey: apiKey.trim(),
      proxyCountry: String(parsed.searchParams.get('proxy_country') || '').trim(),
      proxyRegion: String(parsed.searchParams.get('proxy_region') || '').trim(),
    };
  } catch {
    return null;
  }
}

function buildZenRowsApiRequestUrl(targetUrl, browserWsEndpoint) {
  const settings =
    typeof browserWsEndpoint === 'string'
      ? extractZenRowsApiSettings(browserWsEndpoint)
      : browserWsEndpoint;

  if (!settings?.apiKey) {
    return '';
  }

  const requestUrl = new URL(ZENROWS_API_URL);
  requestUrl.searchParams.set('url', targetUrl);
  requestUrl.searchParams.set('apikey', settings.apiKey);
  requestUrl.searchParams.set('js_render', 'true');
  requestUrl.searchParams.set('premium_proxy', 'true');
  requestUrl.searchParams.set('wait_for', SYTHE_POST_SELECTOR);
  requestUrl.searchParams.set('original_status', 'true');

  if (settings.proxyCountry) {
    requestUrl.searchParams.set('proxy_country', settings.proxyCountry);
  }

  if (settings.proxyRegion) {
    requestUrl.searchParams.set('proxy_region', settings.proxyRegion);
  }

  return requestUrl.toString();
}

async function inspectSythePage(page) {
  return page.evaluate((postSelector) => {
    const title = document.title || '';
    const bodyText = document.body?.innerText || document.body?.textContent || '';
    const articleCount = document.querySelectorAll(postSelector).length;

    return {
      title,
      bodySnippet: bodyText.replace(/\s+/g, ' ').trim().slice(0, 400),
      articleCount,
      hasPosts: articleCount > 0,
      currentUrl: window.location.href,
    };
  }, SYTHE_POST_SELECTOR);
}

function buildSythePageLoadError(snapshot, prefix) {
  const title = snapshot?.title ? ` title="${snapshot.title}"` : '';
  const url = snapshot?.currentUrl ? ` url="${snapshot.currentUrl}"` : '';
  const snippet = snapshot?.bodySnippet ? ` body="${snapshot.bodySnippet}"` : '';
  return new Error(`${prefix}.${title}${url}${snippet}`.trim());
}

async function waitForSythePosts(page, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const snapshot = await inspectSythePage(page).catch(() => null);

    if (snapshot?.hasPosts) {
      return snapshot;
    }

    if (
      isCloudflareChallengeText(snapshot?.title) ||
      isCloudflareChallengeText(snapshot?.bodySnippet)
    ) {
      throw buildSythePageLoadError(
        snapshot,
        'Sythe is still showing a Cloudflare challenge. Use a remote anti-bot browser endpoint in SYTHE_BROWSER_WS_ENDPOINT',
      );
    }

    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  const snapshot = await inspectSythePage(page).catch(() => null);
  throw buildSythePageLoadError(
    snapshot,
    'Timed out while waiting for Sythe posts to load',
  );
}

async function gotoSytheThreadPage(page, url) {
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });

  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await waitForSythePosts(page, 120000);
}

async function readLastPageNumber(page) {
  return page.evaluate(() => {
    const values = new Set([1]);
    const currentMatch = window.location.pathname.match(/\/page-(\d+)$/i);
    if (currentMatch) {
      values.add(Number(currentMatch[1]));
    }

    for (const anchor of document.querySelectorAll('a[href]')) {
      const href = anchor.getAttribute('href') || '';
      const absoluteUrl = new URL(href, document.baseURI || window.location.origin).toString();
      const match = absoluteUrl.match(/\/page-(\d+)$/i);
      if (match) {
        values.add(Number(match[1]));
      }

      const textValue = Number((anchor.textContent || '').trim());
      if (Number.isFinite(textValue) && textValue > 0) {
        values.add(textValue);
      }
    }

    return Math.max(...values);
  });
}

async function readPostsFromCurrentPage(page, { skipFirstPost }) {
  return page.evaluate(({ skipFirstPost: shouldSkipFirstPost }) => {
    function cleanText(element) {
      if (!element) return '';

      const clone = element.cloneNode(true);
      clone
        .querySelectorAll(
          'blockquote, .bbCodeBlock--quote, .message-lastEdit, .signature, script, style',
        )
        .forEach((node) => node.remove());

      return (clone.innerText || clone.textContent || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
    }

    function getAbsoluteUrl(element) {
      const href = element?.getAttribute('href');
      if (!href) return '';
      return new URL(href, document.baseURI || window.location.origin).toString();
    }

    const articles = Array.from(document.querySelectorAll('article.message, article[data-content^="post-"], article[id^="js-post-"]'));

    return articles
      .map((article, index) => {
        const contentId = article.getAttribute('data-content') || '';
        const articleId = article.getAttribute('id') || '';
        const permalinkElement =
          article.querySelector('a[href*="/posts/"]') ||
          article.querySelector('a[href*="#post-"]') ||
          article.querySelector('.message-attribution-main a[href]');
        const permalinkUrl = getAbsoluteUrl(permalinkElement);

        const postId =
          Number((contentId.match(/post-(\d+)/i) || [])[1]) ||
          Number((articleId.match(/post-(\d+)/i) || [])[1]) ||
          Number((permalinkUrl.match(/posts\/(\d+)/i) || [])[1]) ||
          Number((permalinkUrl.match(/post-(\d+)/i) || [])[1]) ||
          0;

        const authorElement =
          article.querySelector('.message-name') ||
          article.querySelector('a.username') ||
          article.querySelector('.message-userDetails a[href*="/members/"]');

        const timeElement = article.querySelector('time');
        const bodyElement =
          article.querySelector('.message-userContent .bbWrapper') ||
          article.querySelector('.bbWrapper');

        return {
          id: postId,
          author: (authorElement?.textContent || '').trim(),
          bodyText: cleanText(bodyElement),
          permalinkUrl,
          postedAtIso: timeElement?.getAttribute('datetime') || '',
          postedAtLabel: (timeElement?.textContent || '').trim(),
          index,
        };
      })
      .filter((post) => post.id && post.author && post.bodyText)
      .filter((post) => !(shouldSkipFirstPost && post.index === 0));
  }, { skipFirstPost });
}

async function withLocalBrowser(task) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    return await task(browser);
  } finally {
    await browser.close().catch(() => {});
  }
}

async function parseSytheHtmlSnapshot(html, pageUrl, { skipFirstPost }) {
  return withLocalBrowser(async (browser) => {
    const context = await browser.newContext({
      userAgent: DEFAULT_USER_AGENT,
      viewport: { width: 1440, height: 1200 },
    });
    const page = await context.newPage();
    const contentWithBase = `<base href="${buildSytheBaseHref(pageUrl)}">${html}`;

    await page.setContent(contentWithBase, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });

    const snapshot = await inspectSythePage(page);
    if (
      isCloudflareChallengeText(snapshot.title) ||
      isCloudflareChallengeText(snapshot.bodySnippet)
    ) {
      throw buildSythePageLoadError(
        snapshot,
        'ZenRows API returned a Cloudflare challenge page instead of the Sythe thread',
      );
    }

    if (!snapshot.hasPosts) {
      throw buildSythePageLoadError(
        snapshot,
        'ZenRows API returned HTML without any Sythe post elements',
      );
    }

    const lastPageNumber = await readLastPageNumber(page);
    const posts = await readPostsFromCurrentPage(page, { skipFirstPost });

    await context.close();
    return { lastPageNumber, posts };
  });
}

async function fetchSythePageWithZenRowsApi(targetUrl, browserWsEndpoint) {
  const requestUrl = buildZenRowsApiRequestUrl(targetUrl, browserWsEndpoint);
  if (!requestUrl) {
    throw new Error('ZenRows API fallback is unavailable because the browser endpoint is missing a valid apikey.');
  }

  const response = await fetch(requestUrl, {
    headers: {
      'user-agent': DEFAULT_USER_AGENT,
    },
  });

  const html = await response.text();
  if (!response.ok) {
    throw new Error(
      `ZenRows API request failed with status ${response.status}. ${summarizeText(html)}`,
    );
  }

  return html;
}

function buildPageNumbers(lastPageNumber, lastSyncedPostId, incrementalPageScanLimit) {
  const pageNumbers = [];

  if (!lastSyncedPostId) {
    for (let pageNumber = 1; pageNumber <= lastPageNumber; pageNumber += 1) {
      pageNumbers.push(pageNumber);
    }
    return pageNumbers;
  }

  const minPageNumber = Math.max(1, lastPageNumber - incrementalPageScanLimit + 1);
  for (let pageNumber = minPageNumber; pageNumber <= lastPageNumber; pageNumber += 1) {
    pageNumbers.push(pageNumber);
  }

  return pageNumbers;
}

function finalizeSythePosts(posts, config, lastSyncedPostId) {
  let finalPosts = dedupeSythePosts(sortSythePostsAscending(posts));
  if (lastSyncedPostId) {
    finalPosts = finalPosts.filter((post) => post.id > lastSyncedPostId);
  } else if (config.backfillLimit > 0) {
    finalPosts = finalPosts.slice(-config.backfillLimit);
  }

  return finalPosts;
}

async function scrapeSythePostsViaBrowser(config, lastSyncedPostId) {
  const browser = config.browserWsEndpoint
    ? isZenRowsEndpoint(config.browserWsEndpoint)
      ? await chromium.connectOverCDP(config.browserWsEndpoint)
      : await chromium.connect(config.browserWsEndpoint)
    : await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

  try {
    const context =
      browser.contexts?.()[0] ||
      await browser.newContext({
        userAgent: DEFAULT_USER_AGENT,
        viewport: { width: 1440, height: 1200 },
      });
    const page = await context.newPage();

    await gotoSytheThreadPage(page, config.threadUrl);
    const lastPageNumber = await readLastPageNumber(page);
    const pageNumbers = buildPageNumbers(
      lastPageNumber,
      lastSyncedPostId,
      config.incrementalPageScanLimit,
    );

    const posts = [];
    for (const pageNumber of pageNumbers) {
      const targetUrl = buildSythePageUrl(config.threadUrl, pageNumber);
      if (page.url() !== targetUrl) {
        await gotoSytheThreadPage(page, targetUrl);
      }

      const pagePosts = await readPostsFromCurrentPage(page, {
        skipFirstPost: config.skipThreadStarter && pageNumber === 1,
      });
      posts.push(...pagePosts);
    }

    await context.close();
    return finalizeSythePosts(posts, config, lastSyncedPostId);
  } finally {
    await browser.close().catch(() => {});
  }
}

async function scrapeSythePostsViaZenRowsApi(config, lastSyncedPostId) {
  const firstPageUrl = buildSythePageUrl(config.threadUrl, 1);
  const firstPageHtml = await fetchSythePageWithZenRowsApi(firstPageUrl, config.browserWsEndpoint);
  const firstSnapshot = await parseSytheHtmlSnapshot(firstPageHtml, firstPageUrl, {
    skipFirstPost: config.skipThreadStarter,
  });

  const pageNumbers = buildPageNumbers(
    firstSnapshot.lastPageNumber,
    lastSyncedPostId,
    config.incrementalPageScanLimit,
  );

  const posts = [];
  for (const pageNumber of pageNumbers) {
    const targetUrl = buildSythePageUrl(config.threadUrl, pageNumber);
    const pageHtml =
      pageNumber === 1
        ? firstPageHtml
        : await fetchSythePageWithZenRowsApi(targetUrl, config.browserWsEndpoint);
    const snapshot =
      pageNumber === 1 && pageNumbers.includes(1)
        ? firstSnapshot
        : await parseSytheHtmlSnapshot(pageHtml, targetUrl, {
            skipFirstPost: config.skipThreadStarter && pageNumber === 1,
          });
    posts.push(...snapshot.posts);
  }

  return finalizeSythePosts(posts, config, lastSyncedPostId);
}

async function scrapeSythePosts(config, lastSyncedPostId) {
  try {
    return await scrapeSythePostsViaBrowser(config, lastSyncedPostId);
  } catch (browserError) {
    const hasZenRowsFallback = Boolean(extractZenRowsApiSettings(config.browserWsEndpoint));
    if (!hasZenRowsFallback) {
      throw browserError;
    }

    console.warn(
      `[sythe-sync] browser scrape failed, trying ZenRows API fallback: ${browserError.message}`,
    );

    try {
      return await scrapeSythePostsViaZenRowsApi(config, lastSyncedPostId);
    } catch (fallbackError) {
      fallbackError.message = `${fallbackError.message} | Browser failure: ${browserError.message}`;
      throw fallbackError;
    }
  }
}

function createSytheEmbed(post, config) {
  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`⭐ ${truncateDiscordField(post.author, 180)} left a Sythe vouch`)
    .setURL(post.permalinkUrl || config.threadUrl)
    .setThumbnail(config.logoUrl || undefined)
    .addFields(
      {
        name: '📅 Date',
        value: truncateDiscordField(buildSytheThreadEmbed(post).dateLabel, 1024),
        inline: true,
      },
      {
        name: '👤 Sythe User',
        value: truncateDiscordField(post.author, 1024),
        inline: true,
      },
      {
        name: '📝 Vouch',
        value: truncateDiscordField(post.bodyText, 1024),
        inline: false,
      },
      {
        name: '🔗 Thread',
        value: `[View Vouch](${post.permalinkUrl || config.threadUrl})`,
        inline: false,
      },
    )
    .setFooter({
      text: buildSytheFooterText(post.id),
      iconURL: config.logoUrl || undefined,
    })
    .setTimestamp(post.postedAtIso ? new Date(post.postedAtIso) : new Date());

  if (config.bannerUrl) {
    embed.setImage(config.bannerUrl);
  }

  return embed;
}

async function sendSythePosts(channel, posts, config) {
  let sentCount = 0;

  for (const post of posts) {
    await channel.send({
      embeds: [createSytheEmbed(post, config)],
    });
    sentCount += 1;

    if (config.postSendDelayMs > 0) {
      await wait(config.postSendDelayMs);
    }
  }

  return sentCount;
}

async function runSytheVouchSync(client, reason = 'manual') {
  if (runningSyncPromise) {
    return runningSyncPromise;
  }

  runningSyncPromise = (async () => {
    const config = getSytheConfig();
    if (!config.enabled) {
      return { sentCount: 0, skipped: true, reason: 'disabled' };
    }

    const channel = await client.channels.fetch(config.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      throw new Error('SYTHE_VOUCHES_CHANNEL_ID is invalid or inaccessible.');
    }

    const lastSyncedPostId = await findLatestSyncedSythePostId(channel, client.user?.id);
    const posts = await scrapeSythePosts(config, lastSyncedPostId);

    if (!posts.length) {
      console.log(`[sythe-sync] ${reason}: no new posts found.`);
      return { sentCount: 0, skipped: false, reason };
    }

    const sentCount = await sendSythePosts(channel, posts, config);
    console.log(`[sythe-sync] ${reason}: sent ${sentCount} post(s).`);
    return { sentCount, skipped: false, reason };
  })();

  try {
    return await runningSyncPromise;
  } finally {
    runningSyncPromise = null;
  }
}

async function startSytheVouchSync(client) {
  const config = getSytheConfig();
  if (!config.enabled) {
    console.log('[sythe-sync] disabled or missing configuration.');
    return;
  }

  if (sytheSyncInterval) {
    return;
  }

  void runSytheVouchSync(client, 'startup').catch((error) => {
    console.error('[sythe-sync] startup error:', error);
  });

  sytheSyncInterval = setInterval(() => {
    void runSytheVouchSync(client, 'interval').catch((error) => {
      console.error('[sythe-sync] interval error:', error);
    });
  }, config.syncIntervalMs);

  sytheSyncInterval.unref?.();
}

module.exports = {
  buildSytheBaseHref,
  buildZenRowsApiRequestUrl,
  extractZenRowsApiSettings,
  getSytheConfig,
  isCloudflareChallengeText,
  isZenRowsEndpoint,
  runSytheVouchSync,
  startSytheVouchSync,
};
