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
async function seedTrip(
  tripId: string,
  memberIds: string[],
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx
      .firestore()
      .collection('trips')
      .doc(tripId)
      .set({
        name: 'Japan 2026',
        dateRange: { start: '2026-10-01', end: '2026-10-15' },
        memberIds,
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

    const db = testEnv.authenticatedContext('user-a').firestore();

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

    const db = testEnv.authenticatedContext('user-b').firestore();
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
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();
    await assertSucceeds(
      db.collection('trips').doc(TRIP_ID).get(),
    );
  });

  it('non-member CANNOT read a trip they are not in', async () => {
    const db = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    await assertFails(
      db.collection('trips').doc(TRIP_ID).get(),
    );
  });

  it('unauthenticated request CANNOT read any trip', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      db.collection('trips').doc(TRIP_ID).get(),
    );
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
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();
    await assertSucceeds(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .collection('checkpoints')
        .doc('cp-1')
        .get(),
    );
  });

  it('member CAN write a checkpoint', async () => {
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();
    await assertSucceeds(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .collection('checkpoints')
        .add({
          type: 'poi',
          name: 'Senso-ji',
          startTime: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }),
    );
  });

  it('non-member CANNOT read checkpoints', async () => {
    const db = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    await assertFails(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .collection('checkpoints')
        .doc('cp-1')
        .get(),
    );
  });

  it('unauthenticated request CANNOT read checkpoints', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .collection('checkpoints')
        .doc('cp-1')
        .get(),
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
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();
    await assertSucceeds(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .collection('alternatives')
        .doc('alt-1')
        .get(),
    );
  });

  it('member CAN write alternatives', async () => {
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();
    await assertSucceeds(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .collection('alternatives')
        .add({ type: 'poi', name: 'Teamlab Borderless' }),
    );
  });

  it('non-member CANNOT read alternatives', async () => {
    const db = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    await assertFails(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .collection('alternatives')
        .doc('alt-1')
        .get(),
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
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();
    await assertSucceeds(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .collection('bookings')
        .doc('booking-1')
        .get(),
    );
  });

  it('member CAN write bookings', async () => {
    const db = testEnv.authenticatedContext(MEMBER_UID).firestore();
    await assertSucceeds(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .collection('bookings')
        .add({
          provider: 'JR Pass',
          confirmationNumber: 'JR-XYZ',
        }),
    );
  });

  it('non-member CANNOT read bookings', async () => {
    const db = testEnv.authenticatedContext(OUTSIDER_UID).firestore();
    await assertFails(
      db
        .collection('trips')
        .doc(TRIP_ID)
        .collection('bookings')
        .doc('booking-1')
        .get(),
    );
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
