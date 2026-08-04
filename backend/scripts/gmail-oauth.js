// Generate a Gmail OAuth2 refresh token so the backend can send email via the
// Gmail API (works on Render, where outbound SMTP is blocked).
//
// Prerequisites (done in the Google Cloud Console):
//   1. Create a project, enable the Gmail API.
//   2. Configure the OAuth consent screen (External) and add the Gmail account
//      that will SEND the emails as a "Test user".
//   3. Create an OAuth Client ID with Application type "Desktop app".
//
// Usage:
//   1. Put GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env, then run:
//        node scripts/gmail-oauth.js
//   2. Open the printed URL in a browser, sign in as the SENDING Gmail account,
//      click Allow, and copy the authorization code from the address bar.
//   3. Paste the code here — the script prints GOOGLE_REFRESH_TOKEN. Add that
//      plus GOOGLE_USER_EMAIL (<sending account>) to .env / Render.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

(async () => {
  const clientId = process.env.GOOGLE_CLIENT_ID || await ask('GOOGLE_CLIENT_ID: ');
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || await ask('GOOGLE_CLIENT_SECRET: ');

  const scope = 'https://www.googleapis.com/auth/gmail.send';
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: 'http://localhost',
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope,
    });

  console.log('\n1) Open this URL in your browser (sign in as the SENDING Gmail account, click Allow):\n');
  console.log(authUrl + '\n');
  console.log('2) After "This site can\'t be reached" appears, copy the whole "code=..." value');
  console.log('   from the address bar (up to the "&scope=" part).\n');

  const code = await ask('Paste the authorization code: ');

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost',
    }),
  });
  if (!resp.ok) {
    console.error('\nToken exchange failed:', await resp.text());
    process.exit(1);
  }
  const data = await resp.json();
  if (!data.refresh_token) {
    console.error('\nNo refresh_token returned. Make sure you signed in as the SENDING account and the consent screen is set to External.');
    process.exit(1);
  }
  console.log('\nSuccess! Add these to backend/.env (and to Render -> Environment):\n');
  console.log('GOOGLE_REFRESH_TOKEN=' + data.refresh_token);
  console.log('GOOGLE_USER_EMAIL=<the Gmail account you signed in with>\n');
  rl.close();
})().catch((e) => { console.error(e); process.exit(1); });
