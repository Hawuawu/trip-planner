import type { TripRepository } from './TripRepository';
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
  ActivityLogEntryType,
  InviteMemberResult,
} from '../types';

const LOCAL_UID = 'local-user';

const DEMO_TRIP: Trip = {
  id: 'demo',
  name: 'Japan 2026',
  dateRange: { start: '2026-10-01', end: '2026-10-14' },
  memberIds: [LOCAL_UID],
  ownerId: LOCAL_UID,
  memberProfiles: { [LOCAL_UID]: { email: null, displayName: 'You' } },
};

const now = new Date().toISOString();

const SEED_CHECKPOINTS: Checkpoint[] = [
  {
    id: '1',
    type: 'flight',
    name: 'JFK → NRT',
    startTime: '2026-10-01T14:00:00.000Z',
    endTime: '2026-10-02T17:00:00.000Z',
    notes: 'JL 005, seat 32A',
    tags: ['long-haul'],
    updatedAt: now,
  },
  {
    id: '2',
    type: 'hotel',
    name: 'Shinjuku Granbell Hotel',
    startTime: '2026-10-02T15:00:00.000Z',
    endTime: '2026-10-05T11:00:00.000Z',
    location: { lat: 35.6938, lng: 139.7034, label: 'Shinjuku, Tokyo' },
    updatedAt: now,
  },
  {
    id: '3',
    type: 'train',
    name: 'Shinkansen Tokyo → Kyoto',
    startTime: '2026-10-05T12:00:00.000Z',
    endTime: '2026-10-05T14:15:00.000Z',
    notes: 'Nozomi 37, car 7',
    updatedAt: now,
  },
  {
    id: '4',
    type: 'hotel',
    name: 'Kyoto Granvia',
    startTime: '2026-10-05T15:00:00.000Z',
    endTime: '2026-10-08T11:00:00.000Z',
    location: { lat: 34.9856, lng: 135.7579, label: 'Kyoto Station' },
    updatedAt: now,
  },
  {
    id: '5',
    type: 'poi',
    name: 'Fushimi Inari-taisha',
    startTime: '2026-10-06T08:00:00.000Z',
    location: { lat: 34.9671, lng: 135.7727, label: 'Fushimi, Kyoto' },
    tags: ['must-see', 'outdoors'],
    updatedAt: now,
  },
  {
    id: '6',
    type: 'flight',
    name: 'NRT → JFK',
    startTime: '2026-10-14T10:00:00.000Z',
    endTime: '2026-10-14T14:00:00.000Z',
    notes: 'JL 006',
    updatedAt: now,
  },
];

const SEED_ALTERNATIVES: Alternative[] = [
  {
    id: 'a1',
    type: 'poi',
    name: 'teamLab Borderless',
    notes: 'Azabudai Hills, Tokyo',
    location: { lat: 35.6591, lng: 139.7138, label: 'Azabudai Hills, Tokyo' },
    tags: ['rainy-day', 'must-see'],
  },
  {
    id: 'a2',
    type: 'poi',
    name: 'Nishiki Market',
    location: { lat: 35.0053, lng: 135.7659, label: 'Nishiki, Kyoto' },
    tags: ['food'],
  },
];

const LS_CP = 'trip-planner:checkpoints';
const LS_ALT = 'trip-planner:alternatives';
const LS_BOOKINGS = 'trip-planner:bookings';
const LS_ROUTES = 'trip-planner:routes';
const LS_WIKI_SECTIONS = 'trip-planner:wikiSections';
const LS_BUDGETS = 'trip-planner:budgets';
const LS_BUDGET_SECTIONS = 'trip-planner:budgetSections';
const LS_BUDGET_ITEMS = 'trip-planner:budgetItems';
const LS_TRIPS = 'trip-planner:trips';
const LS_ACTIVITY = 'trip-planner:activityLog';

// Matches FirebaseTripRepository's page size for consistent UX.
const ACTIVITY_LOG_PAGE_SIZE = 50;

