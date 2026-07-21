import { describe, it, expect } from 'vitest';
import type { AuthBlockingEvent } from 'firebase-functions/v2/identity';
import { getDb } from './firebaseAdmin';
import { stampAppAccess } from './authGate';

type GateResponse = { customClaims: { appAccess: boolean } };

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function signInEvent(email?: string, displayName?: string): AuthBlockingEvent {
  return { data: { email, displayName } } as unknown as AuthBlockingEvent;
}

// The BlockingFunction type doesn't declare run(), but the v2 identity
// provider attaches the raw handler to it at runtime.
const runGate = (event: AuthBlockingEvent) =>
  (
    stampAppAccess as unknown as {
      run: (e: AuthBlockingEvent) => Promise<GateResponse>;
    }
  ).run(event);

async function allowEmail(email: string) {
  await getDb().collection('allowedUsers').doc(email).set({
    invitedVia: 'seed',
    createdAt: new Date(),
  });
}

async function requestDoc(email: string) {
  return getDb().collection('accessRequests').doc(email).get();
}

async function requestLogEntries(email: string) {
  const snap = await getDb()
    .collection('appActivityLog')
    .where('type', '==', 'access_requested')
    .where('email', '==', email)
    .get();
  return snap.docs.map((d) => d.data());
}

describe('stampAppAccess', () => {
  it('grants the appAccess claim for an allowlisted email without recording a request', async () => {
    const email = uniqueEmail('allowed');
    await allowEmail(email);

    const response = await runGate(signInEvent(email));
    expect(response.customClaims).toEqual({ appAccess: true });
    expect((await requestDoc(email)).exists).toBe(false);
  });

  it('matches the allowlist case-insensitively and ignores whitespace', async () => {
    const email = uniqueEmail('mixed');
    await allowEmail(email);
    const response = await runGate(signInEvent(`  ${email.toUpperCase()}  `));
    expect(response.customClaims).toEqual({ appAccess: true });
  });

  it('denies the claim for an unknown email and records a pending access request + log entry', async () => {
    const email = uniqueEmail('newcomer');

    const response = await runGate(signInEvent(email, 'New Person'));
    expect(response.customClaims).toEqual({ appAccess: false });

    const request = (await requestDoc(email)).data()!;
    expect(request.status).toBe('pending');
    expect(request.displayName).toBe('New Person');

    expect(await requestLogEntries(email)).toHaveLength(1);
  });

  it('does not duplicate the request or log entry on repeat sign-ins', async () => {
    const email = uniqueEmail('repeat');
    await runGate(signInEvent(email));
    await runGate(signInEvent(email));

    expect((await requestDoc(email)).data()!.status).toBe('pending');
    expect(await requestLogEntries(email)).toHaveLength(1);
  });

  it('leaves a denied request denied on a later sign-in', async () => {
    const email = uniqueEmail('denied');
    await runGate(signInEvent(email));
    await getDb().collection('accessRequests').doc(email).update({ status: 'denied' });

    const response = await runGate(signInEvent(email));
    expect(response.customClaims).toEqual({ appAccess: false });
    expect((await requestDoc(email)).data()!.status).toBe('denied');
  });

  it('denies the claim for a sign-in without an email and records nothing', async () => {
    const response = await runGate(signInEvent(undefined));
    expect(response.customClaims).toEqual({ appAccess: false });
  });
});
