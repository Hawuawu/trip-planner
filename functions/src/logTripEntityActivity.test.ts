// Run with: npm run test:functions (requires Firebase emulators — Firestore).
//
// Firestore triggers expose a `.run(event)` escape hatch for direct
// invocation without going through the emulator's function-hosting layer
// (see CloudFunction.run in firebase-functions/v2/core) — this builds a
// synthetic FirestoreEvent from Change.fromObjects(before, after), where
// before/after are real DocumentSnapshots read from the emulator, and
// invokes the trigger's exported handler directly.

import { describe, it, expect } from 'vitest';
import type { DocumentSnapshot, FirestoreEvent } from 'firebase-functions/v2/firestore';
import { Change } from 'firebase-functions/v2/firestore';
import { getDb } from './firebaseAdmin';
import { logTripEntityActivity } from './logTripEntityActivity';

type Params = { tripId: string; collectionId: string; docId: string };

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fakeEvent(
  params: Params,
  data: Change<DocumentSnapshot> | undefined
): FirestoreEvent<Change<DocumentSnapshot> | undefined, Params> {
  return {
    specversion: '1.0',
    id: uniqueId('event'),
    source: 'test',
    type: 'test',
    time: new Date().toISOString(),
    data,
    params,
    location: 'test',
    project: 'test',
    database: '(default)',
    namespace: '(default)',
    document: `trips/${params.tripId}/${params.collectionId}/${params.docId}`,
  };
}

function docRef(tripId: string, collectionId: string, docId: string) {
  return getDb().collection('trips').doc(tripId).collection(collectionId).doc(docId);
}

async function activityLogEntries(tripId: string) {
  const snap = await getDb().collection('trips').doc(tripId).collection('activityLog').get();
  return snap.docs.map((d) => d.data());
}

