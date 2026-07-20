import { describe, it, expect } from 'vitest';
import type { AuthBlockingEvent } from 'firebase-functions/v2/identity';
import { getDb } from './firebaseAdmin';
import { enforceAllowlist } from './authGate';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function signInEvent(email?: string): AuthBlockingEvent {
  return { data: { email } } as unknown as AuthBlockingEvent;
}

// The BlockingFunction type doesn't declare run(), but the v2 identity
// provider attaches the raw handler to it at runtime.
const runGate = (event: AuthBlockingEvent) =>
  (enforceAllowlist as unknown as { run: (e: AuthBlockingEvent) => Promise<unknown> }).run(event);

async function allowEmail(email: string) {
  await getDb().collection('allowedUsers').doc(email).set({
    invitedVia: 'seed',
    createdAt: new Date(),
  });
}

async function rejectionLogEntries(email: string) {
  const snap = await getDb()
    .collection('appActivityLog')
    .where('type', '==', 'sign_in_rejected')
    .where('email', '==', email)
    .get();
  return snap.docs.map((d) => d.data());
}

describe('enforceAllowlist', () => {
  it('resolves for an allowlisted email', async () => {
    const email = uniqueEmail('allowed');
    await allowEmail(email);
    await expect(runGate(signInEvent(email))).resolves.toBeUndefined();
  });

  it('rejects a non-allowlisted email and logs the attempt', async () => {
    const email = uniqueEmail('stranger');
    await expect(runGate(signInEvent(email))).rejects.toThrow(/invite-only/);

    const entries = await rejectionLogEntries(email);
    expect(entries).toHaveLength(1);
    expect(entries[0].actor).toBe('system');
  });

  it('matches the allowlist case-insensitively and ignores whitespace', async () => {
    const email = uniqueEmail('mixed');
    await allowEmail(email);
    await expect(runGate(signInEvent(`  ${email.toUpperCase()}  `))).resolves.toBeUndefined();
  });

  it('rejects a sign-in without an email', async () => {
    await expect(runGate(signInEvent(undefined))).rejects.toThrow(/email address is required/);
  });
});
