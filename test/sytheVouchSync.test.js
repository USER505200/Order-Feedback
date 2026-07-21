const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSytheBaseHref,
  buildZenRowsApiRequestUrl,
  extractZenRowsApiSettings,
  isCloudflareChallengeText,
  isZenRowsEndpoint,
} = require('../src/sytheVouchSync');

test('detects ZenRows browser endpoints for CDP mode', () => {
  assert.equal(
    isZenRowsEndpoint('wss://browser.zenrows.com?apikey=test-key'),
    true,
  );
  assert.equal(
    isZenRowsEndpoint('wss://production-sfo.browserless.io/chromium/playwright?token=test'),
    false,
  );
});

test('extracts ZenRows API settings from the websocket endpoint', () => {
  assert.deepEqual(
    extractZenRowsApiSettings(
      'wss://browser.zenrows.com?apikey=test-key&proxy_country=us&proxy_region=na',
    ),
    {
      apiKey: 'test-key',
      proxyCountry: 'us',
      proxyRegion: 'na',
    },
  );
});

test('builds a ZenRows API fallback request from the websocket endpoint', () => {
  const requestUrl = new URL(
    buildZenRowsApiRequestUrl(
      'https://www.sythe.org/threads/grindora-vouches-osrs-services-trusted-fast/',
      'wss://browser.zenrows.com?apikey=test-key&proxy_country=us',
    ),
  );

  assert.equal(requestUrl.origin, 'https://api.zenrows.com');
  assert.equal(requestUrl.pathname, '/v1/');
  assert.equal(
    requestUrl.searchParams.get('url'),
    'https://www.sythe.org/threads/grindora-vouches-osrs-services-trusted-fast/',
  );
  assert.equal(requestUrl.searchParams.get('apikey'), 'test-key');
  assert.equal(requestUrl.searchParams.get('js_render'), 'true');
  assert.equal(requestUrl.searchParams.get('premium_proxy'), 'true');
  assert.equal(requestUrl.searchParams.get('proxy_country'), 'us');
  assert.match(
    requestUrl.searchParams.get('wait_for'),
    /article\.message/,
  );
});

test('detects Cloudflare challenge copy', () => {
  assert.equal(isCloudflareChallengeText('Just a moment...'), true);
  assert.equal(isCloudflareChallengeText('Attention Required! | Cloudflare'), true);
  assert.equal(isCloudflareChallengeText('Regular forum thread title'), false);
});

test('builds a stable base href for Sythe page parsing', () => {
  assert.equal(
    buildSytheBaseHref('https://www.sythe.org/threads/grindora-vouches-osrs-services-trusted-fast'),
    'https://www.sythe.org/threads/grindora-vouches-osrs-services-trusted-fast/',
  );
  assert.equal(
    buildSytheBaseHref(
      'https://www.sythe.org/threads/grindora-vouches-osrs-services-trusted-fast/page-4',
    ),
    'https://www.sythe.org/threads/grindora-vouches-osrs-services-trusted-fast/',
  );
});
