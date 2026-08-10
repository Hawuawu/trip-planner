export type CheckpointType = 'flight' | 'train' | 'metro' | 'hotel' | 'poi' | 'other';

export interface Location {
  lat: number;
  lng: number;
  label?: string;
}

export interface Checkpoint {
  id: string;
  type: CheckpointType;
  name: string;
  startTime: string;
  endTime?: string;
  location?: Location;
  notes?: string;
  websiteUrl?: string;
  tags?: string[];
  linkedBookingId?: string;
  updatedAt: string;
}

export interface Alternative {
  id: string;
  type: CheckpointType;
  name: string;
  location?: Location;
  notes?: string;
  websiteUrl?: string;
  tags?: string[];
  createdAt?: string; // ISO string; optional — absent on legacy items created before #76
}

export interface Booking {
  id: string;
  provider: string;
  confirmationNumber: string;
  notes?: string;
}

export interface Route {
  id: string;
  name: string;
  days: string[];
  checkpointIds: string[];
  updatedAt: string;
}

export interface WikiSection {
  id: string;
  title: string;
  content: string; // markdown
  order: number;
  updatedAt: string;
}

export type BudgetCategory = 'travel' | 'hotel' | 'meals' | 'merchandise' | 'other';
export type BudgetRateType = 'constant' | 'per_person' | 'per_night';

export interface BudgetAlternative {
  id: string;
  label: string;
  price: number;
  rateType: BudgetRateType;
  quantity: number; // ignored when rateType === 'constant'
  selected: boolean;
}

export interface Budget {
  id: string;
  name: string;
  currency: string; // ISO 4217 code, e.g. "JPY"
  updatedAt: string;
}

export interface BudgetSection {
  id: string;
  budgetId: string;
  category: BudgetCategory;
  name: string;
  price?: number; // flat subtotal, used only when this section has no items
  notes?: string; // markdown
  order: number;
  updatedAt: string;
}

export interface BudgetItem {
  id: string;
  budgetSectionId: string;
  name: string;
  price?: number; // flat contribution, used only when alternatives is empty/absent
  rateType: BudgetRateType;
  quantity: number;
  alternatives?: BudgetAlternative[];
  notes?: string; // markdown
  order: number;
  updatedAt: string;
}

export interface MemberProfile {
  email: string | null;
  displayName: string | null;
  joinedAt?: string;
}

export interface Trip {
  id: string;
  name: string;
  dateRange: { start: string; end: string };
  memberIds: string[];
  ownerId?: string;
  memberProfiles?: Record<string, MemberProfile>;
}

export type ActivityLogEntryType =
  | 'member_invited'
  | 'member_joined'
  | 'member_removed'
  | 'member_left'
  | 'trip_renamed'
  | 'checkpoint_added'
  | 'checkpoint_updated'
  | 'checkpoint_deleted'
  | 'checkpoints_imported'
  | 'alternative_added'
  | 'alternative_updated'
  | 'alternative_deleted'
  | 'alternatives_imported'
  | 'alternative_promoted'
  | 'booking_added'
  | 'booking_updated'
  | 'booking_deleted'
  | 'route_added'
  | 'route_updated'
  | 'route_deleted'
  | 'wiki_section_added'
  | 'wiki_section_updated'
  | 'wiki_section_deleted'
  | 'budget_added'
  | 'budget_updated'
  | 'budget_deleted'
  | 'budget_section_added'
  | 'budget_section_updated'
  | 'budget_section_deleted'
  | 'budget_item_added'
  | 'budget_item_updated'
  | 'budget_item_deleted';

export interface ActivityLogEntry {
  id: string;
  type: ActivityLogEntryType;
  actorUid: string;
  actorLabel: string;
  entityName?: string;
  changedFields?: string[];
  count?: number;
  createdAt: string;
}

export type InviteMemberResult =
  { status: 'invited'; uid: string } | { status: 'already-member'; uid: string };

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  // From the appAccess/admin custom claims (stamped at sign-in, see #35).
  // Absent in contexts where claims aren't available (e.g. getCurrentUser's
  // sync path). admin is data-driven — copied from the allowedUsers doc's
  // role field, not a hardcoded identity.
  appAccess?: boolean;
  admin?: boolean;
}

export type AllowedUserRole = 'admin' | 'member';

export interface AllowedUser {
  email: string;
  invitedVia: string; // 'seed' or 'approved'
  role: AllowedUserRole;
  createdAt: string;
}

export type AccessRequestStatus = 'pending' | 'approved' | 'denied' | 'revoked';

export interface AccessRequest {
  email: string;
  displayName: string | null;
  status: AccessRequestStatus;
  firstSeenAt: string;
  lastSeenAt: string;
}

export type AppActivityType =
  | 'access_requested'
  | 'access_approved'
  | 'access_denied'
  | 'access_revoked'
  | 'admin_granted'
  | 'admin_revoked';

export interface AppActivityEntry {
  id: string;
  type: AppActivityType;
  email: string | null;
  actor: 'admin' | 'system';
  createdAt: string;
}
