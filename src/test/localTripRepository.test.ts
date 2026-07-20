import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalTripRepository } from '../data/localTripRepository';

// ── localStorage mock ─────────────────────────────────────────────────────────
// Node 26 exposes its own experimental localStorage global (undefined without
// --localstorage-file) which shadows jsdom's. We replace it with a real
// Map-backed implementation so LocalTripRepository's getItem/setItem calls work.

function makeLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
}

let storageMock: ReturnType<typeof makeLocalStorageMock>;

beforeEach(() => {
  storageMock = makeLocalStorageMock();
  vi.stubGlobal('localStorage', storageMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRepo() {
  return new LocalTripRepository();
}

// ── getTrip ───────────────────────────────────────────────────────────────────

describe('LocalTripRepository — getTrip', () => {
  it('resolves with a trip whose id matches the argument', async () => {
    const repo = makeRepo();
    const trip = await repo.getTrip('my-trip');
    expect(trip.id).toBe('my-trip');
    expect(typeof trip.name).toBe('string');
  });
});

// ── subscribeToCheckpoints ────────────────────────────────────────────────────

describe('LocalTripRepository — subscribeToCheckpoints', () => {
  it('immediately calls the callback with the seed checkpoints', () => {
    const repo = makeRepo();
    const cb = vi.fn();
    repo.subscribeToCheckpoints('t1', cb);
    expect(cb).toHaveBeenCalledTimes(1);
    const initial = cb.mock.calls[0][0];
    expect(Array.isArray(initial)).toBe(true);
    expect(initial.length).toBeGreaterThan(0);
  });

  it('returns an unsubscribe function that stops future notifications', async () => {
    const repo = makeRepo();
    const cb = vi.fn();
    const unsub = repo.subscribeToCheckpoints('t1', cb);
    unsub();
    await repo.addCheckpoint('t1', {
      type: 'poi',
      name: 'After unsub',
      startTime: '2026-10-07T09:00:00.000Z',
    });
    // cb was called once on subscribe; should NOT be called again after unsub
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('delivers sorted checkpoints (ascending startTime)', () => {
    const repo = makeRepo();
    const cb = vi.fn();
    repo.subscribeToCheckpoints('t1', cb);
    const cps = cb.mock.calls[0][0];
    const times = cps.map((c: { startTime: string }) => c.startTime);
    const sorted = [...times].sort();
    expect(times).toEqual(sorted);
  });
});

// ── addCheckpoint ─────────────────────────────────────────────────────────────

describe('LocalTripRepository — addCheckpoint', () => {
  it('returns the saved checkpoint with an id and updatedAt', async () => {
    const repo = makeRepo();
    const saved = await repo.addCheckpoint('t1', {
      type: 'poi',
      name: 'Fushimi Inari',
      startTime: '2026-10-06T08:00:00.000Z',
    });
    expect(saved.id).toBeTruthy();
    expect(saved.name).toBe('Fushimi Inari');
    expect(typeof saved.updatedAt).toBe('string');
  });

  it('notifies subscribers after add', async () => {
    const repo = makeRepo();
    const cb = vi.fn();
    repo.subscribeToCheckpoints('t1', cb);
    const callsBefore = cb.mock.calls.length;
    await repo.addCheckpoint('t1', {
      type: 'poi',
      name: 'New Place',
      startTime: '2026-10-07T10:00:00.000Z',
    });
    expect(cb.mock.calls.length).toBeGreaterThan(callsBefore);
    const latest = cb.mock.calls[cb.mock.calls.length - 1][0];
    expect(latest.some((c: { name: string }) => c.name === 'New Place')).toBe(true);
  });

  it('persists added checkpoint across a new repo instance (via localStorage)', async () => {
    const repo1 = makeRepo();
    await repo1.addCheckpoint('t1', {
      type: 'train',
      name: 'Shinkansen',
      startTime: '2026-10-05T12:00:00.000Z',
    });
    // New instance reads from localStorage
    const repo2 = makeRepo();
    const cb = vi.fn();
    repo2.subscribeToCheckpoints('t1', cb);
    const cps = cb.mock.calls[0][0];
    expect(cps.some((c: { name: string }) => c.name === 'Shinkansen')).toBe(true);
  });
});

// ── addCheckpoints (batch) ───────────────────────────────────────────────────

describe('LocalTripRepository — addCheckpoints (batch)', () => {
  it('returns all saved checkpoints with ids and updatedAt', async () => {
    const repo = makeRepo();
    const saved = await repo.addCheckpoints('t1', [
      { type: 'poi', name: 'Batch A', startTime: '2026-10-07T09:00:00.000Z' },
      { type: 'poi', name: 'Batch B', startTime: '2026-10-07T10:00:00.000Z' },
    ]);
    expect(saved).toHaveLength(2);
    expect(saved[0].id).toBeTruthy();
    expect(saved[1].id).toBeTruthy();
    expect(saved[0].id).not.toBe(saved[1].id);
    expect(saved.every((c) => typeof c.updatedAt === 'string')).toBe(true);
  });

  it('notifies subscribers exactly once for the whole batch', async () => {
    const repo = makeRepo();
    const cb = vi.fn();
    repo.subscribeToCheckpoints('t1', cb);
    const callsBefore = cb.mock.calls.length;
    await repo.addCheckpoints('t1', [
      { type: 'poi', name: 'Batch A', startTime: '2026-10-07T09:00:00.000Z' },
      { type: 'poi', name: 'Batch B', startTime: '2026-10-07T10:00:00.000Z' },
    ]);
    expect(cb.mock.calls.length).toBe(callsBefore + 1);
    const latest = cb.mock.calls[cb.mock.calls.length - 1][0];
    expect(latest.some((c: { name: string }) => c.name === 'Batch A')).toBe(true);
    expect(latest.some((c: { name: string }) => c.name === 'Batch B')).toBe(true);
  });

  it('appends to existing checkpoints rather than replacing them', async () => {
    const repo = makeRepo();
    await repo.addCheckpoint('t1', {
      type: 'poi',
      name: 'Existing',
      startTime: '2026-10-06T09:00:00.000Z',
    });
    await repo.addCheckpoints('t1', [
      { type: 'poi', name: 'New Batch Item', startTime: '2026-10-07T09:00:00.000Z' },
    ]);
    const cb = vi.fn();
    repo.subscribeToCheckpoints('t1', cb);
    const names = cb.mock.calls[0][0].map((c: { name: string }) => c.name);
    expect(names).toContain('Existing');
    expect(names).toContain('New Batch Item');
  });
});

// ── updateCheckpoint ──────────────────────────────────────────────────────────

describe('LocalTripRepository — updateCheckpoint', () => {
  it('updates an existing checkpoint field', async () => {
    const repo = makeRepo();
    const saved = await repo.addCheckpoint('t1', {
      type: 'poi',
      name: 'Before',
      startTime: '2026-10-07T09:00:00.000Z',
    });
    await repo.updateCheckpoint('t1', saved.id, { name: 'After' });
    const cb = vi.fn();
    repo.subscribeToCheckpoints('t1', cb);
    const cps = cb.mock.calls[0][0];
    const updated = cps.find((c: { id: string }) => c.id === saved.id);
    expect(updated?.name).toBe('After');
  });

  it('updates updatedAt timestamp', async () => {
    const repo = makeRepo();
    const saved = await repo.addCheckpoint('t1', {
      type: 'poi',
      name: 'Timing',
      startTime: '2026-10-07T09:00:00.000Z',
    });
    const originalUpdatedAt = saved.updatedAt;
    // Small delay to ensure a different timestamp
    await new Promise((r) => setTimeout(r, 5));
    await repo.updateCheckpoint('t1', saved.id, { notes: 'updated' });
    const cb = vi.fn();
    repo.subscribeToCheckpoints('t1', cb);
    const updated = cb.mock.calls[0][0].find((c: { id: string }) => c.id === saved.id);
    expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
  });

  it('notifies subscribers after update', async () => {
    const repo = makeRepo();
    const saved = await repo.addCheckpoint('t1', {
      type: 'poi',
      name: 'Before',
      startTime: '2026-10-07T09:00:00.000Z',
    });
    const cb = vi.fn();
    repo.subscribeToCheckpoints('t1', cb);
    const callsBefore = cb.mock.calls.length;
    await repo.updateCheckpoint('t1', saved.id, { name: 'After' });
    expect(cb.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

// ── deleteCheckpoint ──────────────────────────────────────────────────────────

describe('LocalTripRepository — deleteCheckpoint', () => {
  it('removes the checkpoint so it no longer appears in subscriptions', async () => {
    const repo = makeRepo();
    const saved = await repo.addCheckpoint('t1', {
      type: 'poi',
      name: 'To Delete',
      startTime: '2026-10-07T09:00:00.000Z',
    });
    await repo.deleteCheckpoint('t1', saved.id);
    const cb = vi.fn();
    repo.subscribeToCheckpoints('t1', cb);
    const cps = cb.mock.calls[0][0];
    expect(cps.find((c: { id: string }) => c.id === saved.id)).toBeUndefined();
  });

  it('notifies subscribers after delete', async () => {
    const repo = makeRepo();
    const saved = await repo.addCheckpoint('t1', {
      type: 'poi',
      name: 'To Delete',
      startTime: '2026-10-07T09:00:00.000Z',
    });
    const cb = vi.fn();
    repo.subscribeToCheckpoints('t1', cb);
    const callsBefore = cb.mock.calls.length;
    await repo.deleteCheckpoint('t1', saved.id);
    expect(cb.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

// ── alternatives ──────────────────────────────────────────────────────────────

describe('LocalTripRepository — alternatives', () => {
  it('subscribeToAlternatives immediately calls the callback with seed data', () => {
    const repo = makeRepo();
    const cb = vi.fn();
    repo.subscribeToAlternatives('t1', cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(Array.isArray(cb.mock.calls[0][0])).toBe(true);
  });

  it('addAlternative returns saved alternative with id', async () => {
    const repo = makeRepo();
    const saved = await repo.addAlternative('t1', { type: 'poi', name: 'teamLab' });
    expect(saved.id).toBeTruthy();
    expect(saved.name).toBe('teamLab');
  });

  it('addAlternative notifies subscribers', async () => {
    const repo = makeRepo();
    const cb = vi.fn();
    repo.subscribeToAlternatives('t1', cb);
    const callsBefore = cb.mock.calls.length;
    await repo.addAlternative('t1', { type: 'poi', name: 'New Alt' });
    expect(cb.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('deleteAlternative removes entry and notifies subscribers', async () => {
    const repo = makeRepo();
    const saved = await repo.addAlternative('t1', { type: 'poi', name: 'To Remove' });
    const cb = vi.fn();
    repo.subscribeToAlternatives('t1', cb);
    await repo.deleteAlternative('t1', saved.id);
    const latest = cb.mock.calls[cb.mock.calls.length - 1][0];
    expect(latest.find((a: { id: string }) => a.id === saved.id)).toBeUndefined();
  });

  it('promoteAlternative moves entry from alternatives to checkpoints', async () => {
    const repo = makeRepo();
    // Clear seed data first
    localStorage.setItem('trip-planner:alternatives', JSON.stringify([]));
    const saved = await repo.addAlternative('t1', {
      type: 'poi',
      name: 'Kinkaku-ji',
      location: { lat: 35.0394, lng: 135.7292, label: 'Kinkakuji, Kyoto' },
    });

    const altCb = vi.fn();
    const cpCb = vi.fn();
    repo.subscribeToAlternatives('t1', altCb);
    repo.subscribeToCheckpoints('t1', cpCb);

    await repo.promoteAlternative('t1', saved.id, '2026-10-06T10:00:00.000Z');

    const alts = altCb.mock.calls[altCb.mock.calls.length - 1][0];
    expect(alts.find((a: { id: string }) => a.id === saved.id)).toBeUndefined();

    const cps = cpCb.mock.calls[cpCb.mock.calls.length - 1][0];
    expect(cps.some((c: { name: string }) => c.name === 'Kinkaku-ji')).toBe(true);
  });

  it('promoteAlternative throws when the alternative does not exist', async () => {
    const repo = makeRepo();
    await expect(
      repo.promoteAlternative('t1', 'nonexistent-id', '2026-10-06T10:00:00.000Z')
    ).rejects.toThrow('Alternative not found');
  });
});

// ── addAlternatives (batch) ──────────────────────────────────────────────────

describe('LocalTripRepository — addAlternatives (batch)', () => {
  it('returns all saved alternatives with ids', async () => {
    const repo = makeRepo();
    const saved = await repo.addAlternatives('t1', [
      { type: 'poi', name: 'Batch Alt A' },
      { type: 'poi', name: 'Batch Alt B' },
    ]);
    expect(saved).toHaveLength(2);
    expect(saved[0].id).toBeTruthy();
    expect(saved[1].id).toBeTruthy();
    expect(saved[0].id).not.toBe(saved[1].id);
  });

  it('notifies subscribers exactly once for the whole batch', async () => {
    const repo = makeRepo();
    const cb = vi.fn();
    repo.subscribeToAlternatives('t1', cb);
    const callsBefore = cb.mock.calls.length;
    await repo.addAlternatives('t1', [
      { type: 'poi', name: 'Batch Alt A' },
      { type: 'poi', name: 'Batch Alt B' },
    ]);
    expect(cb.mock.calls.length).toBe(callsBefore + 1);
    const latest = cb.mock.calls[cb.mock.calls.length - 1][0];
    expect(latest.some((a: { name: string }) => a.name === 'Batch Alt A')).toBe(true);
    expect(latest.some((a: { name: string }) => a.name === 'Batch Alt B')).toBe(true);
  });
});

// ── createTrip / updateTrip / deleteTrip ──────────────────────────────────────

describe('LocalTripRepository — createTrip', () => {
  it('sets ownerId to local-user', async () => {
    const repo = makeRepo();
    const trip = await repo.createTrip('My Trip', { start: '2027-01-01', end: '2027-01-10' });
    expect(trip.ownerId).toBe('local-user');
    expect(trip.memberIds).toEqual(['local-user']);
  });
});

describe('LocalTripRepository — updateTrip', () => {
  it('merges name/dateRange changes into the stored trip', async () => {
    const repo = makeRepo();
    const trip = await repo.createTrip('Original Name', { start: '2027-01-01', end: '2027-01-10' });
    await repo.updateTrip(trip.id, { name: 'Renamed' });
    const trips = await repo.listTrips();
    const updated = trips.find((t) => t.id === trip.id);
    expect(updated?.name).toBe('Renamed');
    expect(updated?.dateRange).toEqual({ start: '2027-01-01', end: '2027-01-10' });
  });

  it('leaves other trips untouched', async () => {
    const repo = makeRepo();
    const tripA = await repo.createTrip('Trip A', { start: '2027-01-01', end: '2027-01-10' });
    // createTrip ids are Date.now()-based; force a distinct millisecond so
    // tripA and tripB don't collide onto the same generated id.
    await new Promise((r) => setTimeout(r, 2));
    const tripB = await repo.createTrip('Trip B', { start: '2027-02-01', end: '2027-02-10' });
    await repo.updateTrip(tripA.id, { name: 'Trip A Renamed' });
    const trips = await repo.listTrips();
    expect(trips.find((t) => t.id === tripB.id)?.name).toBe('Trip B');
  });
});

describe('LocalTripRepository — deleteTrip', () => {
  it('removes the trip so it no longer appears in listTrips', async () => {
    const repo = makeRepo();
    const trip = await repo.createTrip('To Delete', { start: '2027-01-01', end: '2027-01-10' });
    await repo.deleteTrip(trip.id);
    const trips = await repo.listTrips();
    expect(trips.find((t) => t.id === trip.id)).toBeUndefined();
  });
});

// ── error recovery (catch branches) ──────────────────────────────────────────

describe('LocalTripRepository — corrupted localStorage recovery', () => {
  it('falls back to seed checkpoints when stored checkpoint JSON is invalid', () => {
    // Corrupt the checkpoints entry before the repo reads it
    localStorage.setItem('trip-planner:checkpoints', 'NOT_VALID_JSON{{{');
    const repo = makeRepo();
    const cb = vi.fn();
    repo.subscribeToCheckpoints('t1', cb);
    const cps = cb.mock.calls[0][0];
    // Should recover with seed data (non-empty array of valid checkpoints)
    expect(Array.isArray(cps)).toBe(true);
    expect(cps.length).toBeGreaterThan(0);
  });

  it('falls back to seed alternatives when stored alternatives JSON is invalid', () => {
    // Corrupt the alternatives entry before the repo reads it
    localStorage.setItem('trip-planner:alternatives', 'NOT_VALID_JSON{{{');
    const repo = makeRepo();
    const cb = vi.fn();
    repo.subscribeToAlternatives('t1', cb);
    const alts = cb.mock.calls[0][0];
    // Should recover with seed data (non-empty array of valid alternatives)
    expect(Array.isArray(alts)).toBe(true);
    expect(alts.length).toBeGreaterThan(0);
  });
});

// ── multiple subscribers (covers the "already has tripId" branch) ─────────────

describe('LocalTripRepository — multiple subscribers', () => {
  it('notifies a second checkpoint subscriber on the same tripId', async () => {
    const repo = makeRepo();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    // First subscribe populates the cpSubs Map entry
    repo.subscribeToCheckpoints('t1', cb1);
    // Second subscribe hits the else branch (Map already has 't1')
    repo.subscribeToCheckpoints('t1', cb2);
    expect(cb2).toHaveBeenCalledTimes(1);
    await repo.addCheckpoint('t1', {
      type: 'poi',
      name: 'Arashiyama',
      startTime: '2026-10-07T11:00:00.000Z',
    });
    // Both callbacks must have been notified about the new checkpoint
    const latest1 = cb1.mock.calls[cb1.mock.calls.length - 1][0];
    const latest2 = cb2.mock.calls[cb2.mock.calls.length - 1][0];
    expect(latest1.some((c: { name: string }) => c.name === 'Arashiyama')).toBe(true);
    expect(latest2.some((c: { name: string }) => c.name === 'Arashiyama')).toBe(true);
  });

  it('notifies a second alternatives subscriber on the same tripId', async () => {
    const repo = makeRepo();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    // First subscribe populates the altSubs Map entry
    repo.subscribeToAlternatives('t1', cb1);
    // Second subscribe hits the else branch (Map already has 't1')
    repo.subscribeToAlternatives('t1', cb2);
    expect(cb2).toHaveBeenCalledTimes(1);
    await repo.addAlternative('t1', { type: 'poi', name: 'Gion Corner' });
    // Both callbacks must have been notified about the new alternative
    const latest1 = cb1.mock.calls[cb1.mock.calls.length - 1][0];
    const latest2 = cb2.mock.calls[cb2.mock.calls.length - 1][0];
    expect(latest1.some((a: { name: string }) => a.name === 'Gion Corner')).toBe(true);
    expect(latest2.some((a: { name: string }) => a.name === 'Gion Corner')).toBe(true);
  });
});

// ── bookings ──────────────────────────────────────────────────────────────────

describe('LocalTripRepository — bookings', () => {
  it('addBooking persists and returns with a generated id', async () => {
    const repo = makeRepo();
    const saved = await repo.addBooking('t1', {
      provider: 'Japan Airlines',
      confirmationNumber: 'JL12345',
    });
    expect(saved.id).toBeTruthy();
    expect(saved.id).toMatch(/^local-booking-/);
    expect(saved.provider).toBe('Japan Airlines');
    expect(saved.confirmationNumber).toBe('JL12345');
  });

  it('addBooking persists across a new repo instance (via localStorage)', async () => {
    const repo1 = makeRepo();
    await repo1.addBooking('t1', { provider: 'ANA', confirmationNumber: 'ANA999' });
    const repo2 = makeRepo();
    const cb = vi.fn();
    repo2.subscribeToBookings('t1', cb);
    const bookings = cb.mock.calls[0][0];
    expect(bookings.some((b: { provider: string }) => b.provider === 'ANA')).toBe(true);
  });

  it('updateBooking merges changes', async () => {
    const repo = makeRepo();
    const saved = await repo.addBooking('t1', {
      provider: 'JAL',
      confirmationNumber: 'OLD-123',
    });
    await repo.updateBooking('t1', saved.id, { confirmationNumber: 'NEW-456' });
    const cb = vi.fn();
    repo.subscribeToBookings('t1', cb);
    const bookings = cb.mock.calls[0][0];
    const updated = bookings.find((b: { id: string }) => b.id === saved.id);
    expect(updated?.confirmationNumber).toBe('NEW-456');
    expect(updated?.provider).toBe('JAL');
  });

  it('deleteBooking removes the booking', async () => {
    const repo = makeRepo();
    const saved = await repo.addBooking('t1', {
      provider: 'Marriott',
      confirmationNumber: 'MAR-789',
    });
    await repo.deleteBooking('t1', saved.id);
    const cb = vi.fn();
    repo.subscribeToBookings('t1', cb);
    const bookings = cb.mock.calls[0][0];
    expect(bookings.find((b: { id: string }) => b.id === saved.id)).toBeUndefined();
  });

  it('subscribeToBookings immediately calls the callback', () => {
    const repo = makeRepo();
    const cb = vi.fn();
    repo.subscribeToBookings('t1', cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(Array.isArray(cb.mock.calls[0][0])).toBe(true);
  });

  it('subscribeToBookings notifies on addBooking mutation', async () => {
    const repo = makeRepo();
    const cb = vi.fn();
    repo.subscribeToBookings('t1', cb);
    const callsBefore = cb.mock.calls.length;
    await repo.addBooking('t1', { provider: 'Hilton', confirmationNumber: 'HLT-001' });
    expect(cb.mock.calls.length).toBeGreaterThan(callsBefore);
    const latest = cb.mock.calls[cb.mock.calls.length - 1][0];
    expect(latest.some((b: { provider: string }) => b.provider === 'Hilton')).toBe(true);
  });

  it('subscribeToBookings notifies on updateBooking mutation', async () => {
    const repo = makeRepo();
    const saved = await repo.addBooking('t1', { provider: 'Hyatt', confirmationNumber: 'HYT-001' });
    const cb = vi.fn();
    repo.subscribeToBookings('t1', cb);
    const callsBefore = cb.mock.calls.length;
    await repo.updateBooking('t1', saved.id, { confirmationNumber: 'HYT-002' });
    expect(cb.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('subscribeToBookings notifies on deleteBooking mutation', async () => {
    const repo = makeRepo();
    const saved = await repo.addBooking('t1', { provider: 'IHG', confirmationNumber: 'IHG-001' });
    const cb = vi.fn();
    repo.subscribeToBookings('t1', cb);
    const callsBefore = cb.mock.calls.length;
    await repo.deleteBooking('t1', saved.id);
    expect(cb.mock.calls.length).toBeGreaterThan(callsBefore);
    const latest = cb.mock.calls[cb.mock.calls.length - 1][0];
    expect(latest.find((b: { id: string }) => b.id === saved.id)).toBeUndefined();
  });

  it('subscribeToBookings unsubscribe stops future notifications', async () => {
    const repo = makeRepo();
    const cb = vi.fn();
    const unsub = repo.subscribeToBookings('t1', cb);
    unsub();
    await repo.addBooking('t1', { provider: 'After Unsub', confirmationNumber: 'X-001' });
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('LocalTripRepository — subscribeToTrip', () => {
  it('immediately calls back with the demo trip for an unknown id', () => {
    const repo = makeRepo();
    const cb = vi.fn();
    repo.subscribeToTrip('unknown-trip', cb);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ id: 'unknown-trip' }));
  });

  it('reflects membership changes after leaveTrip', async () => {
    const repo = makeRepo();
    const trip = await repo.createTrip('Test Trip', { start: '2026-01-01', end: '2026-01-05' });
    const cb = vi.fn();
    repo.subscribeToTrip(trip.id, cb);
    cb.mockClear();
    await repo.leaveTrip(trip.id);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ memberIds: [] }));
  });

  it('unsubscribe stops future notifications', async () => {
    const repo = makeRepo();
    const trip = await repo.createTrip('Test Trip', { start: '2026-01-01', end: '2026-01-05' });
    const cb = vi.fn();
    const unsub = repo.subscribeToTrip(trip.id, cb);
    unsub();
    const callsBefore = cb.mock.calls.length;
    await repo.leaveTrip(trip.id);
    expect(cb.mock.calls.length).toBe(callsBefore);
  });
});

describe('LocalTripRepository — membership', () => {
  it('removeMember removes the uid from memberIds and memberProfiles', async () => {
    const repo = makeRepo();
    const trip = await repo.createTrip('Test Trip', { start: '2026-01-01', end: '2026-01-05' });
    await repo.removeMember(trip.id, 'local-user');
    const [updated] = (await repo.listTrips()).filter((t) => t.id === trip.id);
    expect(updated.memberIds).not.toContain('local-user');
    expect(updated.memberProfiles?.['local-user']).toBeUndefined();
  });

  it('leaveTrip removes the local user', async () => {
    const repo = makeRepo();
    const trip = await repo.createTrip('Test Trip', { start: '2026-01-01', end: '2026-01-05' });
    await repo.leaveTrip(trip.id);
    const [updated] = (await repo.listTrips()).filter((t) => t.id === trip.id);
    expect(updated.memberIds).toEqual([]);
  });

  it('inviteMember throws — not available in local/offline mode', async () => {
    const repo = makeRepo();
    await expect(repo.inviteMember('t1', 'friend@example.com')).rejects.toThrow(
      /local\/offline mode/
    );
  });

  it('recordAccess resolves without error (no-op)', async () => {
    const repo = makeRepo();
    await expect(repo.recordAccess('t1')).resolves.toBeUndefined();
  });
});

describe('LocalTripRepository — activity log', () => {
  it('subscribeToActivityLog immediately calls back with the current log', () => {
    const repo = makeRepo();
    const cb = vi.fn();
    repo.subscribeToActivityLog('t1', cb);
    expect(cb).toHaveBeenCalledWith(expect.any(Array));
  });

  it('logs a checkpoint_added entry when a checkpoint is added', async () => {
    const repo = makeRepo();
    const cb = vi.fn();
    repo.subscribeToActivityLog('t1', cb);
    cb.mockClear();
    await repo.addCheckpoint('t1', {
      type: 'poi',
      name: 'Senso-ji',
      startTime: '2026-01-01T00:00:00.000Z',
    });
    expect(cb).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: 'checkpoint_added', entityName: 'Senso-ji' }),
      ])
    );
  });

  it('logs a single checkpoints_imported entry (not one per item) for a batch add', async () => {
    const repo = makeRepo();
    const cb = vi.fn();
    repo.subscribeToActivityLog('t1', cb);
    cb.mockClear();
    await repo.addCheckpoints('t1', [
      { type: 'poi', name: 'A', startTime: '2026-01-01T00:00:00.000Z' },
      { type: 'poi', name: 'B', startTime: '2026-01-02T00:00:00.000Z' },
    ]);
    const lastCallEntries = cb.mock.calls[cb.mock.calls.length - 1][0];
    const importEntries = lastCallEntries.filter(
      (e: { type: string }) => e.type === 'checkpoints_imported'
    );
    expect(importEntries).toHaveLength(1);
    expect(importEntries[0].count).toBe(2);
  });

  it('unsubscribe stops future notifications', async () => {
    const repo = makeRepo();
    const cb = vi.fn();
    const unsub = repo.subscribeToActivityLog('t1', cb);
    unsub();
    const callsBefore = cb.mock.calls.length;
    await repo.addCheckpoint('t1', {
      type: 'poi',
      name: 'After Unsub',
      startTime: '2026-01-01T00:00:00.000Z',
    });
    expect(cb.mock.calls.length).toBe(callsBefore);
  });
});
