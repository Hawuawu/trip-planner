import { describe, it, expect } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { getDb, getAdminAuth } from './firebaseAdmin';
import { ADMIN_EMAIL } from './adminConfig';
import { approveAccess, denyAccess, revokeAppAccess } from './appAccess';

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueEmail(prefix: string) {
  return `${uniqueId(prefix)}@example.com`;
}

function callableRequest<T>(data: T, authEmail?: string): CallableRequest<T> {
  return {
    data,
    auth: authEmail ? { uid: uniqueId('uid'), token: { email: authEmail } } : undefined,
  } as unknown as CallableRequest<T>;
}

const asAdmin = <T>(data: T) => callableRequest(data, ADMIN_EMAIL);

async function seedRequest(email: string, status = 'pending') {
  await getDb().collection('accessRequests').doc(email).set({
    email,
    displayName: null,
    status,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
  });
}

async function activityEntries(email: string) {
  const snap = await getDb().collection('appActivityLog').where('email', '==', email).get();
  return snap.docs.map((d) => d.data());
}

describe('approveAccess', () => {
  it('rejects unauthenticated and non-admin callers', async () => {
    await expect(approveAccess.run(callableRequest({ email: 'a@b.com' }))).rejects.toThrow(/admin/);
    await expect(
      approveAccess.run(callableRequest({ email: 'a@b.com' }, uniqueEmail('peon')))
    ).rejects.toThrow(/admin/);
  });

  it('allowlists the email, marks the request approved, stamps the claim, and logs it', async () => {
    const email = uniqueEmail('approve');
    await seedRequest(email);
    const user = await getAdminAuth().createUser({ uid: uniqueId('uid'), email });

    await approveAccess.run(asAdmin({ email: `  ${email.toUpperCase()}  ` }));

    const allowed = await getDb().collection('allowedUsers').doc(email).get();
    expect(allowed.exists).toBe(true);
    expect(allowed.data()!.invitedVia).toBe('approved');

    const request = (await getDb().collection('accessRequests').doc(email).get()).data()!;
    expect(request.status).toBe('approved');

    expect((await getAdminAuth().getUser(user.uid)).customClaims).toEqual({ appAccess: true });
    expect((await activityEntries(email)).map((e) => e.type)).toContain('access_approved');
  });

  it('tolerates an email that has never signed in (no Auth record)', async () => {
    const email = uniqueEmail('preapprove');
    await expect(approveAccess.run(asAdmin({ email }))).resolves.toBeUndefined();
    expect((await getDb().collection('allowedUsers').doc(email).get()).exists).toBe(true);
  });
});

describe('denyAccess', () => {
  it('rejects non-admin callers', async () => {
    await expect(
      denyAccess.run(callableRequest({ email: uniqueEmail('x') }, uniqueEmail('peon')))
    ).rejects.toThrow(/admin/);
  });

  it('marks a pending request denied and logs it', async () => {
    const email = uniqueEmail('deny');
    await seedRequest(email);

    await denyAccess.run(asAdmin({ email }));

    expect((await getDb().collection('accessRequests').doc(email).get()).data()!.status).toBe(
      'denied'
    );
    expect((await activityEntries(email)).map((e) => e.type)).toContain('access_denied');
  });

  it('rejects when there is no request for the email', async () => {
    await expect(denyAccess.run(asAdmin({ email: uniqueEmail('ghost') }))).rejects.toThrow(
      /No access request/
    );
  });
});

describe('revokeAppAccess', () => {
  async function allowEmail(email: string) {
    await getDb().collection('allowedUsers').doc(email).set({
      invitedVia: 'approved',
      createdAt: new Date(),
    });
  }

  it('rejects non-admin callers and refuses to revoke the admin itself', async () => {
    await expect(
      revokeAppAccess.run(callableRequest({ email: uniqueEmail('x') }, uniqueEmail('peon')))
    ).rejects.toThrow(/admin/);
    await expect(revokeAppAccess.run(asAdmin({ email: ADMIN_EMAIL }))).rejects.toThrow(
      /cannot be revoked/
    );
  });

  it('deletes the allowlist entry, clears the claim, revokes tokens, and marks the request revoked', async () => {
    const email = uniqueEmail('revoke');
    await allowEmail(email);
    await seedRequest(email, 'approved');
    const user = await getAdminAuth().createUser({ uid: uniqueId('uid'), email });
    await getAdminAuth().setCustomUserClaims(user.uid, { appAccess: true });
    const before = (await getAdminAuth().getUser(user.uid)).tokensValidAfterTime;

    await new Promise((r) => setTimeout(r, 1100)); // tokensValidAfterTime has 1s resolution
    await revokeAppAccess.run(asAdmin({ email }));

    expect((await getDb().collection('allowedUsers').doc(email).get()).exists).toBe(false);

    const revokedUser = await getAdminAuth().getUser(user.uid);
    expect(revokedUser.customClaims).toEqual({ appAccess: false });
    expect(revokedUser.tokensValidAfterTime).not.toBe(before);

    expect((await getDb().collection('accessRequests').doc(email).get()).data()!.status).toBe(
      'revoked'
    );
    expect((await activityEntries(email)).map((e) => e.type)).toContain('access_revoked');
  });

  it('still revokes an allowlisted email that never signed in', async () => {
    const email = uniqueEmail('never');
    await allowEmail(email);
    await revokeAppAccess.run(asAdmin({ email }));
    expect((await getDb().collection('allowedUsers').doc(email).get()).exists).toBe(false);
  });

  it('rejects an email that is not allowlisted', async () => {
    await expect(revokeAppAccess.run(asAdmin({ email: uniqueEmail('ghost') }))).rejects.toThrow(
      /No allowed user/
    );
  });
});
