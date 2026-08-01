require('dotenv').config();

const http = require('node:http');
const crypto = require('node:crypto');

const HOST = '127.0.0.1';
const PORT = 43015;
const REDIRECT_URI = `http://${HOST}:${PORT}/oauth2callback`;
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';

function buildAuthUrl(state) {
  const clientId = process.env.GMAIL_CLIENT_ID || '';

  if (!clientId) {
    throw new Error('GMAIL_CLIENT_ID is missing in .env');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: GMAIL_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const clientId = process.env.GMAIL_CLIENT_ID || '';
  const clientSecret = process.env.GMAIL_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    throw new Error('GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET is missing in .env');
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  }

  return data;
}

async function main() {
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = buildAuthUrl(state);

  console.log('');
  console.log('1) افتح الرابط ده في المتصفح وسجّل دخولك بنفس Gmail الخاص بـ Sythe:');
  console.log(authUrl);
  console.log('');
  console.log(`2) بعد الموافقة، جوجل هيرجعك أوتوماتيك على ${REDIRECT_URI}`);
  console.log('3) سيب التيرمنال مفتوح لحد ما يظهرلك الـ refresh token.');
  console.log('');

  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url, REDIRECT_URI);
      if (requestUrl.pathname !== '/oauth2callback') {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }

      const returnedState = requestUrl.searchParams.get('state');
      const code = requestUrl.searchParams.get('code');
      const error = requestUrl.searchParams.get('error');

      if (error) {
        res.statusCode = 400;
        res.end(`Authorization failed: ${error}`);
        server.close();
        return;
      }

      if (returnedState !== state || !code) {
        res.statusCode = 400;
        res.end('Invalid OAuth state or missing code.');
        server.close();
        return;
      }

      const tokens = await exchangeCodeForTokens(code);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<h2>تم بنجاح ✅</h2><p>ارجع للتيرمنال وخد الـ refresh token.</p>');

      console.log('');
      console.log('انسخ القيمة دي وحطها في .env أو Railway Variables:');
      console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token || ''}`);
      console.log('');
      console.log('ولو حبيت تتأكد، دي صلاحيات التوكن الحالي:');
      console.log(`scope=${tokens.scope || ''}`);
      console.log('');

      server.close();
    } catch (error) {
      res.statusCode = 500;
      res.end(`Internal error: ${error.message}`);
      console.error(error);
      server.close();
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`Waiting for Google OAuth callback on ${REDIRECT_URI}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
