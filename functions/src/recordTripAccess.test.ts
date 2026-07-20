import { describe, it, expect } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { getDb } from './firebaseAdmin';
import { recordTripAccess } from './recordTripAccess';

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function callableRequest<T>(data: T, uid?: string): CallableRequest<T> {
  return { data, auth: uid ? { uid, token: {} } : undefined } as unknown as CallableRequest<T>;
}

async function seedTrip(memberIds: string[]) {
  const tripId = uniqueId('trip');
  await getDb()
    .collection('trips')
    .doc(tripId)
    .set({
      name: 'Test Trip',
      dateRange: { start: '2026-01-01', end: '2026-01-10' },
      memberIds,
    });
  return tripId;
}

describe('recordTripAccess', () => {
  it('throws unauthenticated with no auth context', async () => {
    await expect(recordTripAccess.run(callableRequest({ tripId: 'x' }))).rejects.toThrow();
  });

  it('throws permission-denied for a non-member', async () => {
    const tripId = await seedTrip([uniqueId('owner')]);
    await expect(
      recordTripAccess.run(callableRequest({ tripId }, uniqueId('outsider')))
    ).rejects.toThrow();
  });

  it('records first access: sets joinedAt and writes a member_joined log entry', async () => {
    const uid = uniqueId('member');
    const tripId = await seedTrip([uid]);

    const result = await recordTripAccess.run(callableRequest({ tripId }, uid));
    expect(result).toEqual({ status: 'joined' });

    const trip = (await getDb().collection('trips').doc(tripId).get()).data();
    expect(trip?.memberProfiles?.[uid]?.joinedAt).toBeDefined();

    const logSnap = await getDb().collection('trips').doc(tripId).collection('activityLog').get();
    expect(logSnap.docs.map((d) => d.data().type)).toContain('member_joined');
  });

  it('is idempotent on a second call — no duplicate log entry', async () => {
    const uid = uniqueId('member');
    const tripId = await seedTrip([uid]);

    await recordTripAccess.run(callableRequest({ tripId }, uid));
    const second = await recordTripAccess.run(callableRequest({ tripId }, uid));
    expect(second).toEqual({ status: 'already-recorded' });

    const logSnap = await getDb().collection('trips').doc(tripId).collection('activityLog').get();
    expect(logSnap.docs.filter((d) => d.data().type === 'member_joined')).toHaveLength(1);
  });
});