function loadTrips(): Trip[] {
  try {
    const raw = localStorage.getItem(LS_TRIPS);
    return raw ? (JSON.parse(raw) as Trip[]) : [DEMO_TRIP];
  } catch {
    return [DEMO_TRIP];
  }
}

function saveTrips(t: Trip[]) {
  localStorage.setItem(LS_TRIPS, JSON.stringify(t));
}

function loadCp(): Checkpoint[] {
  try {
    const raw = localStorage.getItem(LS_CP);
    return raw ? (JSON.parse(raw) as Checkpoint[]) : structuredClone(SEED_CHECKPOINTS);
  } catch {
    return structuredClone(SEED_CHECKPOINTS);
  }
}

function saveCp(c: Checkpoint[]) {
  localStorage.setItem(LS_CP, JSON.stringify(c));
}

function loadAlt(): Alternative[] {
  try {
    const raw = localStorage.getItem(LS_ALT);
    return raw ? (JSON.parse(raw) as Alternative[]) : structuredClone(SEED_ALTERNATIVES);
  } catch {
    return structuredClone(SEED_ALTERNATIVES);
  }
}

function saveAlt(a: Alternative[]) {
  localStorage.setItem(LS_ALT, JSON.stringify(a));
}

function loadBookings(): Booking[] {
  try {
    const raw = localStorage.getItem(LS_BOOKINGS);
    return raw ? (JSON.parse(raw) as Booking[]) : [];
  } catch {
    return [];
  }
}

function saveBookings(b: Booking[]) {
  localStorage.setItem(LS_BOOKINGS, JSON.stringify(b));
}

function loadRoutes(): Route[] {
  try {
    const raw = localStorage.getItem(LS_ROUTES);
    return raw ? (JSON.parse(raw) as Route[]) : [];
  } catch {
    return [];
  }
}

function saveRoutes(r: Route[]) {
  localStorage.setItem(LS_ROUTES, JSON.stringify(r));
}

function loadWikiSections(): WikiSection[] {
  try {
    const raw = localStorage.getItem(LS_WIKI_SECTIONS);
    return raw ? (JSON.parse(raw) as WikiSection[]) : [];
  } catch {
    return [];
  }
}

function saveWikiSections(s: WikiSection[]) {
  localStorage.setItem(LS_WIKI_SECTIONS, JSON.stringify(s));
}

function loadBudgets(): Budget[] {
  try {
    const raw = localStorage.getItem(LS_BUDGETS);
    return raw ? (JSON.parse(raw) as Budget[]) : [];
  } catch {
    return [];
  }
}

function saveBudgets(b: Budget[]) {
  localStorage.setItem(LS_BUDGETS, JSON.stringify(b));
}

function loadBudgetSections(): BudgetSection[] {
  try {
    const raw = localStorage.getItem(LS_BUDGET_SECTIONS);
    return raw ? (JSON.parse(raw) as BudgetSection[]) : [];
  } catch {
    return [];
  }
}

function saveBudgetSections(s: BudgetSection[]) {
  localStorage.setItem(LS_BUDGET_SECTIONS, JSON.stringify(s));
}

function loadBudgetItems(): BudgetItem[] {
  try {
    const raw = localStorage.getItem(LS_BUDGET_ITEMS);
    return raw ? (JSON.parse(raw) as BudgetItem[]) : [];
  } catch {
    return [];
  }
}

function saveBudgetItems(i: BudgetItem[]) {
  localStorage.setItem(LS_BUDGET_ITEMS, JSON.stringify(i));
}

function loadLog(): ActivityLogEntry[] {
  try {
    const raw = localStorage.getItem(LS_ACTIVITY);
    return raw ? (JSON.parse(raw) as ActivityLogEntry[]) : [];
  } catch {
    return [];
  }
}

function saveLog(entries: ActivityLogEntry[]) {
  localStorage.setItem(LS_ACTIVITY, JSON.stringify(entries));
}

