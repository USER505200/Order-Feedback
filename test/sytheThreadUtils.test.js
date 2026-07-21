const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSythePageUrl,
  buildSytheThreadEmbed,
  dedupeSythePosts,
  normalizeSytheThreadUrl,
  parseSythePageNumber,
  sortSythePostsAscending,
  truncateDiscordField,
} = require('../src/utils/sytheThreadUtils');

test('normalizes Sythe thread URLs and builds page URLs', () => {
  const threadUrl = normalizeSytheThreadUrl('https://www.sythe.org/threads/example-thread///');

  assert.equal(threadUrl, 'https://www.sythe.org/threads/example-thread');
  assert.equal(buildSythePageUrl(threadUrl, 1), threadUrl);
  assert.equal(buildSythePageUrl(threadUrl, 3), `${threadUrl}/page-3`);
});

test('parses page number from page URL suffix', () => {
  assert.equal(parseSythePageNumber('https://www.sythe.org/threads/example/page-7'), 7);
  assert.equal(parseSythePageNumber('https://www.sythe.org/threads/example'), 1);
});

test('truncates long Discord field values safely', () => {
  const value = truncateDiscordField('a'.repeat(1030), 20);
  assert.equal(value, 'aaaaaaaaaaaaaaaaa...');
});

test('sorts and deduplicates Sythe posts by post id', () => {
  const posts = dedupeSythePosts(
    sortSythePostsAscending([
      { id: 5, bodyText: 'five' },
      { id: 2, bodyText: 'two' },
      { id: 5, bodyText: 'duplicate-five' },
      { id: 9, bodyText: 'nine' },
    ]),
  );

  assert.deepEqual(
    posts.map((post) => post.id),
    [2, 5, 9],
  );
});

test('builds a readable date label for Sythe embeds', () => {
  assert.equal(
    buildSytheThreadEmbed({ postedAtLabel: 'July 20, 2026 at 8:00 PM' }).dateLabel,
    'July 20, 2026 at 8:00 PM',
  );

  assert.match(
    buildSytheThreadEmbed({ postedAtIso: '2026-07-20T20:00:00.000Z' }).dateLabel,
    /2026/,
  );
});
