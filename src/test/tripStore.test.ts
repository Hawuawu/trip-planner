import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTripStore } from '../store/tripStore';
import { resetStores } from './helpers';
import type { TripRepository } from '../data/TripRepository';
import type { Trip, Checkpoint, Alternative } from '../types';

// ── Fixtures ────────────────────────────────────────────────────────────────

const TRIP: Trip = {
  id: 'trip-1',
  name: 'Japan 2026',
  dateRange: { start: '2026-10-01', end: '2026-10-14' },
  memberIds: ['u1'],
};

function makeCheckpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return {
    id: 'cp-1',
    type: 'flight',
    name: 'JFK → NRT',
    startTime: '2026-10-01T14:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── Mock repository factory ──────────────────────────────────────────────────

function makeMockRepo(overrides: Partial<TripRepository> = {}): TripRepository {
  return {
    getTrip: vi.fn().mockResolvedValue(TRIP),
    listTrips: vi.fn().mockResolvedValue([TRIP]),
    createTrip: vi.fn().mockResolvedValue(TRIP),
    updateTrip: vi.fn().mockResolvedValue(undefined),
    deleteTrip: vi.fn().mockResolvedValue(undefined),
    subscribeToCheckpoints: vi.fn().mockReturnValue(() => {}),
    addCheckpoint: vi.fn().mockResolvedValue(makeCheckpoint({ id: 'saved-1' })),
    addCheckpoints: vi.fn().mockResolvedValue([makeCheckpoint({ id: 'saved-1' })]),
    updateCheckpoint: vi.fn().mockResolvedValue(undefined),
    deleteCheckpoint: vi.fn().mockResolvedValue(undefined),
    subscribeToAlternatives: vi.fn().mockReturnValue(() => {}),
    addAlternative: vi.fn().mockResolvedValue({ id: 'alt-saved-1', type: 'poi', name: 'New Alt' }),
    addAlternatives: vi
      .fn()
      .mockResolvedValue([{ id: 'alt-saved-1', type: 'poi', name: 'New Alt' }]),
    deleteAlternative: vi.fn().mockResolvedValue(undefined),
    promoteAlternative: vi.fn().mockResolvedValue(undefined),
    subscribeToBookings: vi.fn().mockReturnValue(() => {}),
    addBooking: vi.fn().mockResolvedValue({
      id: 'bk-saved-1',
      provider: 'Japan Airlines',
      confirmationNumber: 'JL-001',
    }),
    updateBooking: vi.fn().mockResolvedValue(undefined),
    deleteBooking: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStores();
});

describe('tripStore — init', () => {
  it('calls getTrip and both subscribe methods on init', () => {
    const repo = makeMockRepo();
    useTripStore.getState().init('trip-1', repo);
    expect(repo.getTrip).toHaveBeenCalledWith('trip-1');
    expect(repo.subscribeToCheckpoints).toHaveBeenCalledWith('trip-1', expect.any(Function));
    expect(repo.subscribeToAlternatives).toHaveBeenCalledWith('trip-1', expect.any(Function));
  });

  it('sets tripId and repo in state', () => {
    const repo = makeMockRepo();
    useTripStore.getState().init('trip-1', repo);
    const { tripId, repo: storedRepo } = useTripStore.getState();
    expect(tripId).toBe('trip-1');
    expect(storedRepo).toBe(repo);
  });
});

describe('tripStore — selectCheckpoint', () => {
  it('sets selectedId', () => {
    useTripStore.getState().selectCheckpoint('cp-42');
    expect(useTripStore.getState().selectedId).toBe('cp-42');
  });

  it('clears selectedId when called with null', () => {
    useTripStore.setState({ selectedId: 'cp-42' });
    useTripStore.getState().selectCheckpoint(null);
    expect(useTripStore.getState().selectedId).toBeNull();
  });

  it('deselects (sets to null) when the same id is called again', () => {
    useTripStore.getState().selectCheckpoint('cp-42');
    useTripStore.getState().selectCheckpoint('cp-42');
    expect(useTripStore.getState().selectedId).toBeNull();
  });

  it('switches to a different id', () => {
    useTripStore.getState().selectCheckpoint('cp-1');
    useTripStore.getState().selectCheckpoint('cp-2');
    expect(useTripStore.getState().selectedId).toBe('cp-2');
  });
});

describe('tripStore — addCheckpoint (optimistic)', () => {
  it('adds an optimistic checkpoint immediately before the repo resolves', async () => {
    let resolveAdd!: (c: Checkpoint) => void;
    const addCheckpoint = vi.fn(
      () =>
        new Promise<Checkpoint>((res) => {
          resolveAdd = res;
        })
    );
    const repo = makeMockRepo({ addCheckpoint });

    useTripStore.setState({ repo, tripId: 'trip-1', checkpoints: [] });

    const promise = useTripStore
      .getState()
      .addCheckpoint({ type: 'poi', name: 'Fushimi', startTime: '2026-10-06T08:00:00.000Z' });

    // Before the repo resolves, an optimistic checkpoint should already be in state
    const { checkpoints } = useTripStore.getState();
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0].id).toMatch(/__optimistic/);
    expect(checkpoints[0].name).toBe('Fushimi');

    // Resolve the repo call
    resolveAdd(makeCheckpoint({ id: 'final-id', name: 'Fushimi' }));
    await promise;

    // Optimistic entry replaced by the saved one
    const after = useTripStore.getState().checkpoints;
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe('final-id');
  });

  it('sorts checkpoints by startTime after adding', async () => {
    const repo = makeMockRepo({
      addCheckpoint: vi
        .fn()
        .mockResolvedValue(
          makeCheckpoint({ id: 'new', startTime: '2026-10-03T08:00:00.000Z', name: 'Middle' })
        ),
    });
    useTripStore.setState({
      repo,
      tripId: 'trip-1',
      checkpoints: [
        makeCheckpoint({ id: 'a', startTime: '2026-10-01T00:00:00.000Z', name: 'First' }),
        makeCheckpoint({ id: 'b', startTime: '2026-10-05T00:00:00.000Z', name: 'Last' }),
      ],
    });

    await useTripStore
      .getState()
      .addCheckpoint({ type: 'poi', name: 'Middle', startTime: '2026-10-03T08:00:00.000Z' });

    const names = useTripStore.getState().checkpoints.map((c) => c.name);
    expect(names).toEqual(['First', 'Middle', 'Last']);
  });

  it('does nothing when repo is null', async () => {
    useTripStore.setState({ repo: null, tripId: 'trip-1' });
    await useTripStore
      .getState()
      .addCheckpoint({ type: 'poi', name: 'X', startTime: '2026-01-01T00:00:00.000Z' });
    expect(useTripStore.getState().checkpoints).toHaveLength(0);
  });
});

