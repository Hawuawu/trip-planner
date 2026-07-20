import { describe, it, expect } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { getDb, getAdminAuth } from './firebaseAdmin';
import { ADMIN_EMAIL } from './adminConfig';
import { createAppInvite, redeemAppInvite, cancelAppInvite, revokeAppAccess } from './appInvites';

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

async function createInvite(): Promise<string> {
  const { token } = await createAppInvite.run(asAdmin({}));
  return token;
}

async function activityEntries(field: 'email' | 'token', value: string) {
  const snap = await getDb().collection('appActivityLog').where(field, '==', value).get();
  return snap.docs.map((d) => d.data());
}

describe('createAppInvite', () => {
  it('rejects unauthenticated and non-admin callers', async () => {
    await expect(createAppInvite.run(callableRequest({}))).rejects.toThrow(/admin/);
    await expect(createAppInvite.run(callableRequest({}, uniqueEmail('peon')))).rejects.toThrow(
      /admin/
    );
  });

  it('creates a pending invite and logs it', async () => {
    const token = await createInvite();

    const invite = (await getDb().collection('invites').doc(token).get()).data()!;
    expect(invite.status).toBe('pending');
    expect(invite.redeemedEmail).toBeNull();
    expect(invite.createdByEmail).toBe(ADMIN_EMAIL);

    const log = await activityEntries('token', token);
    expect(log.map((e) => e.type)).toContain('invite_created');
  });
});

describe('redeemAppInvite', () => {
  it('redeems a pending invite: marks it, allowlists the email, logs it', async () => {
    const token = await createInvite();
    const email = uniqueEmail('invitee');

    await redeemAppInvite.run(callableRequest({ token, email: `  ${email.toUpperCase()}  ` }));

    const invite = (await getDb().collection('invites').doc(token).get()).data()!;
    expect(invite.status).toBe('redeemed');
    expect(invite.redeemedEmail).toBe(email);

    const allowed = await getDb().collection('allowedUsers').doc(email).get();
    expect(allowed.exists).toBe(true);
    expect(allowed.data()!.invitedVia).toBe(token);

    const log = await activityEntries('email', email);
    expect(log.map((e) => e.type)).toContain('invite_redeemed');
  });

  it('is idempotent for a same-email retry', async () => {
    const token = await createInvite();
    const email = uniqueEmail('retry');
    await redeemAppInvite.run(callableRequest({ token, email }));
    await expect(redeemAppInvite.run(callableRequest({ token, email }))).resolves.toBeUndefined();
  });

  it('rejects a second redemption with a different email', async () => {
    const token = await createInvite();
    await redeemAppInvite.run(callableRequest({ token, email: uniqueEmail('first') }));
    await expect(
      redeemAppInvite.run(callableRequest({ token, email: uniqueEmail('second') }))
    ).rejects.toThrow(/already been used/);
  });

  it('rejects an unknown token', async () => {
    await expect(
      redeemAppInvite.run(callableRequest({ token: uniqueId('ghost'), email: uniqueEmail('x') }))
    ).rejects.toThrow(/not valid/);
  });

  it('rejects a cancelled invite', async () => {
    const token = await createInvite();
    await cancelAppInvite.run(asAdmin({ token }));
    await expect(
      redeemAppInvite.run(callableRequest({ token, email: uniqueEmail('late') }))
    ).rejects.toThrow(/no longer active/);
  });

  it('rejects a malformed email', async () => {
    const token = await createInvite();
    await expect(
      redeemAppInvite.run(callableRequest({ token, email: 'not-an-email' }))
    ).rejects.toThrow(/valid email/);
  });
});

describe('cancelAppInvite', () => {
  it('rejects non-admin callers', async () => {
    const token = await createInvite();
    await expect(
      cancelAppInvite.run(callableRequest({ token }, uniqueEmail('peon')))
    ).rejects.toThrow(/admin/);
  });

  it('cancels a pending invite and logs it', async () => {
    const token = await createInvite();
    await cancelAppInvite.run(asAdmin({ token }));

    const invite = (await getDb().collection('invites').doc(token).get()).data()!;
    expect(invite.status).toBe('cancelled');

    const log = await activityEntries('token', token);
    expect(log.map((e) => e.type)).toContain('invite_cancelled');
  });

  it('refuses to cancel a redeemed invite', async () => {
    const token = await createInvite();
    await redeemAppInvite.run(callableRequest({ token, email: uniqueEmail('done') }));
    await expect(cancelAppInvite.run(asAdmin({ token }))).rejects.toThrow(/pending/);
  });
});

describe('revokeAppAccess', () => {
  async function allowEmail(email: string) {
    await getDb().collection('allowedUsers').doc(email).set({
      invitedVia: 'seed',
      createdAt: new Date(),
    });
  }

  it('rejects non-admin callers', async () => {
    await expect(
      revokeAppAccess.run(callableRequest({ email: uniqueEmail('victim') }, uniqueEmail('peon')))
    ).rejects.toThrow(/admin/);
  });

  it('refuses to revoke the admin itself', async () => {
    await expect(revokeAppAccess.run(asAdmin({ email: ADMIN_EMAIL }))).rejects.toThrow(
      /cannot be revoked/
    );
  });

  it('deletes the allowlist entry, revokes sessions of an existing auth user, and logs it', async () => {
    const email = uniqueEmail('revoked');
    await allowEmail(email);
    const user = await getAdminAuth().createUser({ uid: uniqueId('uid'), email });
    const before = (await getAdminAuth().getUser(user.uid)).tokensValidAfterTime;

    await new Promise((r) => setTimeout(r, 1100)); // tokensValidAfterTime has 1s resolution
    await revokeAppAccess.run(asAdmin({ email }));

    expect((await getDb().collection('allowedUsers').doc(email).get()).exists).toBe(false);
    const after = (await getAdminAuth().getUser(user.uid)).tokensValidAfterTime;
    expect(after).not.toBe(before);

    const log = await activityEntries('email', email);
    expect(log.map((e) => e.type)).toContain('access_revoked');
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