export class LocalTripRepository implements TripRepository {
  private cpSubs = new Map<string, Set<(c: Checkpoint[]) => void>>();
  private altSubs = new Map<string, Set<(a: Alternative[]) => void>>();
  private bookingSubs = new Map<string, Set<(b: Booking[]) => void>>();
  private routeSubs = new Map<string, Set<(r: Route[]) => void>>();
  private wikiSectionSubs = new Map<string, Set<(s: WikiSection[]) => void>>();
  private budgetSubs = new Map<string, Set<(b: Budget[]) => void>>();
  private budgetSectionSubs = new Map<string, Set<(s: BudgetSection[]) => void>>();
  private budgetItemSubs = new Map<string, Set<(i: BudgetItem[]) => void>>();
  private tripSubs = new Map<string, Set<(t: Trip) => void>>();
  private logSubs = new Map<string, Set<(e: ActivityLogEntry[]) => void>>();

  private findTrip(tripId: string): Trip {
    return loadTrips().find((t) => t.id === tripId) ?? { ...DEMO_TRIP, id: tripId };
  }

  private saveTrip(trip: Trip) {
    const trips = loadTrips();
    saveTrips(
      trips.some((t) => t.id === trip.id)
        ? trips.map((t) => (t.id === trip.id ? trip : t))
        : [...trips, trip]
    );
  }

  private notifyTrip(tripId: string) {
    this.tripSubs.get(tripId)?.forEach((cb) => cb(this.findTrip(tripId)));
  }

  private notifyLog(tripId: string) {
    this.logSubs.get(tripId)?.forEach((cb) => cb(loadLog()));
  }

  private pushActivity(
    tripId: string,
    entry: Omit<ActivityLogEntry, 'id' | 'createdAt' | 'actorUid' | 'actorLabel'>
  ) {
    const full: ActivityLogEntry = {
      ...entry,
      id: `local-log-${Date.now()}`,
      actorUid: LOCAL_UID,
      actorLabel: 'You',
      createdAt: new Date().toISOString(),
    };
    saveLog([full, ...loadLog()]);
    this.notifyLog(tripId);
  }

  private async mutateMembers(
    tripId: string,
    uid: string,
    logType: Extract<ActivityLogEntryType, 'member_removed' | 'member_left'>
  ): Promise<void> {
    const trip = this.findTrip(tripId);
    this.saveTrip({
      ...trip,
      memberIds: trip.memberIds.filter((id) => id !== uid),
      memberProfiles: Object.fromEntries(
        Object.entries(trip.memberProfiles ?? {}).filter(([id]) => id !== uid)
      ),
    });
    this.pushActivity(tripId, { type: logType, entityName: uid });
    this.notifyTrip(tripId);
  }

  async getTrip(tripId: string): Promise<Trip> {
    return { ...DEMO_TRIP, id: tripId };
  }

  subscribeToTrip(tripId: string, cb: (trip: Trip) => void): () => void {
    if (!this.tripSubs.has(tripId)) this.tripSubs.set(tripId, new Set());
    this.tripSubs.get(tripId)!.add(cb);
    cb(this.findTrip(tripId));
    return () => {
      this.tripSubs.get(tripId)?.delete(cb);
    };
  }

  async inviteMember(_tripId: string, _email: string): Promise<InviteMemberResult> {
    throw new Error(
      'Inviting members requires the Firebase backend — not available in local/offline mode.'
    );
  }

  async removeMember(tripId: string, uid: string): Promise<void> {
    await this.mutateMembers(tripId, uid, 'member_removed');
  }

  async leaveTrip(tripId: string): Promise<void> {
    await this.mutateMembers(tripId, LOCAL_UID, 'member_left');
  }

  async recordAccess(_tripId: string): Promise<void> {
    // no-op — local/offline mode has no invite flow, so there's nothing to record
  }