describe('tripStore — updateCheckpoint (optimistic + rollback)', () => {
  it('applies changes to state immediately before repo resolves', async () => {
    let resolveUpdate!: () => void;
    const updateCheckpoint = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolveUpdate = res;
        })
    );
    const repo = makeMockRepo({ updateCheckpoint });
    const original = makeCheckpoint({ id: 'cp-1', name: 'Original' });
    useTripStore.setState({ repo, tripId: 'trip-1', checkpoints: [original] });

    const promise = useTripStore.getState().updateCheckpoint('cp-1', { name: 'Updated' });

    // Optimistic update already applied
    expect(useTripStore.getState().checkpoints[0].name).toBe('Updated');

    resolveUpdate();
    await promise;
    expect(useTripStore.getState().checkpoints[0].name).toBe('Updated');
  });

  it('rolls back to the previous value when the repo throws', async () => {
    const updateCheckpoint = vi.fn().mockRejectedValue(new Error('network'));
    const repo = makeMockRepo({ updateCheckpoint });
    const original = makeCheckpoint({ id: 'cp-1', name: 'Original' });
    useTripStore.setState({ repo, tripId: 'trip-1', checkpoints: [original] });

    await useTripStore.getState().updateCheckpoint('cp-1', { name: 'Failed Update' });

    expect(useTripStore.getState().checkpoints[0].name).toBe('Original');
  });
});

