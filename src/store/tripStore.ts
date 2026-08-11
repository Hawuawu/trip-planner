import { create } from 'zustand';
import type { TripRepository } from '../data/TripRepository';
import type {
  Trip,
  Checkpoint,
  Alternative,
  Booking,
  Route,
  WikiSection,
  Budget,
  BudgetSection,
  BudgetItem,
  ActivityLogEntry,
  InviteMemberResult,
} from '../types';

interface TripState {
  trip: Trip | null;
  checkpoints: Checkpoint[];
  alternatives: Alternative[];
  bookings: Booking[];
  routes: Route[];
  wikiSections: WikiSection[];
  budgets: Budget[];
  budgetSections: BudgetSection[];
  budgetItems: BudgetItem[];
  activityLog: ActivityLogEntry[];
  activityLogHasMore: boolean;
  activityLogLoadingMore: boolean;
  selectedId: string | null;
  selectedDay: string | null;
  selectedRouteId: string | null;
  selectedAlternativeId: string | null;
  budgetNavigationTarget: { budgetId: string; itemId: string | null } | null;
  alternativesSearchFilter: string;
  alternativesTagFilter: string[];
  showAlternativesOnMap: boolean;
  undoCheckpoint: Checkpoint | null;
  undoAlternative: Alternative | null;
  repo: TripRepository | null;
  tripId: string | null;
  tripLoading: boolean;
  checkpointsLoading: boolean;
  alternativesLoading: boolean;

  init(tripId: string, repo: TripRepository): void;
  loadMoreActivityLog(): Promise<void>;
  selectCheckpoint(id: string | null): void;
  selectDay(day: string | null): void;
  selectRoute(routeId: string | null): void;
  selectAlternative(id: string | null): void;
  navigateToBudget(budgetId: string): void;
  navigateToBudgetItem(itemId: string): void;
  setAlternativesSearchFilter(search: string): void;
  toggleAlternativesTagFilter(tag: string): void;
  setShowAlternativesOnMap(value: boolean): void;

  inviteMember(email: string): Promise<InviteMemberResult>;
  removeMember(uid: string): Promise<void>;
  leaveTrip(): Promise<void>;

  addCheckpoint(cp: Omit<Checkpoint, 'id' | 'updatedAt'>): Promise<void>;
  updateCheckpoint(
    id: string,
    changes: Partial<Omit<Checkpoint, 'id' | 'updatedAt'>>
  ): Promise<void>;
  deleteCheckpoint(id: string): Promise<void>;
  undoDelete(): Promise<void>;
  clearUndo(): void;

  reorderCheckpoints(fromIndex: number, toIndex: number): Promise<void>;

  addAlternative(alt: Omit<Alternative, 'id' | 'createdAt'>): Promise<void>;
  updateAlternative(
    id: string,
    changes: Partial<Omit<Alternative, 'id' | 'createdAt'>>
  ): Promise<void>;
  deleteAlternative(id: string): Promise<void>;
  undoDeleteAlternative(): Promise<void>;
  clearUndoAlternative(): void;
  promoteAlternative(alternativeId: string, startTime: string): Promise<void>;

  importCheckpoints(items: {
    checkpoints: Omit<Checkpoint, 'id' | 'updatedAt'>[];
    alternatives: Omit<Alternative, 'id' | 'createdAt'>[];
  }): Promise<void>;

  addBooking(booking: Omit<Booking, 'id'>): Promise<Booking>;
  updateBooking(id: string, changes: Partial<Omit<Booking, 'id'>>): Promise<void>;
  deleteBooking(id: string): Promise<void>;

  addRoute(route: Omit<Route, 'id' | 'updatedAt'>): Promise<void>;
  updateRoute(id: string, changes: Partial<Omit<Route, 'id' | 'updatedAt'>>): Promise<void>;
  deleteRoute(id: string): Promise<void>;

