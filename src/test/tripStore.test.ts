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
    subscribeToCheckpoints: vi.fn().mockReturnValue(() => {}),
    addCheckpoint: vi.fn().mockResolvedValue(makeCheckpoint({ id: 'saved-1' })),
    updateCheckpoint: vi.fn().mockResolvedValue(undefined),
    deleteCheckpoint: vi.fn().mockResolvedValue(undefined),
    subscribeToAlternatives: vi.fn().mockReturnValue(() => {}),
    addAlternative: vi.fn().mockResolvedValue({ id: 'alt-saved-1', type: 'poi', name: 'New Alt' }),
    deleteAlternative: vi.fn().mockResolvedValue(undefined),
    promoteAlternative: vi.fn().mockResolvedValue(undefined),
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

describe('tripStore — reorderCheckpoints', () => {
  function seedThreeCheckpoints() {
    const a = makeCheckpoint({ id: 'cp-a', name: 'Alpha', startTime: '2026-10-01T08:00:00.000Z' });
    const b = makeCheckpoint({ id: 'cp-b', name: 'Beta', startTime: '2026-10-02T08:00:00.000Z' });
    const c = makeCheckpoint({ id: 'cp-c', name: 'Gamma', startTime: '2026-10-03T08:00:00.000Z' });
    return [a, b, c];
  }

  it('swaps startTimes of the two affected checkpoints', async () => {
    const repo = makeMockRepo();
    const [a, b, c] = seedThreeCheckpoints();
    useTripStore.setState({ repo, tripId: 'trip-1', checkpoints: [a, b, c] });

    await useTripStore.getState().reorderCheckpoints(0, 2);

    const { checkpoints } = useTripStore.getState();
    // After swapping index 0 (Alpha) and 2 (Gamma), their startTimes are exchanged.
    // Re-sorted by startTime: the checkpoint that was "Gamma" now has Alpha's early time
    // and vice-versa, so the new order by name should be: Gamma, Beta, Alpha.
    expect(checkpoints.map((c) => c.name)).toEqual(['Gamma', 'Beta', 'Alpha']);
    // Confirm startTimes were actually swapped on the checkpoint objects
    const alpha = checkpoints.find((c) => c.name === 'Alpha')!;
    const gamma = checkpoints.find((c) => c.name === 'Gamma')!;
    expect(alpha.startTime).toBe('2026-10-03T08:00:00.000Z');
    expect(gamma.startTime).toBe('2026-10-01T08:00:00.000Z');
  });

  it('calls repo.updateCheckpoint for each changed checkpoint', async () => {
    const repo = makeMockRepo();
    const [a, b, c] = seedThreeCheckpoints();
    useTripStore.setState({ repo, tripId: 'trip-1', checkpoints: [a, b, c] });

    await useTripStore.getState().reorderCheckpoints(0, 1);

    expect(repo.updateCheckpoint).toHaveBeenCalledTimes(2);
    expect(repo.updateCheckpoint).toHaveBeenCalledWith(
      'trip-1',
      'cp-a',
      expect.objectContaining({ startTime: '2026-10-02T08:00:00.000Z' })
    );
    expect(repo.updateCheckpoint).toHaveBeenCalledWith(
      'trip-1',
      'cp-b',
      expect.objectContaining({ startTime: '2026-10-01T08:00:00.000Z' })
    );
  });

  it('is a no-op when fromIndex === toIndex', async () => {
    const repo = makeMockRepo();
    const [a, b, c] = seedThreeCheckpoints();
    useTripStore.setState({ repo, tripId: 'trip-1', checkpoints: [a, b, c] });

    await useTripStore.getState().reorderCheckpoints(1, 1);

    expect(repo.updateCheckpoint).not.toHaveBeenCalled();
    const { checkpoints } = useTripStore.getState();
    expect(checkpoints.map((c) => c.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('optimistically updates state before repo resolves', async () => {
    const resolvers: Array<() => void> = [];
    const updateCheckpoint = vi.fn(
      () =>
        new Promise<void>((res) => {
          resolvers.push(res);
        })
    );
    const repo = makeMockRepo({ updateCheckpoint });
    const [a, b] = seedThreeCheckpoints();
    useTripStore.setState({ repo, tripId: 'trip-1', checkpoints: [a, b] });

    const promise = useTripStore.getState().reorderCheckpoints(0, 1);

    // State is updated optimistically before the repo resolves
    const { checkpoints } = useTripStore.getState();
    const alpha = checkpoints.find((c) => c.name === 'Alpha')!;
    const beta = checkpoints.find((c) => c.name === 'Beta')!;
    expect(alpha.startTime).toBe('2026-10-02T08:00:00.000Z');
    expect(beta.startTime).toBe('2026-10-01T08:00:00.000Z');

    // Resolve both pending repo calls so the promise completes
    resolvers.forEach((res) => res());
    await promise;
  });
});
