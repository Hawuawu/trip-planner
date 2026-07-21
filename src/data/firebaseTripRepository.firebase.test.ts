// Run with: npm run test:firebase (requires Firebase emulators)
//
// Tests the Firestore security rules and CRUD data-layer directly using
// @firebase/rules-unit-testing.  FirebaseTripRepository itself uses
// import.meta.env for config (a Vite-only global absent in Node), so we
// exercise the Firestore document structure and rules independently — which
// is the correct way to test the Firebase layer anyway: security rules and
// document shape are the contract, not the wrapper class.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// toIso — copied from the production module so we can test the conversion
// logic in isolation within the same emulator test suite.
// ---------------------------------------------------------------------------
function toIso(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PROJECT_ID = 'demo-trip-planner-test';
const RULES_PATH = resolve(__dirname, '../../firestore.rules');

let testEnv: RulesTestEnvironment;

// Every trip rule additionally requires the appAccess custom claim (stamped
// at sign-in by the stampAppAccess blocking function; see #35). This helper
// models an approved, signed-in user; use authenticatedContext directly (no
// claims) to model a signed-in but unapproved account.
const approvedDb = (uid: string) =>
  testEnv.authenticatedContext(uid, { appAccess: true }).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterEach(async () => {
  // Clear all data between tests so they remain independent
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ---------------------------------------------------------------------------
// Helper: seed a trip doc and return the trip ID
// ---------------------------------------------------------------------------
async function seedTrip(tripId: string, memberIds: string[], ownerId?: string): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx
      .firestore()
      .collection('trips')
      .doc(tripId)
      .set({
        name: 'Japan 2026',
        dateRange: { start: '2026-10-01', end: '2026-10-15' },
        memberIds,
        ...(ownerId !== undefined && { ownerId }),
      });
  });
}

