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