  subscribeToActivityLog(tripId: string, cb: (entries: ActivityLogEntry[]) => void): () => void {
    if (!this.logSubs.has(tripId)) this.logSubs.set(tripId, new Set());
    this.logSubs.get(tripId)!.add(cb);
    cb(loadLog());
    return () => {
      this.logSubs.get(tripId)?.delete(cb);
    };
  }

  // Local mode has no live-window cap to page beyond — the whole log is
  // already in loadLog(), newest-first (each push prepends) — but the
  // interface is still implemented so pagination works the same way in
  // both local/offline and Firebase-backed modes.
  async getActivityLogBefore(
    _tripId: string,
    cursor: { createdAt: string; id: string }
  ): Promise<{ entries: ActivityLogEntry[]; hasMore: boolean }> {
    const log = loadLog();
    const cursorIndex = log.findIndex((e) => e.id === cursor.id);
    const startIndex = cursorIndex === -1 ? log.length : cursorIndex + 1;
    const entries = log.slice(startIndex, startIndex + ACTIVITY_LOG_PAGE_SIZE);
    return { entries, hasMore: startIndex + ACTIVITY_LOG_PAGE_SIZE < log.length };
  }

  subscribeToCheckpoints(tripId: string, cb: (c: Checkpoint[]) => void): () => void {
    if (!this.cpSubs.has(tripId)) this.cpSubs.set(tripId, new Set());
    this.cpSubs.get(tripId)!.add(cb);
    cb(this.sortedCp());
    return () => {
      this.cpSubs.get(tripId)?.delete(cb);
    };
  }