  addWikiSection(section: Omit<WikiSection, 'id' | 'updatedAt'>): Promise<void>;
  updateWikiSection(
    id: string,
    changes: Partial<Omit<WikiSection, 'id' | 'updatedAt'>>
  ): Promise<void>;
  deleteWikiSection(id: string): Promise<void>;

  addBudget(budget: Omit<Budget, 'id' | 'updatedAt'>): Promise<void>;
  updateBudget(id: string, changes: Partial<Omit<Budget, 'id' | 'updatedAt'>>): Promise<void>;
  deleteBudget(id: string): Promise<void>;

  addBudgetSection(section: Omit<BudgetSection, 'id' | 'updatedAt'>): Promise<void>;
  updateBudgetSection(
    id: string,
    changes: Partial<Omit<BudgetSection, 'id' | 'updatedAt'>>
  ): Promise<void>;
  deleteBudgetSection(id: string): Promise<void>;

  addBudgetItem(item: Omit<BudgetItem, 'id' | 'updatedAt'>): Promise<void>;
  updateBudgetItem(
    id: string,
    changes: Partial<Omit<BudgetItem, 'id' | 'updatedAt'>>
  ): Promise<void>;
  deleteBudgetItem(id: string): Promise<void>;
  selectBudgetItemAlternative(itemId: string, alternativeId: string): Promise<void>;
}

