import { googleOAuthClientId, googleOAuthClientSecret } from '../config.js';

const DEVICE_CODE_ENDPOINT = 'https://oauth2.googleapis.com/device/code';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPES = ['openid', 'email', 'profile'];

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_url?: string;
  verification_uri?: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  id_token?: string;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// OAuth 2.0 device authorization grant (RFC 8628) — the flow gcloud's `gcloud
// auth login --no-launch-browser` and similar headless CLIs use. No local
// HTTP listener: the server prints a short code and a URL, the user opens
// that URL on *any* device/browser and enters the code, and this process
// polls Google's token endpoint until it's authorized. Still OAuth, still a
// per-user credential bound by the same Firestore rules everyone else is —
// just a different way of directing the user through Google's consent
// screen than the localhost-redirect ("loopback") flow.
export async function loginWithGoogle(): Promise<{ idToken: string }> {
  const deviceRes = await fetch(DEVICE_CODE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: googleOAuthClientId, scope: SCOPES.join(' ') }),
  });
  if (!deviceRes.ok) {
    throw new Error(`Google device-code request failed: ${deviceRes.status} ${await deviceRes.text()}`);
  }
  const device = (await deviceRes.json()) as DeviceCodeResponse;
  const verificationUrl = device.verification_url ?? device.verification_uri;

  console.error('\nTo sign in with Google, visit:');
  console.error(`  ${verificationUrl}`);
  console.error(`and enter this code: ${device.user_code}\n`);

  const deadline = Date.now() + device.expires_in * 1000;
  let intervalMs = Math.max(device.interval, 1) * 1000;

  while (Date.now() < deadline) {
    await sleep(intervalMs);

    const tokenBody = new URLSearchParams({
      client_id: googleOAuthClientId,
      device_code: device.device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
    // Same Google quirk as the loopback flow: token exchange for a "Desktop
    // app" OAuth client currently still expects client_secret even though
    // the credential isn't meaningfully confidential in an installed-app flow.
    if (googleOAuthClientSecret) tokenBody.set('client_secret', googleOAuthClientSecret);

    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    });
    const tokenJson = (await tokenRes.json()) as TokenResponse;

    if (tokenRes.ok && tokenJson.id_token) {
      return { idToken: tokenJson.id_token };
    }

    switch (tokenJson.error) {
      case 'authorization_pending':
        continue;
      case 'slow_down':
        intervalMs += 5000;
        continue;
      case 'access_denied':
        throw new Error('Google sign-in was denied.');
      case 'expired_token':
        throw new Error('The device code expired before sign-in was completed. Try again.');
      default:
        throw new Error(`Google token exchange failed: ${JSON.stringify(tokenJson)}`);
    }
  }

  throw new Error('Timed out waiting for Google sign-in to complete.');
}
