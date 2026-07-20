import { describe, it, expect } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { getDb, getAdminAuth } from './firebaseAdmin';
import { inviteTripMember } from './inviteTripMember';

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function callableRequest<T>(data: T, uid?: string): CallableRequest<T> {
  return { data, auth: uid ? { uid, token: {} } : undefined } as unknown as CallableRequest<T>;
}

async function seedTrip(overrides: { ownerId?: string; memberIds: string[] }) {
  const tripId = uniqueId('trip');
  await getDb()
    .collection('trips')
    .doc(tripId)
    .set({
      name: 'Test Trip',
      dateRange: { start: '2026-01-01', end: '2026-01-10' },
      memberIds: overrides.memberIds,
      ...(overrides.ownerId !== undefined && { ownerId: overrides.ownerId }),
    });
  return tripId;
}

async function createAuthUser(email: string) {
  return getAdminAuth().createUser({ email, uid: uniqueId('uid'), displayName: 'Test User' });
}

describe('inviteTripMember', () => {
  it('throws unauthenticated when there is no auth context', async () => {
    await expect(
      inviteTripMember.run(callableRequest({ tripId: 'x', email: 'a@b.com' }))
    ).rejects.toThrow();
  });

  it('throws invalid-argument for a malformed email', async () => {
    const ownerUid = uniqueId('owner');
    const tripId = await seedTrip({ ownerId: ownerUid, memberIds: [ownerUid] });
    await expect(
      inviteTripMember.run(callableRequest({ tripId, email: 'not-an-email' }, ownerUid))
    ).rejects.toThrow();
  });

  it('throws not-found when the trip does not exist', async () => {
    await expect(
      inviteTripMember.run(
        callableRequest({ tripId: 'no-such-trip', email: 'a@b.com' }, uniqueId('owner'))
      )
    ).rejects.toThrow();
  });

  it('throws permission-denied when the caller is not the owner', async () => {
    const ownerUid = uniqueId('owner');
    const memberUid = uniqueId('member');
    const tripId = await seedTrip({ ownerId: ownerUid, memberIds: [ownerUid, memberUid] });
    await expect(
      inviteTripMember.run(callableRequest({ tripId, email: 'friend@example.com' }, memberUid))
    ).rejects.toThrow();
  });

  it('throws a friendly not-found for an unregistered invitee', async () => {
    const ownerUid = uniqueId('owner');
    const tripId = await seedTrip({ ownerId: ownerUid, memberIds: [ownerUid] });
    await expect(
      inviteTripMember.run(
        callableRequest({ tripId, email: `ghost-${Date.now()}@example.com` }, ownerUid)
      )
    ).rejects.toThrow(/sign in with Google/);
  });

  it('invites a registered user by email and writes memberIds/memberProfiles/activity log', async () => {
    const ownerUid = uniqueId('owner');
    const invitee = await createAuthUser(`invitee-${Date.now()}@example.com`);
    const tripId = await seedTrip({ ownerId: ownerUid, memberIds: [ownerUid] });

    const result = await inviteTripMember.run(
      callableRequest({ tripId, email: invitee.email! }, ownerUid)
    );
    expect(result).toEqual({ status: 'invited', uid: invitee.uid });

    const trip = (await getDb().collection('trips').doc(tripId).get()).data()!;
    expect(trip.memberIds).toContain(invitee.uid);
    expect(trip.memberProfiles[invitee.uid].email).toBe(invitee.email);

    const logSnap = await getDb().collection('trips').doc(tripId).collection('activityLog').get();
    expect(logSnap.docs.map((d) => d.data().type)).toContain('member_invited');
  });

  it('is idempotent when inviting someone already a member', async () => {
    const ownerUid = uniqueId('owner');
    const invitee = await createAuthUser(`already-${Date.now()}@example.com`);
    const tripId = await seedTrip({ ownerId: ownerUid, memberIds: [ownerUid, invitee.uid] });

    const result = await inviteTripMember.run(
      callableRequest({ tripId, email: invitee.email! }, ownerUid)
    );
    expect(result).toEqual({ status: 'already-member', uid: invitee.uid });

    const logSnap = await getDb().collection('trips').doc(tripId).collection('activityLog').get();
    expect(logSnap.empty).toBe(true);
  });
});
