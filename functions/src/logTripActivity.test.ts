// Run with: npm run test:functions (requires Firebase emulators — Firestore).
// See logTripEntityActivity.test.ts for the .run(event)/Change.fromObjects
// testing pattern this mirrors.

import { describe, it, expect } from 'vitest';
import type { DocumentSnapshot, FirestoreEvent } from 'firebase-functions/v2/firestore';
import { Change } from 'firebase-functions/v2/firestore';
import { getDb } from './firebaseAdmin';
import { logTripActivity } from './logTripActivity';

type Params = { tripId: string };

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fakeEvent(
  tripId: string,
  data: Change<DocumentSnapshot> | undefined
): FirestoreEvent<Change<DocumentSnapshot> | undefined, Params> {
  return {
    specversion: '1.0',
    id: uniqueId('event'),
    source: 'test',
    type: 'test',
    time: new Date().toISOString(),
    data,
    params: { tripId },
    location: 'test',
    project: 'test',
    database: '(default)',
    namespace: '(default)',
    document: `trips/${tripId}`,
  };
}

function tripRef(tripId: string) {
  return getDb().collection('trips').doc(tripId);
}

async function activityLogEntries(tripId: string) {
  const snap = await getDb().collection('trips').doc(tripId).collection('activityLog').get();
  return snap.docs.map((d) => d.data());
}

async function appActivityLogEntries() {
  const snap = await getDb().collection('appActivityLog').get();
  return snap.docs.map((d) => d.data());
}

describe('logTripActivity', () => {
  it('logs trip_created on create, attributed via lastModifiedBy', async () => {
    const tripId = uniqueId('trip');
    const ref = tripRef(tripId);
    const before = await ref.get();
    await ref.set({
      name: 'Japan 2026',
      dateRange: { start: '2026-10-01', end: '2026-10-14' },
      memberIds: ['user-1'],
      lastModifiedBy: { uid: 'user-1', label: 'Alice' },
    });
    const after = await ref.get();

    await logTripActivity.run(fakeEvent(tripId, Change.fromObjects(before, after)));

    const entries = await activityLogEntries(tripId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      type: 'trip_created',
      actorUid: 'user-1',
      actorLabel: 'Alice',
      entityName: 'Japan 2026',
    });
  });

  it('logs trip_renamed when only name changes', async () => {
    const tripId = uniqueId('trip');
    const ref = tripRef(tripId);
    await ref.set({
      name: 'Japan 2026',
      dateRange: { start: '2026-10-01', end: '2026-10-14' },
      memberIds: ['user-1'],
      lastModifiedBy: { uid: 'user-1', label: 'Alice' },
    });
    const before = await ref.get();
    await ref.update({ name: 'Japan Redux', lastModifiedBy: { uid: 'user-1', label: 'Alice' } });
    const after = await ref.get();

    await logTripActivity.run(fakeEvent(tripId, Change.fromObjects(before, after)));

    const entries = await activityLogEntries(tripId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ type: 'trip_renamed', entityName: 'Japan Redux' });
  });

  it('logs trip_dates_updated when only dateRange changes', async () => {
    const tripId = uniqueId('trip');
    const ref = tripRef(tripId);
    await ref.set({
      name: 'Japan 2026',
      dateRange: { start: '2026-10-01', end: '2026-10-14' },
      memberIds: ['user-1'],
      lastModifiedBy: { uid: 'user-1', label: 'Alice' },
    });
    const before = await ref.get();
    await ref.update({
      dateRange: { start: '2026-10-02', end: '2026-10-15' },
      lastModifiedBy: { uid: 'user-1', label: 'Alice' },
    });
    const after = await ref.get();

    await logTripActivity.run(fakeEvent(tripId, Change.fromObjects(before, after)));

    const entries = await activityLogEntries(tripId);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('trip_dates_updated');
  });

  it('writes no entry for a memberIds-only diff (avoids double-logging removeMember/leaveTrip)', async () => {
    const tripId = uniqueId('trip');
    const ref = tripRef(tripId);
    await ref.set({
      name: 'Japan 2026',
      dateRange: { start: '2026-10-01', end: '2026-10-14' },
      memberIds: ['user-1', 'user-2'],
    });
    const before = await ref.get();
    await ref.update({ memberIds: ['user-1'] });
    const after = await ref.get();

    await logTripActivity.run(fakeEvent(tripId, Change.fromObjects(before, after)));

    expect(await activityLogEntries(tripId)).toHaveLength(0);
  });

  it('writes no entry when nothing but lastModifiedBy itself changed', async () => {
    const tripId = uniqueId('trip');
    const ref = tripRef(tripId);
    await ref.set({
      name: 'Japan 2026',
      dateRange: { start: '2026-10-01', end: '2026-10-14' },
      memberIds: ['user-1'],
      lastModifiedBy: { uid: 'user-1', label: 'Alice' },
    });
    const before = await ref.get();
    await ref.update({ lastModifiedBy: { uid: 'user-1', label: 'Alice (renamed)' } });
    const after = await ref.get();

    await logTripActivity.run(fakeEvent(tripId, Change.fromObjects(before, after)));

    expect(await activityLogEntries(tripId)).toHaveLength(0);
  });

  it('on delete, writes trip_deleted into appActivityLog, not the (now-gone) trip activityLog', async () => {
    const tripId = uniqueId('trip');
    const ref = tripRef(tripId);
    await ref.set({
      name: 'Japan 2026',
      dateRange: { start: '2026-10-01', end: '2026-10-14' },
      memberIds: ['user-1'],
      lastModifiedBy: { uid: 'user-1', label: 'Alice' },
    });
    const before = await ref.get();
    await ref.delete();
    const after = await ref.get();

    await logTripActivity.run(fakeEvent(tripId, Change.fromObjects(before, after)));

    const appEntries = await appActivityLogEntries();
    const tripDeleted = appEntries.filter(
      (e) => e.type === 'trip_deleted' && e.entityName === 'Japan 2026'
    );
    expect(tripDeleted).toHaveLength(1);
    expect(tripDeleted[0]).toMatchObject({ actor: 'system', email: null });
  });
});
