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

test('parseSytheEmailMessage extracts author without recipient prefix', () => {
  const html = `
    <html>
      <body>
        <div>Apollo has replied to a thread you are watching at Sell &amp; Trade Game Items.</div>
        <h1>Grindora Vouches | OSRS Services | Trusted &amp; Fast</h1>
        <div>Fast and safe service.</div>
        <a href="https://www.sythe.org/threads/grindora-vouches-osrs-services-trusted-fast/unread">View This Thread</a>
      </body>
    </html>
  `;

  const message = {
    payload: {
      headers: [
        {
          name: 'Subject',
          value: 'Grindora Vouches | OSRS Services | Trusted & Fast - New reply to watched thread',
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

  assert.equal(parsed.authorName, 'Apollo');
  assert.equal(parsed.vouchText, 'Fast and safe service.');
});

test('parseSytheEmailMessage extracts only the posted message from plain text template', () => {
  const plainText = `
Ghost ss,
Pazzo replied to a thread you are watching at Sell & Trade Game Items.
Grindora Vouches | OSRS Services | Trusted & Fast
This is the message they posted:
--------------------------------
--
ty they doing great services they are fast tbh i give them my vouch
--------------------------------
--
To view this thread, click here:
You will not receive any further emails about this thread until you have read the new messages.
To disable emails from this thread:
To unsubscribe click: <http://email.sythe.org/unsubscribe>
  `;

  const message = {
    payload: {
      headers: [
        {
          name: 'Subject',
          value: 'Grindora Vouches | OSRS Services | Trusted & Fast - New reply to watched thread',
        },
      ],
      parts: [
        {
          mimeType: 'text/plain',
          body: {
            data: Buffer.from(plainText, 'utf8')
              .toString('base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/g, ''),
          },
        },
        {
          mimeType: 'text/html',
          body: {
            data: Buffer.from(
              '<a href="https://www.sythe.org/threads/grindora-vouches-osrs-services-trusted-fast/unread">View This Thread</a>',
              'utf8',
            )
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

  assert.equal(parsed.authorName, 'Pazzo');
  assert.equal(
    parsed.vouchText,
    'ty they doing great services they are fast tbh i give them my vouch',
  );
});
