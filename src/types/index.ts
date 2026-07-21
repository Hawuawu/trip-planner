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
  linkedBookingId?: string;
  updatedAt: string;
}

export interface Alternative {
  id: string;
  type: CheckpointType;
  name: string;
  location?: Location;
  notes?: string;
}

export interface Booking {
  id: string;
  provider: string;
  confirmationNumber: string;
  notes?: string;
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
  | 'booking_deleted';

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
