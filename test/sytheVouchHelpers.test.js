const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeThreadUrl,
  parseSytheEmailMessage,
} = require('../src/utils/sytheVouchHelpers');

test('normalizeThreadUrl removes query hash and trailing slash', () => {
  assert.equal(
    normalizeThreadUrl('https://www.sythe.org/threads/grindora-vouches/?page=1#latest'),
    'https://www.sythe.org/threads/grindora-vouches',
  );
});

test('normalizeThreadUrl removes Sythe unread and pagination suffixes', () => {
  assert.equal(
    normalizeThreadUrl('https://www.sythe.org/threads/grindora-vouches/unread?new=1'),
    'https://www.sythe.org/threads/grindora-vouches',
  );
  assert.equal(
    normalizeThreadUrl('https://www.sythe.org/threads/grindora-vouches/page-2#post-10'),
    'https://www.sythe.org/threads/grindora-vouches',
  );
});

test('parseSytheEmailMessage extracts author, vouch, and thread url', () => {
  const html = `
    <html>
      <body>
        <div>Ghost ss, Grindora replied to a thread you are watching at Sell &amp; Trade Game Items | OSRS Gold | ELO.</div>
        <h1>⭐ Grindora Vouches ⭐ | OSRS Services | Trusted &amp; Fast</h1>
        <img src="https://example.com/avatar.png" />
        <div>thanks you :love:</div>
        <a href="https://www.sythe.org/threads/grindora-vouches-osrs-services-trusted-fast/">View This Thread</a>
      </body>
    </html>
  `;

  const message = {
    internalDate: String(Date.now()),
    payload: {
      headers: [
        {
          name: 'Subject',
          value: '⭐ Grindora Vouches ⭐ | OSRS Services | Trusted & Fast - New reply to watched thread',
        },
      ],
      parts: [
        {
          mimeType: 'text/html',
          body: {
            data: Buffer.from(html, 'utf8')
              .toString('base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/g, ''),
          },
        },
      ],
    },
  };

  const parsed = parseSytheEmailMessage(message);

  assert.equal(parsed.authorName, 'Grindora');
  assert.equal(parsed.vouchText, 'thanks you :love:');
  assert.equal(
    parsed.threadUrl,
    'https://www.sythe.org/threads/grindora-vouches-osrs-services-trusted-fast/',
  );
  assert.equal(parsed.avatarUrl, 'https://example.com/avatar.png');
});