// ---------------------------------------------------------------------------
// 1. Firestore CRUD via rules-unit-testing SDK
// ---------------------------------------------------------------------------
describe('Firestore CRUD (rules disabled — data layer shape)', () => {
  it('addDoc to trips/{id}/checkpoints then getDoc returns the document', async () => {
    const TRIP_ID = 'trip-crud-1';
    await seedTrip(TRIP_ID, ['user-a']);

    const db = approvedDb('user-a');

    const checkpointRef = await db
      .collection('trips')
      .doc(TRIP_ID)
      .collection('checkpoints')
      .add({
        type: 'flight',
        name: 'Tokyo Narita',
        startTime: Timestamp.fromDate(new Date('2026-10-01T14:00:00Z')),
        updatedAt: Timestamp.now(),
      });

    const snap = await db
      .collection('trips')
      .doc(TRIP_ID)
      .collection('checkpoints')
      .doc(checkpointRef.id)
      .get();

    expect(snap.exists).toBe(true);
    expect(snap.data()?.name).toBe('Tokyo Narita');
    expect(snap.data()?.type).toBe('flight');
  });

  it('timestamps are present as Firestore Timestamps, not ISO strings, in raw docs', async () => {
    const TRIP_ID = 'trip-crud-2';
    await seedTrip(TRIP_ID, ['user-b']);

    const db = approvedDb('user-b');
    const date = new Date('2026-10-01T00:00:00Z');

    const ref = await db
      .collection('trips')
      .doc(TRIP_ID)
      .collection('checkpoints')
      .add({
        type: 'hotel',
        name: 'Shinjuku Hotel',
        startTime: Timestamp.fromDate(date),
        updatedAt: Timestamp.now(),
      });

    const snap = await db
      .collection('trips')
      .doc(TRIP_ID)
      .collection('checkpoints')
      .doc(ref.id)
      .get();

    const rawStartTime = snap.data()?.startTime;
    // The raw value stored in Firestore is a Timestamp — NOT an ISO string.
    // The repo layer converts it via toIso() before returning to the app.
    expect(rawStartTime).toBeInstanceOf(Timestamp);
    // Verify toIso would correctly convert it
    expect(toIso(rawStartTime)).toBe('2026-10-01T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// 2. Security rules
// ---------------------------------------------------------------------------
describe('Security rules — trips/{tripId}', () => {
  const TRIP_ID = 'trip-rules-1';
  const MEMBER_UID = 'member-user';
  const OUTSIDER_UID = 'outsider-user';

  beforeEach(async () => {
    await seedTrip(TRIP_ID, [MEMBER_UID]);
  });

  it('member can read their trip', async () => {
    const db = approvedDb(MEMBER_UID);
    await assertSucceeds(db.collection('trips').doc(TRIP_ID).get());
  });

  it('non-member CANNOT read a trip they are not in', async () => {
    const db = approvedDb(OUTSIDER_UID);
    await assertFails(db.collection('trips').doc(TRIP_ID).get());
  });

  it('unauthenticated request CANNOT read any trip', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection('trips').doc(TRIP_ID).get());
  });
});

describe('Security rules — trips/{tripId} update/delete (owner-gated + membership-shrink)', () => {
  it('owner CAN rename their own trip', async () => {
    const TRIP_ID = 'trip-owner-rename';
    await seedTrip(TRIP_ID, ['owner-uid'], 'owner-uid');
    const db = approvedDb('owner-uid');
    await assertSucceeds(db.collection('trips').doc(TRIP_ID).update({ name: 'Renamed Trip' }));
  });

  it('non-owner member CANNOT rename a trip they do not own', async () => {
    const TRIP_ID = 'trip-non-owner-rename';
    await seedTrip(TRIP_ID, ['owner-uid', 'member-uid'], 'owner-uid');
    const db = approvedDb('member-uid');
    await assertFails(db.collection('trips').doc(TRIP_ID).update({ name: 'Hijacked' }));
  });

  it('any member CAN rename a legacy trip with no ownerId', async () => {
    const TRIP_ID = 'trip-legacy-rename';
    await seedTrip(TRIP_ID, ['member-uid']);
    const db = approvedDb('member-uid');
    await assertSucceeds(db.collection('trips').doc(TRIP_ID).update({ name: 'Legacy Renamed' }));
  });

  it('owner CAN delete their own trip', async () => {
    const TRIP_ID = 'trip-owner-delete';
    await seedTrip(TRIP_ID, ['owner-uid'], 'owner-uid');
    const db = approvedDb('owner-uid');
    await assertSucceeds(db.collection('trips').doc(TRIP_ID).delete());
  });

  it('non-owner member CANNOT delete a trip they do not own', async () => {
    const TRIP_ID = 'trip-non-owner-delete';
    await seedTrip(TRIP_ID, ['owner-uid', 'member-uid'], 'owner-uid');
    const db = approvedDb('member-uid');
    await assertFails(db.collection('trips').doc(TRIP_ID).delete());
  });

  it('any member CAN delete a legacy trip with no ownerId', async () => {
    const TRIP_ID = 'trip-legacy-delete';
    await seedTrip(TRIP_ID, ['member-uid']);
    const db = approvedDb('member-uid');
    await assertSucceeds(db.collection('trips').doc(TRIP_ID).delete());
  });

  it('owner CAN remove a non-owner member', async () => {
    const TRIP_ID = 'trip-owner-removes-member';
    await seedTrip(TRIP_ID, ['owner-uid', 'member-uid'], 'owner-uid');
    const db = approvedDb('owner-uid');
    await assertSucceeds(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .update({ memberIds: ['owner-uid'] })
    );
  });

  it('non-owner member CANNOT remove another member', async () => {
    const TRIP_ID = 'trip-non-owner-removes-member';
    await seedTrip(TRIP_ID, ['owner-uid', 'member-uid', 'member2-uid'], 'owner-uid');
    const db = approvedDb('member-uid');
    await assertFails(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .update({ memberIds: ['owner-uid', 'member-uid'] })
    );
  });

  it('non-owner member CAN remove themselves (leave)', async () => {
    const TRIP_ID = 'trip-member-leaves';
    await seedTrip(TRIP_ID, ['owner-uid', 'member-uid'], 'owner-uid');
    const db = approvedDb('member-uid');
    await assertSucceeds(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .update({ memberIds: ['owner-uid'] })
    );
  });

  it("owner's own uid CANNOT be removed while other members remain (owner can't leave/be removed)", async () => {
    const TRIP_ID = 'trip-owner-cannot-leave';
    await seedTrip(TRIP_ID, ['owner-uid', 'member-uid'], 'owner-uid');
    const ownerDb = approvedDb('owner-uid');
    await assertFails(
      ownerDb
        .collection('trips')
        .doc(TRIP_ID)
        .update({ memberIds: ['member-uid'] })
    );
    const memberDb = approvedDb('member-uid');
    await assertFails(
      memberDb
        .collection('trips')
        .doc(TRIP_ID)
        .update({ memberIds: ['member-uid'] })
    );
  });

  it('a client CANNOT shrink memberIds by more than one at once', async () => {
    const TRIP_ID = 'trip-shrink-multiple';
    await seedTrip(TRIP_ID, ['owner-uid', 'member-uid', 'member2-uid'], 'owner-uid');
    const db = approvedDb('owner-uid');
    await assertFails(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .update({ memberIds: ['owner-uid'] })
    );
  });

  it('a client CANNOT shrink and add a uid in the same update', async () => {
    const TRIP_ID = 'trip-shrink-and-add';
    await seedTrip(TRIP_ID, ['owner-uid', 'member-uid'], 'owner-uid');
    const db = approvedDb('owner-uid');
    await assertFails(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .update({ memberIds: ['owner-uid', 'intruder-uid'] })
    );
  });

  it('a member CAN self-heal their own memberProfiles entry (no memberIds change)', async () => {
    const TRIP_ID = 'trip-self-heal-profile';
    await seedTrip(TRIP_ID, ['owner-uid'], 'owner-uid');
    const db = approvedDb('owner-uid');
    await assertSucceeds(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .update({
          memberProfiles: { 'owner-uid': { email: 'owner@example.com', displayName: null } },
        })
    );
  });

  it('a client CANNOT write a memberProfiles entry for a different uid (invite requires the Cloud Function)', async () => {
    const TRIP_ID = 'trip-add-profile-for-other';
    await seedTrip(TRIP_ID, ['owner-uid'], 'owner-uid');
    const db = approvedDb('owner-uid');
    await assertFails(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .update({
          memberProfiles: { 'intruder-uid': { email: 'intruder@example.com', displayName: null } },
        })
    );
  });

  it("a client CANNOT modify another member's existing memberProfiles entry while self-healing their own", async () => {
    const TRIP_ID = 'trip-mixed-profile-write';
    await seedTrip(TRIP_ID, ['owner-uid', 'member-uid'], 'owner-uid');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .collection('trips')
        .doc(TRIP_ID)
        .update({
          memberProfiles: { 'member-uid': { email: 'member@example.com', displayName: null } },
        });
    });
    const db = approvedDb('owner-uid');
    await assertFails(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .update({
          memberProfiles: {
            'owner-uid': { email: 'owner@example.com', displayName: null },
            'member-uid': { email: 'hijacked@example.com', displayName: null },
          },
        })
    );
  });

  it('a client CANNOT add a new uid directly to memberIds', async () => {
    const TRIP_ID = 'trip-add-member-directly';
    await seedTrip(TRIP_ID, ['owner-uid'], 'owner-uid');
    const db = approvedDb('owner-uid');
    await assertFails(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .update({ memberIds: ['owner-uid', 'intruder-uid'] })
    );
  });

  it('a client CANNOT empty memberIds entirely', async () => {
    const TRIP_ID = 'trip-empty-members';
    await seedTrip(TRIP_ID, ['owner-uid'], 'owner-uid');
    const db = approvedDb('owner-uid');
    await assertFails(db.collection('trips').doc(TRIP_ID).update({ memberIds: [] }));
  });
});

describe('Security rules — trips/{tripId}/checkpoints', () => {
  const TRIP_ID = 'trip-cp-rules-1';
  const MEMBER_UID = 'member-cp';
  const OUTSIDER_UID = 'outsider-cp';

  beforeEach(async () => {
    await seedTrip(TRIP_ID, [MEMBER_UID]);
    // Seed a checkpoint so reads have something to return
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .collection('trips')
        .doc(TRIP_ID)
        .collection('checkpoints')
        .doc('cp-1')
        .set({
          type: 'train',
          name: 'Shinkansen',
          startTime: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
    });
  });

  it('member CAN read checkpoints', async () => {
    const db = approvedDb(MEMBER_UID);
    await assertSucceeds(
      db.collection('trips').doc(TRIP_ID).collection('checkpoints').doc('cp-1').get()
    );
  });

  it('member CAN write a checkpoint', async () => {
    const db = approvedDb(MEMBER_UID);
    await assertSucceeds(
      db.collection('trips').doc(TRIP_ID).collection('checkpoints').add({
        type: 'poi',
        name: 'Senso-ji',
        startTime: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    );
  });

  it('non-member CANNOT read checkpoints', async () => {
    const db = approvedDb(OUTSIDER_UID);
    await assertFails(
      db.collection('trips').doc(TRIP_ID).collection('checkpoints').doc('cp-1').get()
    );
  });

  it('unauthenticated request CANNOT read checkpoints', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      db.collection('trips').doc(TRIP_ID).collection('checkpoints').doc('cp-1').get()
    );
  });

  it('a member WITHOUT the appAccess claim CANNOT read the trip, its checkpoints, or create trips', async () => {
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();
    await assertFails(db.collection('trips').doc(TRIP_ID).get());
    await assertFails(
      db.collection('trips').doc(TRIP_ID).collection('checkpoints').doc('cp-1').get()
    );
    await assertFails(
      db
        .collection('trips')
        .doc('unapproved-new-trip')
        .set({
          name: 'Sneaky trip',
          dateRange: { start: '2026-01-01', end: '2026-01-02' },
          memberIds: [MEMBER_UID],
        })
    );
  });
});

describe('Security rules — trips/{tripId}/alternatives', () => {
  const TRIP_ID = 'trip-alt-rules-1';
  const MEMBER_UID = 'member-alt';
  const OUTSIDER_UID = 'outsider-alt';

  beforeEach(async () => {
    await seedTrip(TRIP_ID, [MEMBER_UID]);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .collection('trips')
        .doc(TRIP_ID)
        .collection('alternatives')
        .doc('alt-1')
        .set({
          type: 'poi',
          name: 'TeamLab Planets',
        });
    });
  });

  it('member CAN read alternatives', async () => {
    const db = approvedDb(MEMBER_UID);
    await assertSucceeds(
      db.collection('trips').doc(TRIP_ID).collection('alternatives').doc('alt-1').get()
    );
  });

  it('member CAN write alternatives', async () => {
    const db = approvedDb(MEMBER_UID);
    await assertSucceeds(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .collection('alternatives')
        .add({ type: 'poi', name: 'Teamlab Borderless' })
    );
  });

  it('non-member CANNOT read alternatives', async () => {
    const db = approvedDb(OUTSIDER_UID);
    await assertFails(
      db.collection('trips').doc(TRIP_ID).collection('alternatives').doc('alt-1').get()
    );
  });
});

