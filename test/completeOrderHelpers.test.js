const test = require('node:test');
const assert = require('node:assert/strict');

const {
  IMAGE_OPTION_NAMES,
  buildCompleteOrderFooterText,
  buildDurableFiles,
  collectImageAttachments,
  fetchAttachmentBuffer,
  isImageAttachment,
  parseCompleteOrderOwnerId,
} = require('../src/utils/completeOrderHelpers');

test('complete order image options expand to 10 entries', () => {
  assert.equal(IMAGE_OPTION_NAMES.length, 10);
  assert.equal(IMAGE_OPTION_NAMES[0], 'image');
  assert.equal(IMAGE_OPTION_NAMES[9], 'image_10');
});

test('complete order owner id parser supports new and legacy footer text', () => {
  assert.equal(parseCompleteOrderOwnerId(buildCompleteOrderFooterText('12345')), '12345');
  assert.equal(parseCompleteOrderOwnerId('Completed by: 98765'), '98765');
  assert.equal(parseCompleteOrderOwnerId('Feedback workers: 111,222'), null);
});

test('collectImageAttachments preserves option order and skips empty slots', () => {
  const attachmentsByName = {
    image: { name: 'one.png', contentType: 'image/png', url: 'https://example.com/one.png' },
    image_3: { name: 'three.jpg', contentType: 'image/jpeg', url: 'https://example.com/three.jpg' },
    image_10: { name: 'ten.webp', contentType: 'image/webp', url: 'https://example.com/ten.webp' },
  };

  const attachments = collectImageAttachments((optionName) => attachmentsByName[optionName] || null);

  assert.deepEqual(
    attachments.map((attachment) => attachment.name),
    ['one.png', 'three.jpg', 'ten.webp'],
  );
});

test('image attachment validator accepts common image sources', () => {
  assert.equal(isImageAttachment({ name: 'proof.png', contentType: 'image/png' }), true);
  assert.equal(isImageAttachment({ name: 'proof.webp', contentType: null }), true);
  assert.equal(isImageAttachment({ name: 'notes.txt', contentType: 'text/plain' }), false);
});

test('fetchAttachmentBuffer returns a node buffer', async () => {
  const buffer = await fetchAttachmentBuffer('https://example.com/image.png', async () => ({
    ok: true,
    arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
  }));

  assert.equal(Buffer.isBuffer(buffer), true);
  assert.deepEqual([...buffer], [1, 2, 3]);
});

test('buildDurableFiles renames files consistently', async () => {
  const files = await buildDurableFiles(
    [
      { name: 'proof-one.png', url: 'https://example.com/one.png' },
      { name: 'proof-two.jpg', url: 'https://example.com/two.jpg' },
    ],
    async () => ({
      ok: true,
      arrayBuffer: async () => Uint8Array.from([9, 9]).buffer,
    }),
  );

  assert.deepEqual(
    files.map((file) => file.name),
    ['complete-order-1.png', 'complete-order-2.jpg'],
  );
});
