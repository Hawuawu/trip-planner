import os from 'node:os';
import path from 'node:path';

export const credentialsFile = path.join(os.homedir(), '.japan-companion-mcp', 'credentials.json');

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(
      `Missing required environment variable ${name}. Set it via ` +
        `'claude mcp add --env ${name}=... -- npx -y @hawuawu/japan-companion-mcp' — see README.md.`
    );
  }
  return val;
}

export const firebaseConfig = {
  apiKey: requireEnv('FIREBASE_API_KEY'),
  authDomain: requireEnv('FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('FIREBASE_PROJECT_ID'),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: requireEnv('FIREBASE_APP_ID'),
};

// Google's token endpoint currently still requires a client_secret for
// "TVs and Limited Input devices" OAuth clients even though the device
// flow doesn't rely on it being kept confidential the way a web-app
// secret would be — see deviceAuth.ts.
export const googleOAuthClientId = requireEnv('GOOGLE_OAUTH_CLIENT_ID');
export const googleOAuthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