describe('Security rules — trips/{tripId}/bookings', () => {
  const TRIP_ID = 'trip-bk-rules-1';
  const MEMBER_UID = 'member-bk';
  const OUTSIDER_UID = 'outsider-bk';

  beforeEach(async () => {
    await seedTrip(TRIP_ID, [MEMBER_UID]);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .collection('trips')
        .doc(TRIP_ID)
        .collection('bookings')
        .doc('booking-1')
        .set({
          provider: 'ANA',
          confirmationNumber: 'ABC123',
          notes: 'Window seat',
        });
    });
  });

  it('member CAN read bookings', async () => {
    const db = approvedDb(MEMBER_UID);
    await assertSucceeds(
      db.collection('trips').doc(TRIP_ID).collection('bookings').doc('booking-1').get()
    );
  });

  it('member CAN write bookings', async () => {
    const db = approvedDb(MEMBER_UID);
    await assertSucceeds(
      db.collection('trips').doc(TRIP_ID).collection('bookings').add({
        provider: 'JR Pass',
        confirmationNumber: 'JR-XYZ',
      })
    );
  });

  it('non-member CANNOT read bookings', async () => {
    const db = approvedDb(OUTSIDER_UID);
    await assertFails(
      db.collection('trips').doc(TRIP_ID).collection('bookings').doc('booking-1').get()
    );
  });
});