describe('tripStore — deleteCheckpoint (optimistic + undo)', () => {
  it('removes the checkpoint immediately and sets undoCheckpoint', async () => {
    let resolveDelete!: () => void;
    const deleteCheckpoint = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolveDelete = res;
        })
    );
    const repo = makeMockRepo({ deleteCheckpoint });
    const cp = makeCheckpoint({ id: 'cp-1' });
    useTripStore.setState({ repo, tripId: 'trip-1', checkpoints: [cp] });

    const promise = useTripStore.getState().deleteCheckpoint('cp-1');

    expect(useTripStore.getState().checkpoints).toHaveLength(0);
    expect(useTripStore.getState().undoCheckpoint).toEqual(cp);

    resolveDelete();
    await promise;
  });

  it('restores the checkpoint when the delete fails', async () => {
    const deleteCheckpoint = vi.fn().mockRejectedValue(new Error('network'));
    const repo = makeMockRepo({ deleteCheckpoint });
    const cp = makeCheckpoint({
      id: 'cp-1',
      name: 'Restored',
      startTime: '2026-10-01T14:00:00.000Z',
    });
    useTripStore.setState({ repo, tripId: 'trip-1', checkpoints: [cp] });

    await useTripStore.getState().deleteCheckpoint('cp-1');

    expect(useTripStore.getState().checkpoints).toHaveLength(1);
    expect(useTripStore.getState().checkpoints[0].name).toBe('Restored');
  });

  it('undoDelete re-adds the checkpoint via addCheckpoint', async () => {
    const savedAfterUndo = makeCheckpoint({ id: 'undo-id', name: 'Restored' });
    const repo = makeMockRepo({
      deleteCheckpoint: vi.fn().mockResolvedValue(undefined),
      addCheckpoint: vi.fn().mockResolvedValue(savedAfterUndo),
    });
    const cp = makeCheckpoint({
      id: 'cp-1',
      name: 'Restored',
      startTime: '2026-10-01T14:00:00.000Z',
    });
    useTripStore.setState({ repo, tripId: 'trip-1', checkpoints: [cp] });

    await useTripStore.getState().deleteCheckpoint('cp-1');
    expect(useTripStore.getState().undoCheckpoint).not.toBeNull();

    await useTripStore.getState().undoDelete();

    expect(useTripStore.getState().undoCheckpoint).toBeNull();
    expect(repo.addCheckpoint).toHaveBeenCalled();
    expect(useTripStore.getState().checkpoints.some((c) => c.id === 'undo-id')).toBe(true);
  });

  it('clearUndo sets undoCheckpoint to null', () => {
    useTripStore.setState({ undoCheckpoint: makeCheckpoint() });
    useTripStore.getState().clearUndo();
    expect(useTripStore.getState().undoCheckpoint).toBeNull();
  });
});