export const useTripStore = create<TripState>((set, get) => ({
  trip: null,
  checkpoints: [],
  alternatives: [],
  bookings: [],
  routes: [],
  wikiSections: [],
  budgets: [],
  budgetSections: [],
  budgetItems: [],
  activityLog: [],
  activityLogHasMore: false,
  activityLogLoadingMore: false,
  selectedId: null,
  selectedDay: null,
  selectedRouteId: null,
  selectedAlternativeId: null,
  budgetNavigationTarget: null,
  alternativesSearchFilter: '',
  alternativesTagFilter: [],
  showAlternativesOnMap: true,
  undoCheckpoint: null,
  undoAlternative: null,
  repo: null,
  tripId: null,
  tripLoading: true,
  checkpointsLoading: true,
  alternativesLoading: true,

  init(tripId, repo) {
    set({ repo, tripId, tripLoading: true, checkpointsLoading: true, alternativesLoading: true });
    repo.subscribeToTrip(tripId, (trip) => set({ trip, tripLoading: false }));
    repo.subscribeToCheckpoints(tripId, (checkpoints) =>
      set({ checkpoints, checkpointsLoading: false })
    );
    repo.subscribeToAlternatives(tripId, (alternatives) =>
      set({ alternatives, alternativesLoading: false })
    );
    repo.subscribeToBookings(tripId, (bookings) => set({ bookings }));
    repo.subscribeToRoutes(tripId, (routes) => set({ routes }));
    repo.subscribeToWikiSections(tripId, (wikiSections) => set({ wikiSections }));
    repo.subscribeToBudgets(tripId, (budgets) => set({ budgets }));
    repo.subscribeToBudgetSections(tripId, (budgetSections) => set({ budgetSections }));
    repo.subscribeToBudgetItems(tripId, (budgetItems) => set({ budgetItems }));
    repo.subscribeToActivityLog(tripId, (activityLog) =>
      // The live listener caps at 100 entries (see subscribeToActivityLog);
      // hitting that cap is the only signal that older entries might exist
      // to page into via loadMoreActivityLog.
      set({ activityLog, activityLogHasMore: activityLog.length >= 100 })
    );
    repo.recordAccess(tripId).catch(() => {});
  },

  async loadMoreActivityLog() {
    const { repo, tripId, activityLog, activityLogHasMore, activityLogLoadingMore } = get();
    if (!repo || !tripId || !activityLogHasMore || activityLogLoadingMore) return;
    const cursor = activityLog[activityLog.length - 1];
    if (!cursor) return;
    set({ activityLogLoadingMore: true });
    try {
      const { entries, hasMore } = await repo.getActivityLogBefore(tripId, {
        createdAt: cursor.createdAt,
        id: cursor.id,
      });
      set((s) => {
        const existingIds = new Set(s.activityLog.map((e) => e.id));
        return {
          activityLog: [...s.activityLog, ...entries.filter((e) => !existingIds.has(e.id))],
          activityLogHasMore: hasMore,
          activityLogLoadingMore: false,
        };
      });
    } catch (err) {
      set({ activityLogLoadingMore: false });
      throw err;
    }
  },

  async inviteMember(email) {
    const { repo, tripId } = get();
    if (!repo || !tripId) throw new Error('No repo or tripId');
    return repo.inviteMember(tripId, email);
  },

  async removeMember(uid) {
    const { repo, tripId, trip } = get();
    if (!repo || !tripId || !trip) return;
    const prev = trip;
    set({ trip: { ...trip, memberIds: trip.memberIds.filter((id) => id !== uid) } });
    try {
      await repo.removeMember(tripId, uid);
    } catch (err) {
      set({ trip: prev });
      throw err;
    }
  },

  async leaveTrip() {
    const { repo, tripId } = get();
    if (!repo || !tripId) return;
    await repo.leaveTrip(tripId);
  },

  selectCheckpoint(id) {
    const { selectedId } = get();
    // Checkpoint and POI selection are mutually exclusive — only one map/
    // list item is ever highlighted at a time.
    set({ selectedId: selectedId === id ? null : id, selectedAlternativeId: null });
  },

  selectAlternative(id) {
    const { selectedAlternativeId } = get();
    set({ selectedAlternativeId: selectedAlternativeId === id ? null : id, selectedId: null });
  },

  selectDay(day) {
    set({ selectedDay: day });
  },

  selectRoute(routeId) {
    set({ selectedRouteId: routeId });
  },

  navigateToBudget(budgetId) {
    set({ budgetNavigationTarget: { budgetId, itemId: null } });
  },

  navigateToBudgetItem(itemId) {
    const { budgetItems, budgetSections } = get();
    const item = budgetItems.find((i) => i.id === itemId);
    if (!item) return;
    const section = budgetSections.find((s) => s.id === item.budgetSectionId);
    if (!section) return;
    set({ budgetNavigationTarget: { budgetId: section.budgetId, itemId } });
  },

  setAlternativesSearchFilter(search) {
    set({ alternativesSearchFilter: search });
  },

  toggleAlternativesTagFilter(tag) {
    const { alternativesTagFilter } = get();
    set({
      alternativesTagFilter: alternativesTagFilter.includes(tag)
        ? alternativesTagFilter.filter((t) => t !== tag)
        : [...alternativesTagFilter, tag],
    });
  },

  setShowAlternativesOnMap(value) {
    set({ showAlternativesOnMap: value });
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
    } catch (err) {
      if (prev) set((s) => ({ checkpoints: s.checkpoints.map((c) => (c.id === id ? prev : c)) }));
      throw err;
    }
  },

  async deleteCheckpoint(id) {
    const { repo, tripId, checkpoints } = get();
    if (!repo || !tripId) return;
    const target = checkpoints.find((c) => c.id === id);
    set({ checkpoints: checkpoints.filter((c) => c.id !== id), undoCheckpoint: target ?? null });
    try {
      await repo.deleteCheckpoint(tripId, id);
    } catch (err) {
      if (target)
        set((s) => ({
          checkpoints: [...s.checkpoints, target].sort((a, b) =>
            a.startTime.localeCompare(b.startTime)
          ),
          undoCheckpoint: s.undoCheckpoint === target ? null : s.undoCheckpoint,
        }));
      throw err;
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

  async reorderCheckpoints(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const { repo, tripId, checkpoints } = get();
    if (!repo || !tripId) return;

    const updated = [...checkpoints];
    const fromStartTime = updated[fromIndex].startTime;
    const toStartTime = updated[toIndex].startTime;

    // Swap startTimes so sort order reflects the new visual order
    updated[fromIndex] = {
      ...updated[fromIndex],
      startTime: toStartTime,
      updatedAt: new Date().toISOString(),
    };
    updated[toIndex] = {
      ...updated[toIndex],
      startTime: fromStartTime,
      updatedAt: new Date().toISOString(),
    };

    // Apply optimistically, re-sort so state stays consistent
    set({
      checkpoints: [...updated].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    });

    // Persist both changes
    await Promise.all([
      repo.updateCheckpoint(tripId, updated[fromIndex].id, {
        startTime: toStartTime,
      }),
      repo.updateCheckpoint(tripId, updated[toIndex].id, {
        startTime: fromStartTime,
      }),
    ]);
  },

  async addAlternative(alt) {
    const { repo, tripId, alternatives } = get();
    if (!repo || !tripId) return;
    const optimistic: Alternative = {
      ...alt,
      id: `__optimistic-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    set({ alternatives: [...alternatives, optimistic] });
    const saved = await repo.addAlternative(tripId, alt);
    set((s) => ({ alternatives: s.alternatives.map((a) => (a.id === optimistic.id ? saved : a)) }));
  },

  async updateAlternative(id, changes) {
    const { repo, tripId, alternatives } = get();
    if (!repo || !tripId) return;
    const prev = alternatives.find((a) => a.id === id);
    set({ alternatives: alternatives.map((a) => (a.id === id ? { ...a, ...changes } : a)) });
    try {
      await repo.updateAlternative(tripId, id, changes);
    } catch (err) {
      if (prev) set((s) => ({ alternatives: s.alternatives.map((a) => (a.id === id ? prev : a)) }));
      throw err;
    }
  },

  async deleteAlternative(id) {
    const { repo, tripId, alternatives } = get();
    if (!repo || !tripId) return;
    const target = alternatives.find((a) => a.id === id);
    set({
      alternatives: alternatives.filter((a) => a.id !== id),
      undoAlternative: target ?? null,
    });
    try {
      await repo.deleteAlternative(tripId, id);
    } catch (err) {
      if (target)
        set((s) => ({
          alternatives: [...s.alternatives, target],
          undoAlternative: s.undoAlternative === target ? null : s.undoAlternative,
        }));
      throw err;
    }
  },

  async undoDeleteAlternative() {
    const { repo, tripId, undoAlternative } = get();
    if (!repo || !tripId || !undoAlternative) return;
    set({ undoAlternative: null });
    const { id: _id, createdAt: _createdAt, ...alt } = undoAlternative;
    await get().addAlternative(alt);
  },

  clearUndoAlternative() {
    set({ undoAlternative: null });
  },

  async promoteAlternative(alternativeId, startTime) {
    const { repo, tripId } = get();
    if (!repo || !tripId) return;
    set((s) => ({ alternatives: s.alternatives.filter((a) => a.id !== alternativeId) }));
    await repo.promoteAlternative(tripId, alternativeId, startTime);
  },

  async importCheckpoints({ checkpoints, alternatives }) {
    const { repo, tripId } = get();
    if (!repo || !tripId) return;
    if (checkpoints.length > 0) await repo.addCheckpoints(tripId, checkpoints);
    if (alternatives.length > 0) await repo.addAlternatives(tripId, alternatives);
    // No manual set() — the live subscribeToCheckpoints/subscribeToAlternatives
    // listeners from init() push the new items in, same as every other write.
  },

  async addBooking(booking) {
    const { repo, tripId, bookings } = get();
    if (!repo || !tripId) throw new Error('No repo or tripId');
    const optimistic: Booking = { ...booking, id: `__optimistic-booking-${Date.now()}` };
    set({ bookings: [...bookings, optimistic] });
    const saved = await repo.addBooking(tripId, booking);
    set((s) => ({ bookings: s.bookings.map((b) => (b.id === optimistic.id ? saved : b)) }));
    return saved;
  },

  async updateBooking(id, changes) {
    const { repo, tripId, bookings } = get();
    if (!repo || !tripId) return;
    const prev = bookings.find((b) => b.id === id);
    set({
      bookings: bookings.map((b) => (b.id === id ? { ...b, ...changes } : b)),
    });
    try {
      await repo.updateBooking(tripId, id, changes);
    } catch (err) {
      if (prev) set((s) => ({ bookings: s.bookings.map((b) => (b.id === id ? prev : b)) }));
      throw err;
    }
  },

  async deleteBooking(id) {
    const { repo, tripId, bookings } = get();
    if (!repo || !tripId) return;
    set({ bookings: bookings.filter((b) => b.id !== id) });
    await repo.deleteBooking(tripId, id);
  },

  async addRoute(route) {
    const { repo, tripId, routes } = get();
    if (!repo || !tripId) return;
    const optimistic: Route = {
      ...route,
      id: `__optimistic-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    set({ routes: [...routes, optimistic] });
    const saved = await repo.addRoute(tripId, route);
    set((s) => ({ routes: s.routes.map((r) => (r.id === optimistic.id ? saved : r)) }));
  },

  async updateRoute(id, changes) {
    const { repo, tripId, routes } = get();
    if (!repo || !tripId) return;
    const prev = routes.find((r) => r.id === id);
    set({
      routes: routes.map((r) =>
        r.id === id ? { ...r, ...changes, updatedAt: new Date().toISOString() } : r
      ),
    });
    try {
      await repo.updateRoute(tripId, id, changes);
    } catch (err) {
      if (prev) set((s) => ({ routes: s.routes.map((r) => (r.id === id ? prev : r)) }));
      throw err;
    }
  },

  async deleteRoute(id) {
    const { repo, tripId, routes } = get();
    if (!repo || !tripId) return;
    const prev = routes;
    set({ routes: routes.filter((r) => r.id !== id) });
    try {
      await repo.deleteRoute(tripId, id);
    } catch (err) {
      set({ routes: prev });
      throw err;
    }
  },

  async addWikiSection(section) {
    const { repo, tripId, wikiSections } = get();
    if (!repo || !tripId) return;
    const optimistic: WikiSection = {
      ...section,
      id: `__optimistic-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    set({ wikiSections: [...wikiSections, optimistic] });
    const saved = await repo.addWikiSection(tripId, section);
    set((s) => ({
      wikiSections: s.wikiSections.map((w) => (w.id === optimistic.id ? saved : w)),
    }));
  },

  async updateWikiSection(id, changes) {
    const { repo, tripId, wikiSections } = get();
    if (!repo || !tripId) return;
    const prev = wikiSections.find((w) => w.id === id);
    set({
      wikiSections: wikiSections.map((w) =>
        w.id === id ? { ...w, ...changes, updatedAt: new Date().toISOString() } : w
      ),
    });
    try {
      await repo.updateWikiSection(tripId, id, changes);
    } catch (err) {
      if (prev) set((s) => ({ wikiSections: s.wikiSections.map((w) => (w.id === id ? prev : w)) }));
      throw err;
    }
  },

  async deleteWikiSection(id) {
    const { repo, tripId, wikiSections } = get();
    if (!repo || !tripId) return;
    const prev = wikiSections;
    set({ wikiSections: wikiSections.filter((w) => w.id !== id) });
    try {
      await repo.deleteWikiSection(tripId, id);
    } catch (err) {
      set({ wikiSections: prev });
      throw err;
    }
  },

  async addBudget(budget) {
    const { repo, tripId, budgets } = get();
    if (!repo || !tripId) return;
    const optimistic: Budget = {
      ...budget,
      id: `__optimistic-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    set({ budgets: [...budgets, optimistic] });
    const saved = await repo.addBudget(tripId, budget);
    set((s) => ({ budgets: s.budgets.map((b) => (b.id === optimistic.id ? saved : b)) }));
  },

  async updateBudget(id, changes) {
    const { repo, tripId, budgets } = get();
    if (!repo || !tripId) return;
    const prev = budgets.find((b) => b.id === id);
    set({
      budgets: budgets.map((b) =>
        b.id === id ? { ...b, ...changes, updatedAt: new Date().toISOString() } : b
      ),
    });
    try {
      await repo.updateBudget(tripId, id, changes);
    } catch (err) {
      if (prev) set((s) => ({ budgets: s.budgets.map((b) => (b.id === id ? prev : b)) }));
      throw err;
    }
  },

  async deleteBudget(id) {
    const { repo, tripId, budgets } = get();
    if (!repo || !tripId) return;
    const prev = budgets;
    set({ budgets: budgets.filter((b) => b.id !== id) });
    try {
      await repo.deleteBudget(tripId, id);
    } catch (err) {
      set({ budgets: prev });
      throw err;
    }
  },

  async addBudgetSection(section) {
    const { repo, tripId, budgetSections } = get();
    if (!repo || !tripId) return;
    const optimistic: BudgetSection = {
      ...section,
      id: `__optimistic-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    set({ budgetSections: [...budgetSections, optimistic] });
    const saved = await repo.addBudgetSection(tripId, section);
    set((s) => ({
      budgetSections: s.budgetSections.map((sec) => (sec.id === optimistic.id ? saved : sec)),
    }));
  },

  async updateBudgetSection(id, changes) {
    const { repo, tripId, budgetSections } = get();
    if (!repo || !tripId) return;
    const prev = budgetSections.find((s) => s.id === id);
    set({
      budgetSections: budgetSections.map((s) =>
        s.id === id ? { ...s, ...changes, updatedAt: new Date().toISOString() } : s
      ),
    });
    try {
      await repo.updateBudgetSection(tripId, id, changes);
    } catch (err) {
      if (prev)
        set((s) => ({
          budgetSections: s.budgetSections.map((sec) => (sec.id === id ? prev : sec)),
        }));
      throw err;
    }
  },

  async deleteBudgetSection(id) {
    const { repo, tripId, budgetSections } = get();
    if (!repo || !tripId) return;
    const prev = budgetSections;
    set({ budgetSections: budgetSections.filter((s) => s.id !== id) });
    try {
      await repo.deleteBudgetSection(tripId, id);
    } catch (err) {
      set({ budgetSections: prev });
      throw err;
    }
  },

  async addBudgetItem(item) {
    const { repo, tripId, budgetItems } = get();
    if (!repo || !tripId) return;
    const optimistic: BudgetItem = {
      ...item,
      id: `__optimistic-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    set({ budgetItems: [...budgetItems, optimistic] });
    const saved = await repo.addBudgetItem(tripId, item);
    set((s) => ({
      budgetItems: s.budgetItems.map((i) => (i.id === optimistic.id ? saved : i)),
    }));
  },

  async updateBudgetItem(id, changes) {
    const { repo, tripId, budgetItems } = get();
    if (!repo || !tripId) return;
    const prev = budgetItems.find((i) => i.id === id);
    set({
      budgetItems: budgetItems.map((i) =>
        i.id === id ? { ...i, ...changes, updatedAt: new Date().toISOString() } : i
      ),
    });
    try {
      await repo.updateBudgetItem(tripId, id, changes);
    } catch (err) {
      if (prev) set((s) => ({ budgetItems: s.budgetItems.map((i) => (i.id === id ? prev : i)) }));
      throw err;
    }
  },

  async deleteBudgetItem(id) {
    const { repo, tripId, budgetItems } = get();
    if (!repo || !tripId) return;
    const prev = budgetItems;
    set({ budgetItems: budgetItems.filter((i) => i.id !== id) });
    try {
      await repo.deleteBudgetItem(tripId, id);
    } catch (err) {
      set({ budgetItems: prev });
      throw err;
    }
  },

  async selectBudgetItemAlternative(itemId, alternativeId) {
    const item = get().budgetItems.find((i) => i.id === itemId);
    if (!item?.alternatives) return;
    await get().updateBudgetItem(itemId, {
      alternatives: item.alternatives.map((alt) => ({
        ...alt,
        selected: alt.id === alternativeId,
      })),
    });
  },
}));