describe('Security rules — trips/{tripId}/activityLog', () => {
  const TRIP_ID = 'trip-log-rules-1';
  const OWNER_UID = 'owner-log';
  const MEMBER_UID = 'member-log';
  const OUTSIDER_UID = 'outsider-log';

  beforeEach(async () => {
    await seedTrip(TRIP_ID, [OWNER_UID, MEMBER_UID], OWNER_UID);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx
        .firestore()
        .collection('trips')
        .doc(TRIP_ID)
        .collection('activityLog')
        .doc('e1')
        .set({
          type: 'checkpoint_added',
          actorUid: MEMBER_UID,
          actorLabel: 'Member',
          entityName: 'Senso-ji',
          createdAt: Timestamp.now(),
        });
    });
  });

  it('owner CAN read the activity log', async () => {
    const db = approvedDb(OWNER_UID);
    await assertSucceeds(
      db.collection('trips').doc(TRIP_ID).collection('activityLog').doc('e1').get()
    );
  });

  it('non-owner member CANNOT read the activity log', async () => {
    const db = approvedDb(MEMBER_UID);
    await assertFails(
      db.collection('trips').doc(TRIP_ID).collection('activityLog').doc('e1').get()
    );
  });

  it('outsider CANNOT read the activity log', async () => {
    const db = approvedDb(OUTSIDER_UID);
    await assertFails(
      db.collection('trips').doc(TRIP_ID).collection('activityLog').doc('e1').get()
    );
  });

  it('a member CAN create a self-attributed activity log entry', async () => {
    const db = approvedDb(MEMBER_UID);
    await assertSucceeds(
      db.collection('trips').doc(TRIP_ID).collection('activityLog').add({
        type: 'checkpoint_updated',
        actorUid: MEMBER_UID,
        actorLabel: 'Member',
        createdAt: Timestamp.now(),
      })
    );
  });

  it('a member CANNOT create an activity log entry attributed to another uid (spoofing)', async () => {
    const db = approvedDb(MEMBER_UID);
    await assertFails(
      db.collection('trips').doc(TRIP_ID).collection('activityLog').add({
        type: 'checkpoint_updated',
        actorUid: OWNER_UID,
        actorLabel: 'Owner',
        createdAt: Timestamp.now(),
      })
    );
  });

  it('the log is append-only — no one can update or delete an entry', async () => {
    const ownerDb = approvedDb(OWNER_UID);
    await assertFails(
      ownerDb
        .collection('trips')
        .doc(TRIP_ID)
        .collection('activityLog')
        .doc('e1')
        .update({ entityName: 'Tampered' })
    );
    await assertFails(
      ownerDb.collection('trips').doc(TRIP_ID).collection('activityLog').doc('e1').delete()
    );
  });
});