describe('tripStore — alternatives', () => {
  it('addAlternative appends optimistically then replaces with saved', async () => {
    let resolveAdd!: (a: Alternative) => void;
    const addAlternative = vi.fn(
      () =>
        new Promise<Alternative>((res) => {
          resolveAdd = res;
        })
    );
    const repo = makeMockRepo({ addAlternative });
    useTripStore.setState({ repo, tripId: 'trip-1', alternatives: [] });

    const promise = useTripStore.getState().addAlternative({ type: 'poi', name: 'teamLab' });

    expect(useTripStore.getState().alternatives).toHaveLength(1);
    expect(useTripStore.getState().alternatives[0].id).toMatch(/__optimistic/);

    resolveAdd({ id: 'alt-real', type: 'poi', name: 'teamLab' });
    await promise;

    expect(useTripStore.getState().alternatives[0].id).toBe('alt-real');
  });

  it('deleteAlternative removes the entry optimistically', async () => {
    const repo = makeMockRepo();
    const alt: Alternative = { id: 'alt-1', type: 'poi', name: 'Nishiki' };
    useTripStore.setState({ repo, tripId: 'trip-1', alternatives: [alt] });

    await useTripStore.getState().deleteAlternative('alt-1');

    expect(useTripStore.getState().alternatives).toHaveLength(0);
    expect(repo.deleteAlternative).toHaveBeenCalledWith('trip-1', 'alt-1');
  });

  it('promoteAlternative removes the alternative and calls repo', async () => {
    const repo = makeMockRepo();
    const alt: Alternative = { id: 'alt-1', type: 'poi', name: 'Nishiki' };
    useTripStore.setState({ repo, tripId: 'trip-1', alternatives: [alt] });

    await useTripStore.getState().promoteAlternative('alt-1', '2026-10-06T10:00:00.000Z');

    expect(useTripStore.getState().alternatives).toHaveLength(0);
    expect(repo.promoteAlternative).toHaveBeenCalledWith(
      'trip-1',
      'alt-1',
      '2026-10-06T10:00:00.000Z'
    );
  });
});

describe('tripStore — importCheckpoints', () => {
  it('calls addCheckpoints and addAlternatives with the given items', async () => {
    const repo = makeMockRepo();
    useTripStore.setState({ repo, tripId: 'trip-1' });

    const checkpoints = [
      { type: 'poi' as const, name: 'Nara Deer Park', startTime: '2026-10-09T09:00:00.000Z' },
    ];
    const alternatives = [{ type: 'poi' as const, name: 'Todai-ji Temple' }];

    await useTripStore.getState().importCheckpoints({ checkpoints, alternatives });

    expect(repo.addCheckpoints).toHaveBeenCalledWith('trip-1', checkpoints);
    expect(repo.addAlternatives).toHaveBeenCalledWith('trip-1', alternatives);
  });

  it('does not call addCheckpoints when the checkpoints list is empty', async () => {
    const repo = makeMockRepo();
    useTripStore.setState({ repo, tripId: 'trip-1' });

    await useTripStore.getState().importCheckpoints({ checkpoints: [], alternatives: [] });

    expect(repo.addCheckpoints).not.toHaveBeenCalled();
    expect(repo.addAlternatives).not.toHaveBeenCalled();
  });

  it('does not manually set local checkpoints/alternatives state (relies on subscriptions)', async () => {
    const repo = makeMockRepo();
    useTripStore.setState({ repo, tripId: 'trip-1', checkpoints: [], alternatives: [] });

    await useTripStore.getState().importCheckpoints({
      checkpoints: [
        { type: 'poi' as const, name: 'Nara Deer Park', startTime: '2026-10-09T09:00:00.000Z' },
      ],
      alternatives: [],
    });

    // No optimistic/manual update — state stays empty until the (mocked, inert)
    // subscription callback would push new data in.
    expect(useTripStore.getState().checkpoints).toEqual([]);
  });

  it('is a no-op when repo/tripId are not set', async () => {
    const repo = makeMockRepo();
    await useTripStore.getState().importCheckpoints({
      checkpoints: [
        { type: 'poi' as const, name: 'Nara Deer Park', startTime: '2026-10-09T09:00:00.000Z' },
      ],
      alternatives: [],
    });
    expect(repo.addCheckpoints).not.toHaveBeenCalled();
  });
});