describe('logTripEntityActivity', () => {
  it('does nothing when collectionId is activityLog (recursion guard)', async () => {
    const tripId = uniqueId('trip');
    const docId = uniqueId('entry');
    const ref = docRef(tripId, 'activityLog', docId);
    const before = await ref.get();
    await ref.set({
      type: 'checkpoint_added',
      actorUid: 'u1',
      actorLabel: 'Alice',
      createdAt: new Date(),
    });
    const after = await ref.get();

    await logTripEntityActivity.run(
      fakeEvent({ tripId, collectionId: 'activityLog', docId }, Change.fromObjects(before, after))
    );

    const entries = await activityLogEntries(tripId);
    expect(entries).toHaveLength(1); // only the entry we wrote directly — no extra one from the trigger
  });

  it('logs checkpoint_added on create, attributed via lastModifiedBy', async () => {
    const tripId = uniqueId('trip');
    const docId = uniqueId('cp');
    const ref = docRef(tripId, 'checkpoints', docId);
    const before = await ref.get();
    await ref.set({
      type: 'poi',
      name: 'Senso-ji',
      startTime: '2026-01-01T00:00:00.000Z',
      lastModifiedBy: { uid: 'user-1', label: 'Alice' },
    });
    const after = await ref.get();

    await logTripEntityActivity.run(
      fakeEvent({ tripId, collectionId: 'checkpoints', docId }, Change.fromObjects(before, after))
    );

    const entries = await activityLogEntries(tripId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      type: 'checkpoint_added',
      actorUid: 'user-1',
      actorLabel: 'Alice',
      entityName: 'Senso-ji',
    });
  });

  it('logs checkpoint_updated with changedFields, excluding updatedAt/lastModifiedBy', async () => {
    const tripId = uniqueId('trip');
    const docId = uniqueId('cp');
    const ref = docRef(tripId, 'checkpoints', docId);
    await ref.set({
      type: 'poi',
      name: 'Senso-ji',
      startTime: '2026-01-01T00:00:00.000Z',
      updatedAt: new Date(),
      lastModifiedBy: { uid: 'user-1', label: 'Alice' },
    });
    const before = await ref.get();
    await ref.update({
      name: 'Senso-ji Temple',
      updatedAt: new Date(),
      lastModifiedBy: { uid: 'user-2', label: 'Bob' },
    });
    const after = await ref.get();

    await logTripEntityActivity.run(
      fakeEvent({ tripId, collectionId: 'checkpoints', docId }, Change.fromObjects(before, after))
    );

    const entries = await activityLogEntries(tripId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      type: 'checkpoint_updated',
      actorUid: 'user-2',
      actorLabel: 'Bob',
      entityName: 'Senso-ji Temple',
      changedFields: ['name'],
    });
  });

  it('logs checkpoint_deleted attributed to before.lastModifiedBy (delete attribution caveat)', async () => {
    const tripId = uniqueId('trip');
    const docId = uniqueId('cp');
    const ref = docRef(tripId, 'checkpoints', docId);
    await ref.set({
      type: 'poi',
      name: 'Senso-ji',
      startTime: '2026-01-01T00:00:00.000Z',
      lastModifiedBy: { uid: 'user-1', label: 'Alice' },
    });
    const before = await ref.get();
    await ref.delete();
    const after = await ref.get();

    await logTripEntityActivity.run(
      fakeEvent({ tripId, collectionId: 'checkpoints', docId }, Change.fromObjects(before, after))
    );

    const entries = await activityLogEntries(tripId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      type: 'checkpoint_deleted',
      actorUid: 'user-1',
      entityName: 'Senso-ji',
    });
  });

  it('skips silently when lastModifiedBy is missing (legacy doc with no actor to attribute)', async () => {
    const tripId = uniqueId('trip');
    const docId = uniqueId('cp');
    const ref = docRef(tripId, 'checkpoints', docId);
    const before = await ref.get();
    await ref.set({ type: 'poi', name: 'No Actor', startTime: '2026-01-01T00:00:00.000Z' });
    const after = await ref.get();

    await logTripEntityActivity.run(
      fakeEvent({ tripId, collectionId: 'checkpoints', docId }, Change.fromObjects(before, after))
    );

    expect(await activityLogEntries(tripId)).toHaveLength(0);
  });

  it('uses provider as the name field for bookings', async () => {
    const tripId = uniqueId('trip');
    const docId = uniqueId('bk');
    const ref = docRef(tripId, 'bookings', docId);
    const before = await ref.get();
    await ref.set({
      provider: 'ANA',
      confirmationNumber: 'X1',
      lastModifiedBy: { uid: 'u1', label: 'Alice' },
    });
    const after = await ref.get();

    await logTripEntityActivity.run(
      fakeEvent({ tripId, collectionId: 'bookings', docId }, Change.fromObjects(before, after))
    );

    const entries = await activityLogEntries(tripId);
    expect(entries[0]).toMatchObject({ type: 'booking_added', entityName: 'ANA' });
  });

  it('uses title as the name field for wikiSections', async () => {
    const tripId = uniqueId('trip');
    const docId = uniqueId('wiki');
    const ref = docRef(tripId, 'wikiSections', docId);
    const before = await ref.get();
    await ref.set({
      title: 'Overview',
      content: '',
      order: 0,
      lastModifiedBy: { uid: 'u1', label: 'Alice' },
    });
    const after = await ref.get();

    await logTripEntityActivity.run(
      fakeEvent({ tripId, collectionId: 'wikiSections', docId }, Change.fromObjects(before, after))
    );

    const entries = await activityLogEntries(tripId);
    expect(entries[0]).toMatchObject({ type: 'wiki_section_added', entityName: 'Overview' });
  });

  it('does nothing for an unrecognized subcollection id', async () => {
    const tripId = uniqueId('trip');
    const docId = uniqueId('x');
    const ref = docRef(tripId, 'someFutureCollection', docId);
    const before = await ref.get();
    await ref.set({ name: 'Whatever', lastModifiedBy: { uid: 'u1', label: 'Alice' } });
    const after = await ref.get();

    await logTripEntityActivity.run(
      fakeEvent(
        { tripId, collectionId: 'someFutureCollection', docId },
        Change.fromObjects(before, after)
      )
    );

    expect(await activityLogEntries(tripId)).toHaveLength(0);
  });
});
