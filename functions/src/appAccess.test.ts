import { describe, it, expect } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { getDb, getAdminAuth } from './firebaseAdmin';
import { approveAccess, denyAccess, revokeAppAccess, setAdminRole } from './appAccess';

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueEmail(prefix: string) {
  return `${uniqueId(prefix)}@example.com`;
}

// authClaims is the decoded ID token: undefined means unauthenticated, {}
// means signed in with no admin claim, { admin: true } means an app admin.
function callableRequest<T>(data: T, authClaims?: Record<string, unknown>): CallableRequest<T> {
  return {
    data,
    auth: authClaims ? { uid: uniqueId('uid'), token: authClaims } : undefined,
  } as unknown as CallableRequest<T>;
}

const asAdmin = <T>(data: T) => callableRequest(data, { admin: true });
const asNonAdmin = <T>(data: T) => callableRequest(data, {});

async function seedRequest(email: string, status = 'pending') {
  await getDb().collection('accessRequests').doc(email).set({
    email,
    displayName: null,
    status,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
  });
}

async function allowEmail(email: string, role: 'admin' | 'member' = 'member') {
  await getDb().collection('allowedUsers').doc(email).set({
    invitedVia: 'approved',
    role,
    createdAt: new Date(),
  });
}

async function activityEntries(email: string) {
  const snap = await getDb().collection('appActivityLog').where('email', '==', email).get();
  return snap.docs.map((d) => d.data());
}

describe('approveAccess', () => {
  it('rejects unauthenticated and non-admin callers', async () => {
    await expect(approveAccess.run(callableRequest({ email: 'a@b.com' }))).rejects.toThrow(/admin/);
    await expect(approveAccess.run(asNonAdmin({ email: 'a@b.com' }))).rejects.toThrow(/admin/);
  });

  it('allowlists the email as a plain member, marks the request approved, stamps the claims, and logs it', async () => {
    const email = uniqueEmail('approve');
    await seedRequest(email);
    const user = await getAdminAuth().createUser({ uid: uniqueId('uid'), email });

    await approveAccess.run(asAdmin({ email: `  ${email.toUpperCase()}  ` }));

    const allowed = await getDb().collection('allowedUsers').doc(email).get();
    expect(allowed.exists).toBe(true);
    expect(allowed.data()!.invitedVia).toBe('approved');
    expect(allowed.data()!.role).toBe('member');

    const request = (await getDb().collection('accessRequests').doc(email).get()).data()!;
    expect(request.status).toBe('approved');

    expect((await getAdminAuth().getUser(user.uid)).customClaims).toEqual({
      appAccess: true,
      admin: false,
    });
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
    await expect(denyAccess.run(asNonAdmin({ email: uniqueEmail('x') }))).rejects.toThrow(/admin/);
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
  it('rejects non-admin callers', async () => {
    await expect(revokeAppAccess.run(asNonAdmin({ email: uniqueEmail('x') }))).rejects.toThrow(
      /admin/
    );
  });

  it('deletes the allowlist entry, clears the claims, revokes tokens, and marks the request revoked', async () => {
    const email = uniqueEmail('revoke');
    await allowEmail(email);
    await seedRequest(email, 'approved');
    const user = await getAdminAuth().createUser({ uid: uniqueId('uid'), email });
    await getAdminAuth().setCustomUserClaims(user.uid, { appAccess: true, admin: false });
    const before = (await getAdminAuth().getUser(user.uid)).tokensValidAfterTime;

    await new Promise((r) => setTimeout(r, 1100)); // tokensValidAfterTime has 1s resolution
    await revokeAppAccess.run(asAdmin({ email }));

    expect((await getDb().collection('allowedUsers').doc(email).get()).exists).toBe(false);

    const revokedUser = await getAdminAuth().getUser(user.uid);
    expect(revokedUser.customClaims).toEqual({ appAccess: false, admin: false });
    expect(revokedUser.tokensValidAfterTime).not.toBe(before);

    expect((await getDb().collection('accessRequests').doc(email).get()).data()!.status).toBe(
      'revoked'
    );
    expect((await activityEntries(email)).map((e) => e.type)).toContain('access_revoked');
  });

  it('still revokes an allowlisted member that never signed in', async () => {
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

  it('refuses to revoke the last remaining admin', async () => {
    const email = uniqueEmail('sole-admin');
    await allowEmail(email, 'admin');
    await expect(revokeAppAccess.run(asAdmin({ email }))).rejects.toThrow(/admin must remain/);
    expect((await getDb().collection('allowedUsers').doc(email).get()).exists).toBe(true);
  });

  it('allows revoking an admin when another admin remains', async () => {
    const admin1 = uniqueEmail('admin1');
    const admin2 = uniqueEmail('admin2');
    await allowEmail(admin1, 'admin');
    await allowEmail(admin2, 'admin');

    await revokeAppAccess.run(asAdmin({ email: admin1 }));

    expect((await getDb().collection('allowedUsers').doc(admin1).get()).exists).toBe(false);
    expect((await getDb().collection('allowedUsers').doc(admin2).get()).exists).toBe(true);
  });
});

describe('setAdminRole', () => {
  it('rejects non-admin callers', async () => {
    await expect(
      setAdminRole.run(asNonAdmin({ email: uniqueEmail('x'), isAdmin: true }))
    ).rejects.toThrow(/admin/);
  });

  it('rejects a non-boolean isAdmin', async () => {
    const email = uniqueEmail('bad');
    await allowEmail(email);
    await expect(
      setAdminRole.run(asAdmin({ email, isAdmin: 'yes' as unknown as boolean }))
    ).rejects.toThrow(/boolean/);
  });

  it('rejects promoting someone with no allowedUsers doc', async () => {
    await expect(
      setAdminRole.run(asAdmin({ email: uniqueEmail('ghost'), isAdmin: true }))
    ).rejects.toThrow(/must have app access/);
  });

  it('promotes a member to admin, updates the role, stamps the claim, and logs it', async () => {
    const email = uniqueEmail('promote');
    await allowEmail(email, 'member');
    const user = await getAdminAuth().createUser({ uid: uniqueId('uid'), email });

    await setAdminRole.run(asAdmin({ email, isAdmin: true }));

    expect((await getDb().collection('allowedUsers').doc(email).get()).data()!.role).toBe('admin');
    expect((await getAdminAuth().getUser(user.uid)).customClaims).toEqual({
      appAccess: true,
      admin: true,
    });
    expect((await activityEntries(email)).map((e) => e.type)).toContain('admin_granted');
  });

  it('demotes an admin to member when another admin remains, and logs it', async () => {
    const admin1 = uniqueEmail('admin1');
    const admin2 = uniqueEmail('admin2');
    await allowEmail(admin1, 'admin');
    await allowEmail(admin2, 'admin');

    await setAdminRole.run(asAdmin({ email: admin1, isAdmin: false }));

    expect((await getDb().collection('allowedUsers').doc(admin1).get()).data()!.role).toBe(
      'member'
    );
    expect((await activityEntries(admin1)).map((e) => e.type)).toContain('admin_revoked');
  });

  it('refuses to demote the last remaining admin', async () => {
    const email = uniqueEmail('sole-admin');
    await allowEmail(email, 'admin');
    await expect(setAdminRole.run(asAdmin({ email, isAdmin: false }))).rejects.toThrow(
      /admin must remain/
    );
    expect((await getDb().collection('allowedUsers').doc(email).get()).data()!.role).toBe('admin');
  });
});
