import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
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
  MemberProfile,
} from '../types.js';

function toIso(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function toMemberProfiles(raw: unknown): Record<string, MemberProfile> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  return Object.fromEntries(
    Object.entries(
      raw as Record<string, { email?: string | null; displayName?: string | null }>
    ).map(([uid, p]) => [uid, { email: p.email ?? null, displayName: p.displayName ?? null }])
  );
}

function toTrip(id: string, d: Record<string, unknown>): Trip {
  return {
    id,
    name: d.name as string,
    dateRange: d.dateRange as Trip['dateRange'],
    memberIds: (d.memberIds as string[]) ?? [],
    ownerId: d.ownerId as string | undefined,
    memberProfiles: toMemberProfiles(d.memberProfiles),
  };
}

function toCheckpoint(id: string, d: Record<string, unknown>): Checkpoint {
  return {
    id,
    type: d.type as Checkpoint['type'],
    name: d.name as string,
    startTime: toIso(d.startTime),
    endTime: d.endTime ? toIso(d.endTime) : undefined,
    location: (d.location as Checkpoint['location']) ?? undefined,
    notes: (d.notes as string) ?? undefined,
    tags: (d.tags as string[]) ?? undefined,
    linkedBookingId: (d.linkedBookingId as string) ?? undefined,
    updatedAt: toIso(d.updatedAt),
  };
}

function toAlternative(id: string, d: Record<string, unknown>): Alternative {
  return {
    id,
    ...(d as Omit<Alternative, 'id' | 'createdAt'>),
    createdAt: d.createdAt ? toIso(d.createdAt) : undefined,
  };
}

function toBooking(id: string, d: Record<string, unknown>): Booking {
  return { id, ...(d as Omit<Booking, 'id'>) };
}

function toRoute(id: string, d: Record<string, unknown>): Route {
  return {
    id,
    name: d.name as string,
    days: (d.days as string[]) ?? [],
    checkpointIds: (d.checkpointIds as string[]) ?? [],
    updatedAt: toIso(d.updatedAt),
  };
}

function toWikiSection(id: string, d: Record<string, unknown>): WikiSection {
  return {
    id,
    title: d.title as string,
    content: (d.content as string) ?? '',
    order: (d.order as number) ?? 0,
    updatedAt: toIso(d.updatedAt),
  };
}

function toBudget(id: string, d: Record<string, unknown>): Budget {
  return {
    id,
    name: d.name as string,
    currency: d.currency as string,
    updatedAt: toIso(d.updatedAt),
  };
}

function toBudgetSection(id: string, d: Record<string, unknown>): BudgetSection {
  return {
    id,
    budgetId: d.budgetId as string,
    category: d.category as BudgetSection['category'],
    name: d.name as string,
    price: d.price as number | undefined,
    notes: d.notes as string | undefined,
    order: (d.order as number) ?? 0,
    updatedAt: toIso(d.updatedAt),
  };
}

function toBudgetItem(id: string, d: Record<string, unknown>): BudgetItem {
  return {
    id,
    budgetSectionId: d.budgetSectionId as string,
    name: d.name as string,
    price: d.price as number | undefined,
    rateType: d.rateType as BudgetItem['rateType'],
    quantity: (d.quantity as number) ?? 1,
    alternatives: d.alternatives as BudgetItem['alternatives'],
    notes: d.notes as string | undefined,
    order: (d.order as number) ?? 0,
    updatedAt: toIso(d.updatedAt),
  };
}

// Mirrors trip-planner's LastModifiedBy (src/data/firebaseTripRepository.ts)
// — stamped into every add/update write so the logTripEntityActivity/
// logTripActivity Cloud Function triggers can attribute the resulting
// activity log entry to the signed-in MCP user. This repository never wrote
// activity log entries itself (see #102), so this is a pure addition, not a
// behavior change to anything that previously worked.
interface LastModifiedBy {
  uid: string;
  label: string;
}

// One-shot Firestore reads/writes (getDoc/getDocs, not onSnapshot) — an MCP
// tool call is a single request/response, not a long-lived UI subscription,
// so there's nothing to push realtime updates to. This mirrors trip-planner's
// FirebaseTripRepository (src/data/firebaseTripRepository.ts) method-for-
// method but flattens every subscribeToX into a one-shot listX, matching
// MCP.md's original "collapse subscriptions into list tools" call.
export class FirebaseClientTripRepository {
  private db: Firestore;

