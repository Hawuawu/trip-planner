import { create } from 'zustand';
import type { TripRepository } from '../data/TripRepository';
import type { Trip, Checkpoint, Alternative } from '../types';

interface TripState {
  trip: Trip | null;
  checkpoints: Checkpoint[];
  alternatives: Alternative[];
  selectedId: string | null;
  undoCheckpoint: Checkpoint | null;
  repo: TripRepository | null;
  tripId: string | null;

  init(tripId: string, repo: TripRepository): void;
  selectCheckpoint(id: string | null): void;

  addCheckpoint(cp: Omit<Checkpoint, 'id' | 'updatedAt'>): Promise<void>;
  updateCheckpoint(
    id: string,
    changes: Partial<Omit<Checkpoint, 'id' | 'updatedAt'>>
  ): Promise<void>;
  deleteCheckpoint(id: string): Promise<void>;
  undoDelete(): Promise<void>;
  clearUndo(): void;

  addAlternative(alt: Omit<Alternative, 'id'>): Promise<void>;
  deleteAlternative(id: string): Promise<void>;
  promoteAlternative(alternativeId: string, startTime: string): Promise<void>;
}

export const useTripStore = create<TripState>((set, get) => ({
  trip: null,
  checkpoints: [],
  alternatives: [],
  selectedId: null,
  undoCheckpoint: null,
  repo: null,
  tripId: null,

  init(tripId, repo) {
    set({ repo, tripId });
    repo.getTrip(tripId).then((trip) => set({ trip }));
    repo.subscribeToCheckpoints(tripId, (checkpoints) => set({ checkpoints }));
    repo.subscribeToAlternatives(tripId, (alternatives) => set({ alternatives }));
  },

  selectCheckpoint(id) {
    set({ selectedId: id });
  },

  async addCheckpoint(cp) {
    const { repo, tripId, checkpoints } = get();
    if (!repo || !tripId) return;
    const optimistic: Checkpoint = {
      ...cp,
      id: `__optimistic-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    set({
      checkpoints: [...checkpoints, optimistic].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      ),
    });
    const saved = await repo.addCheckpoint(tripId, cp);
    set((s) => ({
      checkpoints: s.checkpoints
        .map((c) => (c.id === optimistic.id ? saved : c))
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }));
  },

  async updateCheckpoint(id, changes) {
    const { repo, tripId, checkpoints } = get();
    if (!repo || !tripId) return;
    const prev = checkpoints.find((c) => c.id === id);
    set({
      checkpoints: checkpoints
        .map((c) => (c.id === id ? { ...c, ...changes, updatedAt: new Date().toISOString() } : c))
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    });
    try {
      await repo.updateCheckpoint(tripId, id, changes);
    } catch {
      if (prev) set((s) => ({ checkpoints: s.checkpoints.map((c) => (c.id === id ? prev : c)) }));
    }
  },

  async deleteCheckpoint(id) {
    const { repo, tripId, checkpoints } = get();
    if (!repo || !tripId) return;
    const target = checkpoints.find((c) => c.id === id);
    set({ checkpoints: checkpoints.filter((c) => c.id !== id), undoCheckpoint: target ?? null });
    try {
      await repo.deleteCheckpoint(tripId, id);
    } catch {
      if (target)
        set((s) => ({
          checkpoints: [...s.checkpoints, target].sort((a, b) =>
            a.startTime.localeCompare(b.startTime)
          ),
        }));
    }
  },

  async undoDelete() {
    const { repo, tripId, undoCheckpoint } = get();
    if (!repo || !tripId || !undoCheckpoint) return;
    set({ undoCheckpoint: null });
    const { id: _id, updatedAt: _ua, ...cp } = undoCheckpoint;
    await get().addCheckpoint(cp);
  },

  clearUndo() {
    set({ undoCheckpoint: null });
  },

  async addAlternative(alt) {
    const { repo, tripId, alternatives } = get();
    if (!repo || !tripId) return;
    const optimistic: Alternative = { ...alt, id: `__optimistic-${Date.now()}` };
    set({ alternatives: [...alternatives, optimistic] });
    const saved = await repo.addAlternative(tripId, alt);
    set((s) => ({ alternatives: s.alternatives.map((a) => (a.id === optimistic.id ? saved : a)) }));
  },

  async deleteAlternative(id) {
    const { repo, tripId, alternatives } = get();
    if (!repo || !tripId) return;
    set({ alternatives: alternatives.filter((a) => a.id !== id) });
    await repo.deleteAlternative(tripId, id);
  },

  async promoteAlternative(alternativeId, startTime) {
    const { repo, tripId } = get();
    if (!repo || !tripId) return;
    set((s) => ({ alternatives: s.alternatives.filter((a) => a.id !== alternativeId) }));
    await repo.promoteAlternative(tripId, alternativeId, startTime);
  },
}));
