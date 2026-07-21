const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SYTHE_POST_ID_PREFIX,
  buildSytheFooterText,
  parseSythePostId,
} = require('../src/utils/sytheSyncState');

test('builds and parses Sythe footer post ids', () => {
  const footerText = buildSytheFooterText(12345678);

  assert.equal(footerText, `${SYTHE_POST_ID_PREFIX}12345678`);
  assert.equal(parseSythePostId(footerText), 12345678);
});

test('rejects unrelated footer text', () => {
  assert.equal(parseSythePostId('Completed by: 12345'), null);
});