// ---------------------------------------------------------------------------
// 2b. Batch writes (writeBatch) — backs addCheckpoints/addAlternatives
// ---------------------------------------------------------------------------
describe('Batch writes — trips/{tripId}/checkpoints and alternatives', () => {
  it('member CAN batch-write multiple checkpoints in one writeBatch (all committed)', async () => {
    const TRIP_ID = 'trip-batch-cp';
    const MEMBER_UID = 'member-batch-cp';
    await seedTrip(TRIP_ID, [MEMBER_UID]);

    const db = approvedDb(MEMBER_UID);
    const cpCollection = db.collection('trips').doc(TRIP_ID).collection('checkpoints');
    const ref1 = cpCollection.doc();
    const ref2 = cpCollection.doc();

    const batch = db.batch();
    batch.set(ref1, {
      type: 'poi',
      name: 'Batch A',
      startTime: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    batch.set(ref2, {
      type: 'poi',
      name: 'Batch B',
      startTime: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await assertSucceeds(batch.commit());

    const snap = await cpCollection.get();
    expect(snap.docs.map((d) => d.data().name).sort()).toEqual(['Batch A', 'Batch B']);
  });

  it('member CAN batch-write multiple alternatives in one writeBatch (all committed)', async () => {
    const TRIP_ID = 'trip-batch-alt';
    const MEMBER_UID = 'member-batch-alt';
    await seedTrip(TRIP_ID, [MEMBER_UID]);

    const db = approvedDb(MEMBER_UID);
    const altCollection = db.collection('trips').doc(TRIP_ID).collection('alternatives');
    const ref1 = altCollection.doc();
    const ref2 = altCollection.doc();

    const batch = db.batch();
    batch.set(ref1, { type: 'poi', name: 'Alt Batch A' });
    batch.set(ref2, { type: 'poi', name: 'Alt Batch B' });
    await assertSucceeds(batch.commit());

    const snap = await altCollection.get();
    expect(snap.docs.map((d) => d.data().name).sort()).toEqual(['Alt Batch A', 'Alt Batch B']);
  });

  it('a batch containing one write to a trip the user is not a member of fails entirely (atomic)', async () => {
    const OWN_TRIP_ID = 'trip-batch-own';
    const OTHER_TRIP_ID = 'trip-batch-other';
    const MEMBER_UID = 'member-batch-atomic';
    await seedTrip(OWN_TRIP_ID, [MEMBER_UID]);
    await seedTrip(OTHER_TRIP_ID, ['someone-else']);

    const db = approvedDb(MEMBER_UID);
    const ownCollection = db.collection('trips').doc(OWN_TRIP_ID).collection('checkpoints');
    const otherCollection = db.collection('trips').doc(OTHER_TRIP_ID).collection('checkpoints');
    const ownRef = ownCollection.doc();
    const otherRef = otherCollection.doc();

    const batch = db.batch();
    batch.set(ownRef, {
      type: 'poi',
      name: 'Should not persist',
      startTime: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    batch.set(otherRef, {
      type: 'poi',
      name: 'Not a member here',
      startTime: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    await assertFails(batch.commit());

    // The whole batch is rejected — the write to the trip the user DOES belong
    // to must not have been partially committed either.
    const ownSnap = await ownCollection.get();
    expect(ownSnap.empty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. toIso conversion (repeated here alongside emulator tests for completeness)
//    The standalone suite lives in firebaseTripRepository.test.ts
// ---------------------------------------------------------------------------
describe('toIso conversion (pure, no emulator)', () => {
  it('converts Timestamp.fromDate to ISO string', () => {
    const ts = Timestamp.fromDate(new Date('2026-10-01T00:00:00Z'));
    expect(toIso(ts)).toBe('2026-10-01T00:00:00.000Z');
  });

  it('returns a string unchanged', () => {
    expect(toIso('already-a-string')).toBe('already-a-string');
  });

  it('returns a valid ISO string for undefined (fallback to now)', () => {
    const before = Date.now();
    const result = toIso(undefined);
    const after = Date.now();
    const parsed = new Date(result).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });
});