describe('tripStore — bookings', () => {
  it('addBooking inserts optimistically then replaces with saved booking', async () => {
    let resolveAdd!: (b: import('../types').Booking) => void;
    const addBooking = vi.fn(
      () =>
        new Promise<import('../types').Booking>((res) => {
          resolveAdd = res;
        })
    );
    const repo = makeMockRepo({ addBooking });
    useTripStore.setState({ repo, tripId: 'trip-1', bookings: [] });

    const promise = useTripStore.getState().addBooking({
      provider: 'Japan Airlines',
      confirmationNumber: 'JL-001',
    });

    // Optimistic entry is in state immediately
    const { bookings } = useTripStore.getState();
    expect(bookings).toHaveLength(1);
    expect(bookings[0].id).toMatch(/__optimistic-booking/);
    expect(bookings[0].provider).toBe('Japan Airlines');

    // Resolve with saved
    resolveAdd({ id: 'booking-saved-1', provider: 'Japan Airlines', confirmationNumber: 'JL-001' });
    await promise;

    const after = useTripStore.getState().bookings;
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe('booking-saved-1');
  });

  it('addBooking returns the saved booking', async () => {
    const savedBooking = { id: 'bk-1', provider: 'ANA', confirmationNumber: 'ANA-999' };
    const repo = makeMockRepo({
      addBooking: vi.fn().mockResolvedValue(savedBooking),
    });
    useTripStore.setState({ repo, tripId: 'trip-1', bookings: [] });

    const result = await useTripStore.getState().addBooking({
      provider: 'ANA',
      confirmationNumber: 'ANA-999',
    });

    expect(result).toEqual(savedBooking);
  });

  it('updateBooking applies changes optimistically', async () => {
    let resolveUpdate!: () => void;
    const updateBooking = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolveUpdate = res;
        })
    );
    const repo = makeMockRepo({ updateBooking });
    const original = { id: 'bk-1', provider: 'JAL', confirmationNumber: 'OLD-123' };
    useTripStore.setState({ repo, tripId: 'trip-1', bookings: [original] });

    const promise = useTripStore
      .getState()
      .updateBooking('bk-1', { confirmationNumber: 'NEW-456' });

    // Optimistic update already applied
    expect(useTripStore.getState().bookings[0].confirmationNumber).toBe('NEW-456');

    resolveUpdate();
    await promise;
    expect(useTripStore.getState().bookings[0].confirmationNumber).toBe('NEW-456');
  });

  it('updateBooking rolls back when repo throws', async () => {
    const updateBooking = vi.fn().mockRejectedValue(new Error('network'));
    const repo = makeMockRepo({ updateBooking });
    const original = { id: 'bk-1', provider: 'JAL', confirmationNumber: 'OLD-123' };
    useTripStore.setState({ repo, tripId: 'trip-1', bookings: [original] });

    await useTripStore.getState().updateBooking('bk-1', { confirmationNumber: 'FAILED' });

    expect(useTripStore.getState().bookings[0].confirmationNumber).toBe('OLD-123');
  });

  it('deleteBooking removes the booking immediately', async () => {
    let resolveDelete!: () => void;
    const deleteBooking = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolveDelete = res;
        })
    );
    const repo = makeMockRepo({ deleteBooking });
    const booking = { id: 'bk-1', provider: 'Marriott', confirmationNumber: 'MAR-001' };
    useTripStore.setState({ repo, tripId: 'trip-1', bookings: [booking] });

    const promise = useTripStore.getState().deleteBooking('bk-1');

    expect(useTripStore.getState().bookings).toHaveLength(0);

    resolveDelete();
    await promise;
    expect(repo.deleteBooking).toHaveBeenCalledWith('trip-1', 'bk-1');
  });

  it('init subscribes to bookings via repo.subscribeToBookings', () => {
    const repo = makeMockRepo();
    useTripStore.getState().init('trip-1', repo);
    expect(repo.subscribeToBookings).toHaveBeenCalledWith('trip-1', expect.any(Function));
  });
});