  private sortedCp(): Checkpoint[] {
    return loadCp().sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  private notifyCp(tripId: string) {
    this.cpSubs.get(tripId)?.forEach((cb) => cb(this.sortedCp()));
  }

  async addCheckpoint(
    tripId: string,
    cp: Omit<Checkpoint, 'id' | 'updatedAt'>
  ): Promise<Checkpoint> {
    const saved: Checkpoint = {
      ...cp,
      id: `local-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    saveCp([...loadCp(), saved]);
    this.notifyCp(tripId);
    this.pushActivity(tripId, { type: 'checkpoint_added', entityName: cp.name });
    return saved;
  }

  async addCheckpoints(
    tripId: string,
    checkpoints: Omit<Checkpoint, 'id' | 'updatedAt'>[]
  ): Promise<Checkpoint[]> {
    const now = new Date().toISOString();
    const saved: Checkpoint[] = checkpoints.map((cp, i) => ({
      ...cp,
      id: `local-${Date.now()}-${i}`,
      updatedAt: now,
    }));
    saveCp([...loadCp(), ...saved]);
    this.notifyCp(tripId);
    saved.forEach((cp) =>
      this.pushActivity(tripId, { type: 'checkpoint_added', entityName: cp.name })
    );
    return saved;
  }

  async updateCheckpoint(
    tripId: string,
    id: string,
    changes: Partial<Omit<Checkpoint, 'id' | 'updatedAt'>>
  ): Promise<void> {
    saveCp(
      loadCp().map((c) =>
        c.id === id ? { ...c, ...changes, updatedAt: new Date().toISOString() } : c
      )
    );
    this.notifyCp(tripId);
    this.pushActivity(tripId, {
      type: 'checkpoint_updated',
      entityName: changes.name,
      changedFields: Object.keys(changes),
    });
  }

  async deleteCheckpoint(tripId: string, id: string): Promise<void> {
    const target = loadCp().find((c) => c.id === id);
    saveCp(loadCp().filter((c) => c.id !== id));
    this.notifyCp(tripId);
    this.pushActivity(tripId, { type: 'checkpoint_deleted', entityName: target?.name });
  }

  subscribeToAlternatives(tripId: string, cb: (a: Alternative[]) => void): () => void {
    if (!this.altSubs.has(tripId)) this.altSubs.set(tripId, new Set());
    this.altSubs.get(tripId)!.add(cb);
    cb(loadAlt());
    return () => {
      this.altSubs.get(tripId)?.delete(cb);
    };
  }

  private notifyAlt(tripId: string) {
    this.altSubs.get(tripId)?.forEach((cb) => cb(loadAlt()));
  }

  async addAlternative(
    tripId: string,
    alt: Omit<Alternative, 'id' | 'createdAt'>
  ): Promise<Alternative> {
    const saved: Alternative = {
      ...alt,
      id: `local-alt-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    saveAlt([...loadAlt(), saved]);
    this.notifyAlt(tripId);
    this.pushActivity(tripId, { type: 'alternative_added', entityName: alt.name });
    return saved;
  }

  async addAlternatives(
    tripId: string,
    alternatives: Omit<Alternative, 'id' | 'createdAt'>[]
  ): Promise<Alternative[]> {
    const now = new Date().toISOString();
    const saved: Alternative[] = alternatives.map((alt, i) => ({
      ...alt,
      id: `local-alt-${Date.now()}-${i}`,
      createdAt: now,
    }));
    saveAlt([...loadAlt(), ...saved]);
    this.notifyAlt(tripId);
    saved.forEach((alt) =>
      this.pushActivity(tripId, { type: 'alternative_added', entityName: alt.name })
    );
    return saved;
  }

  async updateAlternative(
    tripId: string,
    id: string,
    changes: Partial<Omit<Alternative, 'id' | 'createdAt'>>
  ): Promise<void> {
    saveAlt(loadAlt().map((a) => (a.id === id ? { ...a, ...changes } : a)));
    this.notifyAlt(tripId);
    this.pushActivity(tripId, {
      type: 'alternative_updated',
      entityName: changes.name,
      changedFields: Object.keys(changes),
    });
  }

  async deleteAlternative(tripId: string, id: string): Promise<void> {
    const target = loadAlt().find((a) => a.id === id);
    saveAlt(loadAlt().filter((a) => a.id !== id));
    this.notifyAlt(tripId);
    this.pushActivity(tripId, { type: 'alternative_deleted', entityName: target?.name });
  }

  async promoteAlternative(
    tripId: string,
    alternativeId: string,
    startTime: string
  ): Promise<void> {
    const alt = loadAlt().find((a) => a.id === alternativeId);
    if (!alt) throw new Error('Alternative not found');
    await this.addCheckpoint(tripId, {
      type: alt.type,
      name: alt.name,
      startTime,
      location: alt.location,
      notes: alt.notes,
      websiteUrl: alt.websiteUrl,
      tags: alt.tags,
    });
    await this.deleteAlternative(tripId, alternativeId);
  }

  subscribeToBookings(tripId: string, cb: (b: Booking[]) => void): () => void {
    if (!this.bookingSubs.has(tripId)) this.bookingSubs.set(tripId, new Set());
    this.bookingSubs.get(tripId)!.add(cb);
    cb(loadBookings());
    return () => {
      this.bookingSubs.get(tripId)?.delete(cb);
    };
  }

  private notifyBookings(tripId: string) {
    this.bookingSubs.get(tripId)?.forEach((cb) => cb(loadBookings()));
  }

  async addBooking(tripId: string, booking: Omit<Booking, 'id'>): Promise<Booking> {
    const saved: Booking = { ...booking, id: `local-booking-${Date.now()}` };
    saveBookings([...loadBookings(), saved]);
    this.notifyBookings(tripId);
    this.pushActivity(tripId, { type: 'booking_added', entityName: booking.provider });
    return saved;
  }

  async updateBooking(
    tripId: string,
    id: string,
    changes: Partial<Omit<Booking, 'id'>>
  ): Promise<void> {
    saveBookings(loadBookings().map((b) => (b.id === id ? { ...b, ...changes } : b)));
    this.notifyBookings(tripId);
    this.pushActivity(tripId, {
      type: 'booking_updated',
      entityName: changes.provider,
      changedFields: Object.keys(changes),
    });
  }

  async deleteBooking(tripId: string, id: string): Promise<void> {
    saveBookings(loadBookings().filter((b) => b.id !== id));
    this.notifyBookings(tripId);
  }

  subscribeToRoutes(tripId: string, cb: (r: Route[]) => void): () => void {
    if (!this.routeSubs.has(tripId)) this.routeSubs.set(tripId, new Set());
    this.routeSubs.get(tripId)!.add(cb);
    cb(loadRoutes());
    return () => {
      this.routeSubs.get(tripId)?.delete(cb);
    };
  }

  private notifyRoutes(tripId: string) {
    this.routeSubs.get(tripId)?.forEach((cb) => cb(loadRoutes()));
  }

  async addRoute(tripId: string, route: Omit<Route, 'id' | 'updatedAt'>): Promise<Route> {
    const saved: Route = {
      ...route,
      id: `local-route-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    saveRoutes([...loadRoutes(), saved]);
    this.notifyRoutes(tripId);
    this.pushActivity(tripId, { type: 'route_added', entityName: route.name });
    return saved;
  }

  async updateRoute(
    tripId: string,
    id: string,
    changes: Partial<Omit<Route, 'id' | 'updatedAt'>>
  ): Promise<void> {
    saveRoutes(
      loadRoutes().map((r) =>
        r.id === id ? { ...r, ...changes, updatedAt: new Date().toISOString() } : r
      )
    );
    this.notifyRoutes(tripId);
    this.pushActivity(tripId, {
      type: 'route_updated',
      entityName: changes.name,
      changedFields: Object.keys(changes),
    });
  }

  async deleteRoute(tripId: string, id: string): Promise<void> {
    const target = loadRoutes().find((r) => r.id === id);
    saveRoutes(loadRoutes().filter((r) => r.id !== id));
    this.notifyRoutes(tripId);
    this.pushActivity(tripId, { type: 'route_deleted', entityName: target?.name });
  }

  subscribeToWikiSections(tripId: string, cb: (s: WikiSection[]) => void): () => void {
    if (!this.wikiSectionSubs.has(tripId)) this.wikiSectionSubs.set(tripId, new Set());
    this.wikiSectionSubs.get(tripId)!.add(cb);
    cb(loadWikiSections());
    return () => {
      this.wikiSectionSubs.get(tripId)?.delete(cb);
    };
  }

  private notifyWikiSections(tripId: string) {
    this.wikiSectionSubs.get(tripId)?.forEach((cb) => cb(loadWikiSections()));
  }

  async addWikiSection(
    tripId: string,
    section: Omit<WikiSection, 'id' | 'updatedAt'>
  ): Promise<WikiSection> {
    const saved: WikiSection = {
      ...section,
      id: `local-wiki-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    saveWikiSections([...loadWikiSections(), saved]);
    this.notifyWikiSections(tripId);
    this.pushActivity(tripId, { type: 'wiki_section_added', entityName: section.title });
    return saved;
  }

  async updateWikiSection(
    tripId: string,
    id: string,
    changes: Partial<Omit<WikiSection, 'id' | 'updatedAt'>>
  ): Promise<void> {
    saveWikiSections(
      loadWikiSections().map((s) =>
        s.id === id ? { ...s, ...changes, updatedAt: new Date().toISOString() } : s
      )
    );
    this.notifyWikiSections(tripId);
    this.pushActivity(tripId, {
      type: 'wiki_section_updated',
      entityName: changes.title,
      changedFields: Object.keys(changes),
    });
  }

  async deleteWikiSection(tripId: string, id: string): Promise<void> {
    const target = loadWikiSections().find((s) => s.id === id);
    saveWikiSections(loadWikiSections().filter((s) => s.id !== id));
    this.notifyWikiSections(tripId);
    this.pushActivity(tripId, { type: 'wiki_section_deleted', entityName: target?.title });
  }

  subscribeToBudgets(tripId: string, cb: (b: Budget[]) => void): () => void {
    if (!this.budgetSubs.has(tripId)) this.budgetSubs.set(tripId, new Set());
    this.budgetSubs.get(tripId)!.add(cb);
    cb(loadBudgets());
    return () => {
      this.budgetSubs.get(tripId)?.delete(cb);
    };
  }

  private notifyBudgets(tripId: string) {
    this.budgetSubs.get(tripId)?.forEach((cb) => cb(loadBudgets()));
  }

  async addBudget(tripId: string, budget: Omit<Budget, 'id' | 'updatedAt'>): Promise<Budget> {
    const saved: Budget = {
      ...budget,
      id: `local-budget-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    saveBudgets([...loadBudgets(), saved]);
    this.notifyBudgets(tripId);
    this.pushActivity(tripId, { type: 'budget_added', entityName: budget.name });
    return saved;
  }

  async updateBudget(
    tripId: string,
    id: string,
    changes: Partial<Omit<Budget, 'id' | 'updatedAt'>>
  ): Promise<void> {
    saveBudgets(
      loadBudgets().map((b) =>
        b.id === id ? { ...b, ...changes, updatedAt: new Date().toISOString() } : b
      )
    );
    this.notifyBudgets(tripId);
    this.pushActivity(tripId, {
      type: 'budget_updated',
      entityName: changes.name,
      changedFields: Object.keys(changes),
    });
  }

  async deleteBudget(tripId: string, id: string): Promise<void> {
    const target = loadBudgets().find((b) => b.id === id);
    const sectionsToDelete = loadBudgetSections().filter((s) => s.budgetId === id);
    const sectionIds = new Set(sectionsToDelete.map((s) => s.id));
    saveBudgetItems(loadBudgetItems().filter((i) => !sectionIds.has(i.budgetSectionId)));
    saveBudgetSections(loadBudgetSections().filter((s) => s.budgetId !== id));
    saveBudgets(loadBudgets().filter((b) => b.id !== id));
    this.notifyBudgetItems(tripId);
    this.notifyBudgetSections(tripId);
    this.notifyBudgets(tripId);
    this.pushActivity(tripId, { type: 'budget_deleted', entityName: target?.name });
  }

  subscribeToBudgetSections(tripId: string, cb: (s: BudgetSection[]) => void): () => void {
    if (!this.budgetSectionSubs.has(tripId)) this.budgetSectionSubs.set(tripId, new Set());
    this.budgetSectionSubs.get(tripId)!.add(cb);
    cb(loadBudgetSections());
    return () => {
      this.budgetSectionSubs.get(tripId)?.delete(cb);
    };
  }

  private notifyBudgetSections(tripId: string) {
    this.budgetSectionSubs.get(tripId)?.forEach((cb) => cb(loadBudgetSections()));
  }

  async addBudgetSection(
    tripId: string,
    section: Omit<BudgetSection, 'id' | 'updatedAt'>
  ): Promise<BudgetSection> {
    const saved: BudgetSection = {
      ...section,
      id: `local-budget-section-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    saveBudgetSections([...loadBudgetSections(), saved]);
    this.notifyBudgetSections(tripId);
    this.pushActivity(tripId, { type: 'budget_section_added', entityName: section.name });
    return saved;
  }

  async updateBudgetSection(
    tripId: string,
    id: string,
    changes: Partial<Omit<BudgetSection, 'id' | 'updatedAt'>>
  ): Promise<void> {
    saveBudgetSections(
      loadBudgetSections().map((s) =>
        s.id === id ? { ...s, ...changes, updatedAt: new Date().toISOString() } : s
      )
    );
    this.notifyBudgetSections(tripId);
    this.pushActivity(tripId, {
      type: 'budget_section_updated',
      entityName: changes.name,
      changedFields: Object.keys(changes),
    });
  }

  async deleteBudgetSection(tripId: string, id: string): Promise<void> {
    const target = loadBudgetSections().find((s) => s.id === id);
    saveBudgetItems(loadBudgetItems().filter((i) => i.budgetSectionId !== id));
    saveBudgetSections(loadBudgetSections().filter((s) => s.id !== id));
    this.notifyBudgetItems(tripId);
    this.notifyBudgetSections(tripId);
    this.pushActivity(tripId, { type: 'budget_section_deleted', entityName: target?.name });
  }

  subscribeToBudgetItems(tripId: string, cb: (i: BudgetItem[]) => void): () => void {
    if (!this.budgetItemSubs.has(tripId)) this.budgetItemSubs.set(tripId, new Set());
    this.budgetItemSubs.get(tripId)!.add(cb);
    cb(loadBudgetItems());
    return () => {
      this.budgetItemSubs.get(tripId)?.delete(cb);
    };
  }

  private notifyBudgetItems(tripId: string) {
    this.budgetItemSubs.get(tripId)?.forEach((cb) => cb(loadBudgetItems()));
  }

  async addBudgetItem(
    tripId: string,
    item: Omit<BudgetItem, 'id' | 'updatedAt'>
  ): Promise<BudgetItem> {
    const saved: BudgetItem = {
      ...item,
      id: `local-budget-item-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    };
    saveBudgetItems([...loadBudgetItems(), saved]);
    this.notifyBudgetItems(tripId);
    this.pushActivity(tripId, { type: 'budget_item_added', entityName: item.name });
    return saved;
  }

  async updateBudgetItem(
    tripId: string,
    id: string,
    changes: Partial<Omit<BudgetItem, 'id' | 'updatedAt'>>
  ): Promise<void> {
    saveBudgetItems(
      loadBudgetItems().map((i) =>
        i.id === id ? { ...i, ...changes, updatedAt: new Date().toISOString() } : i
      )
    );
    this.notifyBudgetItems(tripId);
    this.pushActivity(tripId, {
      type: 'budget_item_updated',
      entityName: changes.name,
      changedFields: Object.keys(changes),
    });
  }

  async deleteBudgetItem(tripId: string, id: string): Promise<void> {
    const target = loadBudgetItems().find((i) => i.id === id);
    saveBudgetItems(loadBudgetItems().filter((i) => i.id !== id));
    this.notifyBudgetItems(tripId);
    this.pushActivity(tripId, { type: 'budget_item_deleted', entityName: target?.name });
  }

  async listTrips(): Promise<Trip[]> {
    return loadTrips();
  }

  async createTrip(name: string, dateRange: { start: string; end: string }): Promise<Trip> {
    const trips = loadTrips();
    const trip: Trip = {
      id: `trip-${Date.now()}`,
      name,
      dateRange,
      memberIds: [LOCAL_UID],
      ownerId: LOCAL_UID,
      memberProfiles: { [LOCAL_UID]: { email: null, displayName: 'You' } },
    };
    const existing = trips.find((t) => t.id === DEMO_TRIP.id);
    saveTrips([...(existing ? trips : [DEMO_TRIP, ...trips]), trip]);
    this.pushActivity(trip.id, { type: 'trip_created', entityName: trip.name });
    return trip;
  }

  async updateTrip(
    tripId: string,
    changes: Partial<Pick<Trip, 'name' | 'dateRange'>>
  ): Promise<void> {
    saveTrips(loadTrips().map((t) => (t.id === tripId ? { ...t, ...changes } : t)));
    this.notifyTrip(tripId);
    if (changes.name) {
      this.pushActivity(tripId, { type: 'trip_renamed', entityName: changes.name });
    } else if (changes.dateRange) {
      this.pushActivity(tripId, { type: 'trip_dates_updated' });
    }
  }

  async deleteTrip(tripId: string): Promise<void> {
    saveTrips(loadTrips().filter((t) => t.id !== tripId));
  }
}
