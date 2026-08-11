import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTripStore } from '../store/tripStore';
import { resetStores } from './helpers';
import type { TripRepository } from '../data/TripRepository';
import type { Trip, Checkpoint, Alternative, ActivityLogEntry } from '../types';

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
    subscribeToTrip: vi.fn().mockReturnValue(() => {}),
    listTrips: vi.fn().mockResolvedValue([TRIP]),
    createTrip: vi.fn().mockResolvedValue(TRIP),
    updateTrip: vi.fn().mockResolvedValue(undefined),
    deleteTrip: vi.fn().mockResolvedValue(undefined),
    inviteMember: vi.fn().mockResolvedValue({ status: 'invited', uid: 'invitee-1' }),
    removeMember: vi.fn().mockResolvedValue(undefined),
    leaveTrip: vi.fn().mockResolvedValue(undefined),
    recordAccess: vi.fn().mockResolvedValue(undefined),
    subscribeToActivityLog: vi.fn().mockReturnValue(() => {}),
    getActivityLogBefore: vi.fn().mockResolvedValue({ entries: [], hasMore: false }),
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
    subscribeToRoutes: vi.fn().mockReturnValue(() => {}),
    addRoute: vi.fn().mockResolvedValue({
      id: 'route-saved-1',
      name: 'New Route',
      days: ['2026-10-05'],
      checkpointIds: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    updateRoute: vi.fn().mockResolvedValue(undefined),
    deleteRoute: vi.fn().mockResolvedValue(undefined),
    subscribeToWikiSections: vi.fn().mockReturnValue(() => {}),
    addWikiSection: vi.fn().mockResolvedValue({
      id: 'wiki-saved-1',
      title: 'New Section',
      content: '',
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    updateWikiSection: vi.fn().mockResolvedValue(undefined),
    deleteWikiSection: vi.fn().mockResolvedValue(undefined),
    subscribeToBudgets: vi.fn().mockReturnValue(() => {}),
    addBudget: vi.fn().mockResolvedValue({
      id: 'budget-saved-1',
      name: 'New Budget',
      currency: 'JPY',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    updateBudget: vi.fn().mockResolvedValue(undefined),
    deleteBudget: vi.fn().mockResolvedValue(undefined),
    subscribeToBudgetSections: vi.fn().mockReturnValue(() => {}),
    addBudgetSection: vi.fn().mockResolvedValue({
      id: 'budget-section-saved-1',
      budgetId: 'budget-1',
      category: 'other',
      name: 'New Section',
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    updateBudgetSection: vi.fn().mockResolvedValue(undefined),
    deleteBudgetSection: vi.fn().mockResolvedValue(undefined),
    subscribeToBudgetItems: vi.fn().mockReturnValue(() => {}),
    addBudgetItem: vi.fn().mockResolvedValue({
      id: 'budget-item-saved-1',
      budgetSectionId: 'budget-section-1',
      name: 'New Item',
      rateType: 'constant',
      quantity: 1,
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    updateBudgetItem: vi.fn().mockResolvedValue(undefined),
    deleteBudgetItem: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStores();
});

describe('tripStore — init', () => {
  it('calls subscribeToTrip and both subscribe methods on init', () => {
    const repo = makeMockRepo();
    useTripStore.getState().init('trip-1', repo);
    expect(repo.subscribeToTrip).toHaveBeenCalledWith('trip-1', expect.any(Function));
    expect(repo.subscribeToCheckpoints).toHaveBeenCalledWith('trip-1', expect.any(Function));
    expect(repo.subscribeToAlternatives).toHaveBeenCalledWith('trip-1', expect.any(Function));
  });

  it('subscribes to the activity log and records access on init', () => {
    const repo = makeMockRepo();
    useTripStore.getState().init('trip-1', repo);
    expect(repo.subscribeToActivityLog).toHaveBeenCalledWith('trip-1', expect.any(Function));
    expect(repo.recordAccess).toHaveBeenCalledWith('trip-1');
  });

  it('subscribes to routes on init', () => {
    const repo = makeMockRepo();
    useTripStore.getState().init('trip-1', repo);
    expect(repo.subscribeToRoutes).toHaveBeenCalledWith('trip-1', expect.any(Function));
  });

  it('sets tripId and repo in state', () => {
    const repo = makeMockRepo();
    useTripStore.getState().init('trip-1', repo);
    const { tripId, repo: storedRepo } = useTripStore.getState();
    expect(tripId).toBe('trip-1');
    expect(storedRepo).toBe(repo);
  });

  it('sets tripLoading, checkpointsLoading, alternativesLoading to true immediately on init', () => {
    const repo = makeMockRepo();
    useTripStore.getState().init('trip-1', repo);
    const { tripLoading, checkpointsLoading, alternativesLoading } = useTripStore.getState();
    expect(tripLoading).toBe(true);
    expect(checkpointsLoading).toBe(true);
    expect(alternativesLoading).toBe(true);
  });

  it('flips each loading flag independently as its subscription callback fires', () => {
    let tripCb: (t: Trip) => void = () => {};
    let checkpointsCb: (c: Checkpoint[]) => void = () => {};
    const repo = makeMockRepo({
      subscribeToTrip: vi.fn((_id, cb) => {
        tripCb = cb;
        return () => {};
      }),
      subscribeToCheckpoints: vi.fn((_id, cb) => {
        checkpointsCb = cb;
        return () => {};
      }),
    });
    useTripStore.getState().init('trip-1', repo);

    tripCb(TRIP);
    expect(useTripStore.getState().tripLoading).toBe(false);
    expect(useTripStore.getState().checkpointsLoading).toBe(true);

    checkpointsCb([]);
    expect(useTripStore.getState().checkpointsLoading).toBe(false);
  });

  it('resets all three loading flags to true when init is called again for a new trip', () => {
    const repo1 = makeMockRepo({
      subscribeToTrip: vi.fn((_id, cb) => {
        cb(TRIP);
        return () => {};
      }),
    });
    useTripStore.getState().init('trip-1', repo1);
    expect(useTripStore.getState().tripLoading).toBe(false);

    const repo2 = makeMockRepo();
    useTripStore.getState().init('trip-2', repo2);
    expect(useTripStore.getState().tripLoading).toBe(true);
    expect(useTripStore.getState().checkpointsLoading).toBe(true);
    expect(useTripStore.getState().alternativesLoading).toBe(true);
  });
});

// ── Helpers for loadMoreActivityLog ─────────────────────────────────────────

function makeLogEntry(overrides: Partial<ActivityLogEntry> = {}): ActivityLogEntry {
  return {
    id: 'e1',
    type: 'checkpoint_added',
    actorUid: 'u1',
    actorLabel: 'Alice',
    entityName: 'Senso-ji',
    createdAt: '2026-01-05T00:00:00.000Z',
    ...overrides,
  };
}

function initWithLiveLog(repo: TripRepository, entries: ActivityLogEntry[]) {
  let cb: (e: ActivityLogEntry[]) => void = () => {};
  (repo.subscribeToActivityLog as ReturnType<typeof vi.fn>).mockImplementation((_tripId, fn) => {
    cb = fn;
    return () => {};
  });
  useTripStore.getState().init('trip-1', repo);
  cb(entries);
}

describe('tripStore — loadMoreActivityLog', () => {
  it('appends the returned page and updates hasMore on the happy path', async () => {
    const liveEntries = Array.from({ length: 100 }, (_, i) =>
      makeLogEntry({
        id: `live-${i}`,
        createdAt: `2026-01-05T00:00:${String(i).padStart(2, '0')}.000Z`,
      })
    );
    const olderEntries = [makeLogEntry({ id: 'older-1', createdAt: '2026-01-04T00:00:00.000Z' })];
    const getActivityLogBefore = vi
      .fn()
      .mockResolvedValue({ entries: olderEntries, hasMore: false });
    const repo = makeMockRepo({ getActivityLogBefore });
    initWithLiveLog(repo, liveEntries);

    expect(useTripStore.getState().activityLogHasMore).toBe(true);

    await useTripStore.getState().loadMoreActivityLog();

    expect(getActivityLogBefore).toHaveBeenCalledWith('trip-1', {
      createdAt: liveEntries[liveEntries.length - 1].createdAt,
      id: liveEntries[liveEntries.length - 1].id,
    });
    const finalLog = useTripStore.getState().activityLog;
    expect(finalLog).toHaveLength(101);
    expect(finalLog[finalLog.length - 1]).toEqual(olderEntries[0]);
    expect(useTripStore.getState().activityLogHasMore).toBe(false);
    expect(useTripStore.getState().activityLogLoadingMore).toBe(false);
  });

  it('dedupes entries that overlap with what is already loaded', async () => {
    const liveEntries = [makeLogEntry({ id: 'e1' }), makeLogEntry({ id: 'e2' })];
    const getActivityLogBefore = vi.fn().mockResolvedValue({
      entries: [makeLogEntry({ id: 'e2' }), makeLogEntry({ id: 'e3' })],
      hasMore: false,
    });
    const repo = makeMockRepo({ getActivityLogBefore });
    useTripStore.setState({ activityLogHasMore: true });
    initWithLiveLog(repo, liveEntries);
    useTripStore.setState({ activityLogHasMore: true });

    await useTripStore.getState().loadMoreActivityLog();

    const ids = useTripStore.getState().activityLog.map((e) => e.id);
    expect(ids).toEqual(['e1', 'e2', 'e3']);
  });

  it('is a no-op when activityLogHasMore is false', async () => {
    const getActivityLogBefore = vi.fn();
    const repo = makeMockRepo({ getActivityLogBefore });
    initWithLiveLog(repo, [makeLogEntry()]);

    expect(useTripStore.getState().activityLogHasMore).toBe(false);
    await useTripStore.getState().loadMoreActivityLog();

    expect(getActivityLogBefore).not.toHaveBeenCalled();
  });

  it('is a no-op when a load is already in flight', async () => {
    const getActivityLogBefore = vi.fn().mockResolvedValue({ entries: [], hasMore: false });
    const repo = makeMockRepo({ getActivityLogBefore });
    initWithLiveLog(repo, [makeLogEntry()]);
    useTripStore.setState({ activityLogHasMore: true, activityLogLoadingMore: true });

    await useTripStore.getState().loadMoreActivityLog();

    expect(getActivityLogBefore).not.toHaveBeenCalled();
  });
});

describe('tripStore — membership', () => {
  it('inviteMember passes through to repo.inviteMember and returns the result', async () => {
    const inviteMember = vi.fn().mockResolvedValue({ status: 'invited', uid: 'invitee-1' });
    const repo = makeMockRepo({ inviteMember });
    useTripStore.getState().init('trip-1', repo);
    const result = await useTripStore.getState().inviteMember('friend@example.com');
    expect(inviteMember).toHaveBeenCalledWith('trip-1', 'friend@example.com');
    expect(result).toEqual({ status: 'invited', uid: 'invitee-1' });
  });

  it('removeMember optimistically removes the uid from trip.memberIds', async () => {
    const repo = makeMockRepo();
    useTripStore.getState().init('trip-1', repo);
    useTripStore.setState({ trip: { ...TRIP, memberIds: ['u1', 'u2'] } });
    await useTripStore.getState().removeMember('u2');
    expect(repo.removeMember).toHaveBeenCalledWith('trip-1', 'u2');
    expect(useTripStore.getState().trip?.memberIds).toEqual(['u1']);
  });

  it('removeMember rolls back on failure and rethrows', async () => {
    const removeMember = vi.fn().mockRejectedValue(new Error('denied'));
    const repo = makeMockRepo({ removeMember });
    useTripStore.getState().init('trip-1', repo);
    useTripStore.setState({ trip: { ...TRIP, memberIds: ['u1', 'u2'] } });
    await expect(useTripStore.getState().removeMember('u2')).rejects.toThrow('denied');
    expect(useTripStore.getState().trip?.memberIds).toEqual(['u1', 'u2']);
  });

  it('leaveTrip calls repo.leaveTrip with the current tripId', async () => {
    const repo = makeMockRepo();
    useTripStore.getState().init('trip-1', repo);
    await useTripStore.getState().leaveTrip();
    expect(repo.leaveTrip).toHaveBeenCalledWith('trip-1');
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

  it('clears any selected alternative — checkpoint and POI selection are mutually exclusive', () => {
    useTripStore.setState({ selectedAlternativeId: 'alt-1' });
    useTripStore.getState().selectCheckpoint('cp-1');
    expect(useTripStore.getState().selectedId).toBe('cp-1');
    expect(useTripStore.getState().selectedAlternativeId).toBeNull();
  });
});

describe('tripStore — selectAlternative', () => {
  it('sets selectedAlternativeId', () => {
    useTripStore.getState().selectAlternative('alt-42');
    expect(useTripStore.getState().selectedAlternativeId).toBe('alt-42');
  });

  it('deselects (sets to null) when the same id is called again', () => {
    useTripStore.getState().selectAlternative('alt-42');
    useTripStore.getState().selectAlternative('alt-42');
    expect(useTripStore.getState().selectedAlternativeId).toBeNull();
  });

  it('switches to a different id', () => {
    useTripStore.getState().selectAlternative('alt-1');
    useTripStore.getState().selectAlternative('alt-2');
    expect(useTripStore.getState().selectedAlternativeId).toBe('alt-2');
  });

  it('clears any selected checkpoint — checkpoint and POI selection are mutually exclusive', () => {
    useTripStore.setState({ selectedId: 'cp-1' });
    useTripStore.getState().selectAlternative('alt-1');
    expect(useTripStore.getState().selectedAlternativeId).toBe('alt-1');
    expect(useTripStore.getState().selectedId).toBeNull();
  });
});

describe('tripStore — selectDay / selectRoute', () => {
  it('selectDay sets selectedDay without touching an active route', () => {
    useTripStore.setState({ selectedRouteId: 'route-1' });
    useTripStore.getState().selectDay('2026-10-05');
    expect(useTripStore.getState().selectedDay).toBe('2026-10-05');
    expect(useTripStore.getState().selectedRouteId).toBe('route-1');
  });

  it('selectDay(null) clears the day filter', () => {
    useTripStore.setState({ selectedDay: '2026-10-05' });
    useTripStore.getState().selectDay(null);
    expect(useTripStore.getState().selectedDay).toBeNull();
  });

  it('selectRoute sets selectedRouteId without touching an active day', () => {
    useTripStore.setState({ selectedDay: '2026-10-05' });
    useTripStore.getState().selectRoute('route-1');
    expect(useTripStore.getState().selectedRouteId).toBe('route-1');
    expect(useTripStore.getState().selectedDay).toBe('2026-10-05');
  });

  it('selectRoute(null) clears the active route', () => {
    useTripStore.setState({ selectedRouteId: 'route-1' });
    useTripStore.getState().selectRoute(null);
    expect(useTripStore.getState().selectedRouteId).toBeNull();
  });
});

describe('tripStore — navigateToBudget / navigateToBudgetItem', () => {
  it('navigateToBudget sets budgetNavigationTarget with a null itemId', () => {
    useTripStore.getState().navigateToBudget('budget-1');
    expect(useTripStore.getState().budgetNavigationTarget).toEqual({
      budgetId: 'budget-1',
      itemId: null,
    });
  });

  it('navigateToBudgetItem resolves the item’s parent budget via its section', () => {
    useTripStore.setState({
      budgetSections: [
        {
          id: 'section-1',
          budgetId: 'budget-1',
          category: 'hotel',
          name: 'Hotel',
          order: 0,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      budgetItems: [
        {
          id: 'item-1',
          budgetSectionId: 'section-1',
          name: 'Ryokan',
          rateType: 'constant',
          quantity: 1,
          order: 0,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    useTripStore.getState().navigateToBudgetItem('item-1');

    expect(useTripStore.getState().budgetNavigationTarget).toEqual({
      budgetId: 'budget-1',
      itemId: 'item-1',
    });
  });

  it('navigateToBudgetItem is a no-op for an unknown item id', () => {
    useTripStore.getState().navigateToBudgetItem('missing');
    expect(useTripStore.getState().budgetNavigationTarget).toBeNull();
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

  it('rolls back to the previous value and rethrows when the repo throws', async () => {
    const updateCheckpoint = vi.fn().mockRejectedValue(new Error('network'));
    const repo = makeMockRepo({ updateCheckpoint });
    const original = makeCheckpoint({ id: 'cp-1', name: 'Original' });
    useTripStore.setState({ repo, tripId: 'trip-1', checkpoints: [original] });

    await expect(
      useTripStore.getState().updateCheckpoint('cp-1', { name: 'Failed Update' })
    ).rejects.toThrow('network');

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

  it('restores the checkpoint and rethrows when the delete fails', async () => {
    const deleteCheckpoint = vi.fn().mockRejectedValue(new Error('network'));
    const repo = makeMockRepo({ deleteCheckpoint });
    const cp = makeCheckpoint({
      id: 'cp-1',
      name: 'Restored',
      startTime: '2026-10-01T14:00:00.000Z',
    });
    useTripStore.setState({ repo, tripId: 'trip-1', checkpoints: [cp] });

    await expect(useTripStore.getState().deleteCheckpoint('cp-1')).rejects.toThrow('network');

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

  it('updateBooking rolls back and rethrows when repo throws', async () => {
    const updateBooking = vi.fn().mockRejectedValue(new Error('network'));
    const repo = makeMockRepo({ updateBooking });
    const original = { id: 'bk-1', provider: 'JAL', confirmationNumber: 'OLD-123' };
    useTripStore.setState({ repo, tripId: 'trip-1', bookings: [original] });

    await expect(
      useTripStore.getState().updateBooking('bk-1', { confirmationNumber: 'FAILED' })
    ).rejects.toThrow('network');

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

describe('tripStore — routes', () => {
  it('addRoute appends optimistically then replaces with saved', async () => {
    let resolveAdd!: (r: import('../types').Route) => void;
    const addRoute = vi.fn(
      () =>
        new Promise<import('../types').Route>((res) => {
          resolveAdd = res;
        })
    );
    const repo = makeMockRepo({ addRoute });
    useTripStore.setState({ repo, tripId: 'trip-1', routes: [] });

    const promise = useTripStore
      .getState()
      .addRoute({ name: 'Nature route', days: ['2026-10-05'], checkpointIds: ['cp-1'] });

    const { routes } = useTripStore.getState();
    expect(routes).toHaveLength(1);
    expect(routes[0].id).toMatch(/__optimistic/);
    expect(routes[0].name).toBe('Nature route');

    resolveAdd({
      id: 'route-real',
      name: 'Nature route',
      days: ['2026-10-05'],
      checkpointIds: ['cp-1'],
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await promise;

    expect(useTripStore.getState().routes[0].id).toBe('route-real');
  });

  it('updateRoute applies changes optimistically', async () => {
    const repo = makeMockRepo();
    const route: import('../types').Route = {
      id: 'route-1',
      name: 'Before',
      days: ['2026-10-05'],
      checkpointIds: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', routes: [route] });

    await useTripStore.getState().updateRoute('route-1', { name: 'After' });

    expect(useTripStore.getState().routes[0].name).toBe('After');
    expect(repo.updateRoute).toHaveBeenCalledWith('trip-1', 'route-1', { name: 'After' });
  });

  it('updateRoute rolls back and rethrows when repo throws', async () => {
    const updateRoute = vi.fn().mockRejectedValue(new Error('network'));
    const repo = makeMockRepo({ updateRoute });
    const route: import('../types').Route = {
      id: 'route-1',
      name: 'Original',
      days: ['2026-10-05'],
      checkpointIds: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', routes: [route] });

    await expect(
      useTripStore.getState().updateRoute('route-1', { name: 'Failed' })
    ).rejects.toThrow('network');

    expect(useTripStore.getState().routes[0].name).toBe('Original');
  });

  it('deleteRoute removes the entry optimistically', async () => {
    const repo = makeMockRepo();
    const route: import('../types').Route = {
      id: 'route-1',
      name: 'To Remove',
      days: ['2026-10-05'],
      checkpointIds: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', routes: [route] });

    await useTripStore.getState().deleteRoute('route-1');

    expect(useTripStore.getState().routes).toHaveLength(0);
    expect(repo.deleteRoute).toHaveBeenCalledWith('trip-1', 'route-1');
  });

  it('deleteRoute restores the route and rethrows when the repo throws', async () => {
    const deleteRoute = vi.fn().mockRejectedValue(new Error('network'));
    const repo = makeMockRepo({ deleteRoute });
    const route: import('../types').Route = {
      id: 'route-1',
      name: 'Restored',
      days: ['2026-10-05'],
      checkpointIds: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', routes: [route] });

    await expect(useTripStore.getState().deleteRoute('route-1')).rejects.toThrow('network');

    expect(useTripStore.getState().routes).toHaveLength(1);
    expect(useTripStore.getState().routes[0].name).toBe('Restored');
  });
});

describe('tripStore — wikiSections', () => {
  it('addWikiSection appends optimistically then replaces with saved', async () => {
    let resolveAdd!: (s: import('../types').WikiSection) => void;
    const addWikiSection = vi.fn(
      () =>
        new Promise<import('../types').WikiSection>((res) => {
          resolveAdd = res;
        })
    );
    const repo = makeMockRepo({ addWikiSection });
    useTripStore.setState({ repo, tripId: 'trip-1', wikiSections: [] });

    const promise = useTripStore
      .getState()
      .addWikiSection({ title: 'Day 3 — Kyoto', content: 'notes', order: 0 });

    const { wikiSections } = useTripStore.getState();
    expect(wikiSections).toHaveLength(1);
    expect(wikiSections[0].id).toMatch(/__optimistic/);
    expect(wikiSections[0].title).toBe('Day 3 — Kyoto');

    resolveAdd({
      id: 'wiki-real',
      title: 'Day 3 — Kyoto',
      content: 'notes',
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await promise;

    expect(useTripStore.getState().wikiSections[0].id).toBe('wiki-real');
  });

  it('updateWikiSection applies changes optimistically', async () => {
    const repo = makeMockRepo();
    const section: import('../types').WikiSection = {
      id: 'wiki-1',
      title: 'Before',
      content: '',
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', wikiSections: [section] });

    await useTripStore.getState().updateWikiSection('wiki-1', { title: 'After' });

    expect(useTripStore.getState().wikiSections[0].title).toBe('After');
    expect(repo.updateWikiSection).toHaveBeenCalledWith('trip-1', 'wiki-1', { title: 'After' });
  });

  it('updateWikiSection rolls back and rethrows when repo throws', async () => {
    const updateWikiSection = vi.fn().mockRejectedValue(new Error('network'));
    const repo = makeMockRepo({ updateWikiSection });
    const section: import('../types').WikiSection = {
      id: 'wiki-1',
      title: 'Original',
      content: '',
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', wikiSections: [section] });

    await expect(
      useTripStore.getState().updateWikiSection('wiki-1', { title: 'Failed' })
    ).rejects.toThrow('network');

    expect(useTripStore.getState().wikiSections[0].title).toBe('Original');
  });

  it('deleteWikiSection removes the entry optimistically', async () => {
    const repo = makeMockRepo();
    const section: import('../types').WikiSection = {
      id: 'wiki-1',
      title: 'To Remove',
      content: '',
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', wikiSections: [section] });

    await useTripStore.getState().deleteWikiSection('wiki-1');

    expect(useTripStore.getState().wikiSections).toHaveLength(0);
    expect(repo.deleteWikiSection).toHaveBeenCalledWith('trip-1', 'wiki-1');
  });

  it('deleteWikiSection restores the section and rethrows when the repo throws', async () => {
    const deleteWikiSection = vi.fn().mockRejectedValue(new Error('network'));
    const repo = makeMockRepo({ deleteWikiSection });
    const section: import('../types').WikiSection = {
      id: 'wiki-1',
      title: 'Restored',
      content: '',
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', wikiSections: [section] });

    await expect(useTripStore.getState().deleteWikiSection('wiki-1')).rejects.toThrow('network');

    expect(useTripStore.getState().wikiSections).toHaveLength(1);
    expect(useTripStore.getState().wikiSections[0].title).toBe('Restored');
  });
});

describe('tripStore — budgets', () => {
  it('addBudget appends optimistically then replaces with saved', async () => {
    let resolveAdd!: (b: import('../types').Budget) => void;
    const addBudget = vi.fn(
      () =>
        new Promise<import('../types').Budget>((res) => {
          resolveAdd = res;
        })
    );
    const repo = makeMockRepo({ addBudget });
    useTripStore.setState({ repo, tripId: 'trip-1', budgets: [] });

    const promise = useTripStore.getState().addBudget({ name: 'Backpacker', currency: 'JPY' });

    const { budgets } = useTripStore.getState();
    expect(budgets).toHaveLength(1);
    expect(budgets[0].id).toMatch(/__optimistic/);
    expect(budgets[0].name).toBe('Backpacker');

    resolveAdd({
      id: 'budget-real',
      name: 'Backpacker',
      currency: 'JPY',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await promise;

    expect(useTripStore.getState().budgets[0].id).toBe('budget-real');
  });

  it('updateBudget applies changes optimistically', async () => {
    const repo = makeMockRepo();
    const budget: import('../types').Budget = {
      id: 'budget-1',
      name: 'Before',
      currency: 'JPY',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', budgets: [budget] });

    await useTripStore.getState().updateBudget('budget-1', { name: 'After' });

    expect(useTripStore.getState().budgets[0].name).toBe('After');
    expect(repo.updateBudget).toHaveBeenCalledWith('trip-1', 'budget-1', { name: 'After' });
  });

  it('updateBudget rolls back and rethrows when repo throws', async () => {
    const updateBudget = vi.fn().mockRejectedValue(new Error('network'));
    const repo = makeMockRepo({ updateBudget });
    const budget: import('../types').Budget = {
      id: 'budget-1',
      name: 'Original',
      currency: 'JPY',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', budgets: [budget] });

    await expect(
      useTripStore.getState().updateBudget('budget-1', { name: 'Failed' })
    ).rejects.toThrow('network');

    expect(useTripStore.getState().budgets[0].name).toBe('Original');
  });

  it('deleteBudget removes the entry optimistically', async () => {
    const repo = makeMockRepo();
    const budget: import('../types').Budget = {
      id: 'budget-1',
      name: 'To Remove',
      currency: 'JPY',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', budgets: [budget] });

    await useTripStore.getState().deleteBudget('budget-1');

    expect(useTripStore.getState().budgets).toHaveLength(0);
    expect(repo.deleteBudget).toHaveBeenCalledWith('trip-1', 'budget-1');
  });

  it('deleteBudget restores the budget and rethrows when the repo throws', async () => {
    const deleteBudget = vi.fn().mockRejectedValue(new Error('network'));
    const repo = makeMockRepo({ deleteBudget });
    const budget: import('../types').Budget = {
      id: 'budget-1',
      name: 'Restored',
      currency: 'JPY',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', budgets: [budget] });

    await expect(useTripStore.getState().deleteBudget('budget-1')).rejects.toThrow('network');

    expect(useTripStore.getState().budgets).toHaveLength(1);
    expect(useTripStore.getState().budgets[0].name).toBe('Restored');
  });
});

describe('tripStore — budgetSections', () => {
  it('addBudgetSection appends optimistically then replaces with saved', async () => {
    let resolveAdd!: (s: import('../types').BudgetSection) => void;
    const addBudgetSection = vi.fn(
      () =>
        new Promise<import('../types').BudgetSection>((res) => {
          resolveAdd = res;
        })
    );
    const repo = makeMockRepo({ addBudgetSection });
    useTripStore.setState({ repo, tripId: 'trip-1', budgetSections: [] });

    const promise = useTripStore.getState().addBudgetSection({
      budgetId: 'budget-1',
      category: 'hotel',
      name: 'Hotel',
      order: 0,
    });

    const { budgetSections } = useTripStore.getState();
    expect(budgetSections).toHaveLength(1);
    expect(budgetSections[0].id).toMatch(/__optimistic/);
    expect(budgetSections[0].name).toBe('Hotel');

    resolveAdd({
      id: 'section-real',
      budgetId: 'budget-1',
      category: 'hotel',
      name: 'Hotel',
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await promise;

    expect(useTripStore.getState().budgetSections[0].id).toBe('section-real');
  });

  it('updateBudgetSection applies changes optimistically', async () => {
    const repo = makeMockRepo();
    const section: import('../types').BudgetSection = {
      id: 'section-1',
      budgetId: 'budget-1',
      category: 'hotel',
      name: 'Before',
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', budgetSections: [section] });

    await useTripStore.getState().updateBudgetSection('section-1', { name: 'After' });

    expect(useTripStore.getState().budgetSections[0].name).toBe('After');
    expect(repo.updateBudgetSection).toHaveBeenCalledWith('trip-1', 'section-1', {
      name: 'After',
    });
  });

  it('updateBudgetSection rolls back and rethrows when repo throws', async () => {
    const updateBudgetSection = vi.fn().mockRejectedValue(new Error('network'));
    const repo = makeMockRepo({ updateBudgetSection });
    const section: import('../types').BudgetSection = {
      id: 'section-1',
      budgetId: 'budget-1',
      category: 'hotel',
      name: 'Original',
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', budgetSections: [section] });

    await expect(
      useTripStore.getState().updateBudgetSection('section-1', { name: 'Failed' })
    ).rejects.toThrow('network');

    expect(useTripStore.getState().budgetSections[0].name).toBe('Original');
  });

  it('deleteBudgetSection removes the entry optimistically', async () => {
    const repo = makeMockRepo();
    const section: import('../types').BudgetSection = {
      id: 'section-1',
      budgetId: 'budget-1',
      category: 'hotel',
      name: 'To Remove',
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', budgetSections: [section] });

    await useTripStore.getState().deleteBudgetSection('section-1');

    expect(useTripStore.getState().budgetSections).toHaveLength(0);
    expect(repo.deleteBudgetSection).toHaveBeenCalledWith('trip-1', 'section-1');
  });

  it('deleteBudgetSection restores the section and rethrows when the repo throws', async () => {
    const deleteBudgetSection = vi.fn().mockRejectedValue(new Error('network'));
    const repo = makeMockRepo({ deleteBudgetSection });
    const section: import('../types').BudgetSection = {
      id: 'section-1',
      budgetId: 'budget-1',
      category: 'hotel',
      name: 'Restored',
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', budgetSections: [section] });

    await expect(useTripStore.getState().deleteBudgetSection('section-1')).rejects.toThrow(
      'network'
    );

    expect(useTripStore.getState().budgetSections).toHaveLength(1);
    expect(useTripStore.getState().budgetSections[0].name).toBe('Restored');
  });
});

describe('tripStore — budgetItems', () => {
  it('addBudgetItem appends optimistically then replaces with saved', async () => {
    let resolveAdd!: (i: import('../types').BudgetItem) => void;
    const addBudgetItem = vi.fn(
      () =>
        new Promise<import('../types').BudgetItem>((res) => {
          resolveAdd = res;
        })
    );
    const repo = makeMockRepo({ addBudgetItem });
    useTripStore.setState({ repo, tripId: 'trip-1', budgetItems: [] });

    const promise = useTripStore.getState().addBudgetItem({
      budgetSectionId: 'section-1',
      name: 'Ryokan',
      rateType: 'per_night',
      quantity: 3,
      price: 15000,
      order: 0,
    });

    const { budgetItems } = useTripStore.getState();
    expect(budgetItems).toHaveLength(1);
    expect(budgetItems[0].id).toMatch(/__optimistic/);
    expect(budgetItems[0].name).toBe('Ryokan');

    resolveAdd({
      id: 'item-real',
      budgetSectionId: 'section-1',
      name: 'Ryokan',
      rateType: 'per_night',
      quantity: 3,
      price: 15000,
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await promise;

    expect(useTripStore.getState().budgetItems[0].id).toBe('item-real');
  });

  it('updateBudgetItem applies changes optimistically', async () => {
    const repo = makeMockRepo();
    const item: import('../types').BudgetItem = {
      id: 'item-1',
      budgetSectionId: 'section-1',
      name: 'Before',
      rateType: 'constant',
      quantity: 1,
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', budgetItems: [item] });

    await useTripStore.getState().updateBudgetItem('item-1', { name: 'After' });

    expect(useTripStore.getState().budgetItems[0].name).toBe('After');
    expect(repo.updateBudgetItem).toHaveBeenCalledWith('trip-1', 'item-1', { name: 'After' });
  });

  it('updateBudgetItem rolls back and rethrows when repo throws', async () => {
    const updateBudgetItem = vi.fn().mockRejectedValue(new Error('network'));
    const repo = makeMockRepo({ updateBudgetItem });
    const item: import('../types').BudgetItem = {
      id: 'item-1',
      budgetSectionId: 'section-1',
      name: 'Original',
      rateType: 'constant',
      quantity: 1,
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', budgetItems: [item] });

    await expect(
      useTripStore.getState().updateBudgetItem('item-1', { name: 'Failed' })
    ).rejects.toThrow('network');

    expect(useTripStore.getState().budgetItems[0].name).toBe('Original');
  });

  it('deleteBudgetItem removes the entry optimistically', async () => {
    const repo = makeMockRepo();
    const item: import('../types').BudgetItem = {
      id: 'item-1',
      budgetSectionId: 'section-1',
      name: 'To Remove',
      rateType: 'constant',
      quantity: 1,
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', budgetItems: [item] });

    await useTripStore.getState().deleteBudgetItem('item-1');

    expect(useTripStore.getState().budgetItems).toHaveLength(0);
    expect(repo.deleteBudgetItem).toHaveBeenCalledWith('trip-1', 'item-1');
  });

  it('deleteBudgetItem restores the item and rethrows when the repo throws', async () => {
    const deleteBudgetItem = vi.fn().mockRejectedValue(new Error('network'));
    const repo = makeMockRepo({ deleteBudgetItem });
    const item: import('../types').BudgetItem = {
      id: 'item-1',
      budgetSectionId: 'section-1',
      name: 'Restored',
      rateType: 'constant',
      quantity: 1,
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', budgetItems: [item] });

    await expect(useTripStore.getState().deleteBudgetItem('item-1')).rejects.toThrow('network');

    expect(useTripStore.getState().budgetItems).toHaveLength(1);
    expect(useTripStore.getState().budgetItems[0].name).toBe('Restored');
  });

  it('selectBudgetItemAlternative flips selected across the item’s alternatives', async () => {
    const repo = makeMockRepo();
    const item: import('../types').BudgetItem = {
      id: 'item-1',
      budgetSectionId: 'section-1',
      name: 'Hotel',
      rateType: 'per_night',
      quantity: 1,
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
      alternatives: [
        {
          id: 'alt-1',
          label: 'Ryokan',
          price: 15000,
          rateType: 'per_night',
          quantity: 1,
          selected: true,
        },
        {
          id: 'alt-2',
          label: 'Business hotel',
          price: 8000,
          rateType: 'per_night',
          quantity: 1,
          selected: false,
        },
      ],
    };
    useTripStore.setState({ repo, tripId: 'trip-1', budgetItems: [item] });

    await useTripStore.getState().selectBudgetItemAlternative('item-1', 'alt-2');

    const updated = useTripStore.getState().budgetItems[0];
    expect(updated.alternatives?.find((a) => a.id === 'alt-1')?.selected).toBe(false);
    expect(updated.alternatives?.find((a) => a.id === 'alt-2')?.selected).toBe(true);
    expect(repo.updateBudgetItem).toHaveBeenCalledWith(
      'trip-1',
      'item-1',
      expect.objectContaining({
        alternatives: expect.arrayContaining([
          expect.objectContaining({ id: 'alt-2', selected: true }),
        ]),
      })
    );
  });

  it('selectBudgetItemAlternative is a no-op when the item has no alternatives', async () => {
    const repo = makeMockRepo();
    const item: import('../types').BudgetItem = {
      id: 'item-1',
      budgetSectionId: 'section-1',
      name: 'Hotel',
      rateType: 'constant',
      quantity: 1,
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({ repo, tripId: 'trip-1', budgetItems: [item] });

    await useTripStore.getState().selectBudgetItemAlternative('item-1', 'alt-2');

    expect(repo.updateBudgetItem).not.toHaveBeenCalled();
  });
});