  constructor(private auth: Auth) {
    this.db = getFirestore(auth.app);
  }

  private requireUid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Not signed in');
    return uid;
  }

  private stampWriter(): LastModifiedBy {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not signed in');
    return { uid: user.uid, label: user.displayName ?? user.email ?? user.uid };
  }

  async listTrips(): Promise<Trip[]> {
    const uid = this.requireUid();
    const snap = await getDocs(
      query(collection(this.db, 'trips'), where('memberIds', 'array-contains', uid))
    );
    return snap.docs.map((d) => toTrip(d.id, d.data()));
  }

  async getTrip(tripId: string): Promise<Trip> {
    const snap = await getDoc(doc(this.db, 'trips', tripId));
    if (!snap.exists()) throw new Error(`Trip ${tripId} not found`);
    return toTrip(snap.id, snap.data());
  }

  async createTrip(name: string, dateRange: { start: string; end: string }): Promise<Trip> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not signed in');
    const memberIds = [user.uid];
    const memberProfiles: Record<string, MemberProfile> = {
      [user.uid]: { email: user.email, displayName: user.displayName },
    };
    const ref = await addDoc(collection(this.db, 'trips'), {
      name,
      dateRange,
      memberIds,
      ownerId: user.uid,
      memberProfiles,
      lastModifiedBy: { uid: user.uid, label: user.displayName ?? user.email ?? user.uid },
    });
    return { id: ref.id, name, dateRange, memberIds, ownerId: user.uid, memberProfiles };
  }

  async updateTrip(
    tripId: string,
    changes: Partial<Pick<Trip, 'name' | 'dateRange'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId), {
      ...changes,
      lastModifiedBy: this.stampWriter(),
    });
  }

  async listCheckpoints(tripId: string): Promise<Checkpoint[]> {
    const snap = await getDocs(collection(this.db, 'trips', tripId, 'checkpoints'));
    const checkpoints = snap.docs.map((d) => toCheckpoint(d.id, d.data()));
    checkpoints.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return checkpoints;
  }

  async getCheckpoint(tripId: string, checkpointId: string): Promise<Checkpoint> {
    const snap = await getDoc(doc(this.db, 'trips', tripId, 'checkpoints', checkpointId));
    if (!snap.exists()) throw new Error(`Checkpoint ${checkpointId} not found`);
    return toCheckpoint(snap.id, snap.data());
  }

  async addCheckpoint(
    tripId: string,
    cp: Omit<Checkpoint, 'id' | 'updatedAt'>
  ): Promise<Checkpoint> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'checkpoints'), {
      ...cp,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
    return { ...cp, id: ref.id, updatedAt: now };
  }

  async addCheckpoints(
    tripId: string,
    checkpoints: Omit<Checkpoint, 'id' | 'updatedAt'>[]
  ): Promise<Checkpoint[]> {
    const now = new Date().toISOString();
    const lastModifiedBy = this.stampWriter();
    const batch = writeBatch(this.db);
    const collectionRef = collection(this.db, 'trips', tripId, 'checkpoints');
    const refs = checkpoints.map(() => doc(collectionRef));
    checkpoints.forEach((cp, i) =>
      batch.set(refs[i], { ...cp, updatedAt: serverTimestamp(), lastModifiedBy })
    );
    await batch.commit();
    return checkpoints.map((cp, i) => ({ ...cp, id: refs[i].id, updatedAt: now }));
  }

  async updateCheckpoint(
    tripId: string,
    id: string,
    changes: Partial<Omit<Checkpoint, 'id' | 'updatedAt'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'checkpoints', id), {
      ...changes,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
  }

  async listAlternatives(tripId: string): Promise<Alternative[]> {
    const snap = await getDocs(collection(this.db, 'trips', tripId, 'alternatives'));
    return snap.docs.map((d) => toAlternative(d.id, d.data()));
  }

  // Deduped, sorted union of every tag in use across both checkpoints and
  // alternatives — backs the list_tags tool so callers can reuse an existing
  // tag instead of inventing a near-duplicate (e.g. "food" vs "Food").
  async listTags(tripId: string): Promise<string[]> {
    const [checkpoints, alternatives] = await Promise.all([
      this.listCheckpoints(tripId),
      this.listAlternatives(tripId),
    ]);
    const set = new Set<string>();
    for (const item of [...checkpoints, ...alternatives]) {
      for (const tag of item.tags ?? []) set.add(tag);
    }
    return Array.from(set).sort();
  }

  async addAlternative(
    tripId: string,
    alt: Omit<Alternative, 'id' | 'createdAt'>
  ): Promise<Alternative> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'alternatives'), {
      ...alt,
      createdAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
    return { ...alt, id: ref.id, createdAt: now };
  }

  async addAlternatives(
    tripId: string,
    alternatives: Omit<Alternative, 'id' | 'createdAt'>[]
  ): Promise<Alternative[]> {
    const now = new Date().toISOString();
    const lastModifiedBy = this.stampWriter();
    const batch = writeBatch(this.db);
    const collectionRef = collection(this.db, 'trips', tripId, 'alternatives');
    const refs = alternatives.map(() => doc(collectionRef));
    alternatives.forEach((alt, i) =>
      batch.set(refs[i], { ...alt, createdAt: serverTimestamp(), lastModifiedBy })
    );
    await batch.commit();
    return alternatives.map((alt, i) => ({ ...alt, id: refs[i].id, createdAt: now }));
  }

  async updateAlternative(
    tripId: string,
    id: string,
    changes: Partial<Omit<Alternative, 'id' | 'createdAt'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'alternatives', id), {
      ...changes,
      lastModifiedBy: this.stampWriter(),
    });
  }

  async promoteAlternative(
    tripId: string,
    alternativeId: string,
    startTime: string
  ): Promise<void> {
    const altRef = doc(this.db, 'trips', tripId, 'alternatives', alternativeId);
    const altSnap = await getDoc(altRef);
    if (!altSnap.exists()) throw new Error('Alternative not found');
    const alt = altSnap.data();
    await addDoc(collection(this.db, 'trips', tripId, 'checkpoints'), {
      type: alt.type,
      name: alt.name,
      startTime,
      ...(alt.location && { location: alt.location }),
      ...(alt.notes && { notes: alt.notes }),
      ...(Array.isArray(alt.tags) && alt.tags.length > 0 && { tags: alt.tags }),
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
    // Matches trip-planner's own promoteAlternative (src/data/
    // firebaseTripRepository.ts): deletion here is an atomic part of an
    // existing, already-shipped promotion workflow (confirmed with the user
    // — the "no delete tools" scope decision was about standalone delete_*
    // tools, not this).
    await deleteDoc(altRef);
  }

  async listBookings(tripId: string): Promise<Booking[]> {
    const snap = await getDocs(collection(this.db, 'trips', tripId, 'bookings'));
    return snap.docs.map((d) => toBooking(d.id, d.data()));
  }

  async addBooking(tripId: string, booking: Omit<Booking, 'id'>): Promise<Booking> {
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'bookings'), {
      ...booking,
      lastModifiedBy: this.stampWriter(),
    });
    return { ...booking, id: ref.id };
  }

  async updateBooking(
    tripId: string,
    id: string,
    changes: Partial<Omit<Booking, 'id'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'bookings', id), {
      ...changes,
      lastModifiedBy: this.stampWriter(),
    });
  }

  async listRoutes(tripId: string): Promise<Route[]> {
    const snap = await getDocs(collection(this.db, 'trips', tripId, 'routes'));
    return snap.docs.map((d) => toRoute(d.id, d.data()));
  }

  async getRoute(tripId: string, routeId: string): Promise<Route> {
    const snap = await getDoc(doc(this.db, 'trips', tripId, 'routes', routeId));
    if (!snap.exists()) throw new Error(`Route ${routeId} not found`);
    return toRoute(snap.id, snap.data());
  }

  async addRoute(tripId: string, route: Omit<Route, 'id' | 'updatedAt'>): Promise<Route> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'routes'), {
      ...route,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
    return { ...route, id: ref.id, updatedAt: now };
  }

  async updateRoute(
    tripId: string,
    id: string,
    changes: Partial<Omit<Route, 'id' | 'updatedAt'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'routes', id), {
      ...changes,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
  }

  async listWikiSections(tripId: string): Promise<WikiSection[]> {
    const snap = await getDocs(collection(this.db, 'trips', tripId, 'wikiSections'));
    return snap.docs.map((d) => toWikiSection(d.id, d.data()));
  }

  async getWikiSection(tripId: string, sectionId: string): Promise<WikiSection> {
    const snap = await getDoc(doc(this.db, 'trips', tripId, 'wikiSections', sectionId));
    if (!snap.exists()) throw new Error(`Wiki section ${sectionId} not found`);
    return toWikiSection(snap.id, snap.data());
  }

  async addWikiSection(
    tripId: string,
    section: Omit<WikiSection, 'id' | 'updatedAt'>
  ): Promise<WikiSection> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'wikiSections'), {
      ...section,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
    return { ...section, id: ref.id, updatedAt: now };
  }

  async updateWikiSection(
    tripId: string,
    id: string,
    changes: Partial<Omit<WikiSection, 'id' | 'updatedAt'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'wikiSections', id), {
      ...changes,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
  }

  async listBudgets(tripId: string): Promise<Budget[]> {
    const snap = await getDocs(collection(this.db, 'trips', tripId, 'budgets'));
    return snap.docs.map((d) => toBudget(d.id, d.data()));
  }

  async getBudget(tripId: string, budgetId: string): Promise<Budget> {
    const snap = await getDoc(doc(this.db, 'trips', tripId, 'budgets', budgetId));
    if (!snap.exists()) throw new Error(`Budget ${budgetId} not found`);
    return toBudget(snap.id, snap.data());
  }

  async addBudget(tripId: string, budget: Omit<Budget, 'id' | 'updatedAt'>): Promise<Budget> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'budgets'), {
      ...budget,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
    return { ...budget, id: ref.id, updatedAt: now };
  }

  async updateBudget(
    tripId: string,
    id: string,
    changes: Partial<Omit<Budget, 'id' | 'updatedAt'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'budgets', id), {
      ...changes,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
  }

  async listBudgetSections(tripId: string, budgetId: string): Promise<BudgetSection[]> {
    const snap = await getDocs(
      query(
        collection(this.db, 'trips', tripId, 'budgetSections'),
        where('budgetId', '==', budgetId)
      )
    );
    return snap.docs.map((d) => toBudgetSection(d.id, d.data()));
  }

  async getBudgetSection(tripId: string, sectionId: string): Promise<BudgetSection> {
    const snap = await getDoc(doc(this.db, 'trips', tripId, 'budgetSections', sectionId));
    if (!snap.exists()) throw new Error(`Budget section ${sectionId} not found`);
    return toBudgetSection(snap.id, snap.data());
  }

  async addBudgetSection(
    tripId: string,
    section: Omit<BudgetSection, 'id' | 'updatedAt'>
  ): Promise<BudgetSection> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'budgetSections'), {
      ...section,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
    return { ...section, id: ref.id, updatedAt: now };
  }

  async updateBudgetSection(
    tripId: string,
    id: string,
    changes: Partial<Omit<BudgetSection, 'id' | 'updatedAt'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'budgetSections', id), {
      ...changes,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
  }

  async listBudgetItems(tripId: string, budgetSectionId: string): Promise<BudgetItem[]> {
    const snap = await getDocs(
      query(
        collection(this.db, 'trips', tripId, 'budgetItems'),
        where('budgetSectionId', '==', budgetSectionId)
      )
    );
    return snap.docs.map((d) => toBudgetItem(d.id, d.data()));
  }

  async getBudgetItem(tripId: string, itemId: string): Promise<BudgetItem> {
    const snap = await getDoc(doc(this.db, 'trips', tripId, 'budgetItems', itemId));
    if (!snap.exists()) throw new Error(`Budget item ${itemId} not found`);
    return toBudgetItem(snap.id, snap.data());
  }

  async addBudgetItem(
    tripId: string,
    item: Omit<BudgetItem, 'id' | 'updatedAt'>
  ): Promise<BudgetItem> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(this.db, 'trips', tripId, 'budgetItems'), {
      ...item,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
    return { ...item, id: ref.id, updatedAt: now };
  }

  async updateBudgetItem(
    tripId: string,
    id: string,
    changes: Partial<Omit<BudgetItem, 'id' | 'updatedAt'>>
  ): Promise<void> {
    await updateDoc(doc(this.db, 'trips', tripId, 'budgetItems', id), {
      ...changes,
      updatedAt: serverTimestamp(),
      lastModifiedBy: this.stampWriter(),
    });
  }
}
