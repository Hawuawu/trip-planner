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
}

export interface AllowedUser {
  email: string;
  invitedVia: string; // 'seed' or the invite token that admitted them
  createdAt: string;
}

export type AppInviteStatus = 'pending' | 'redeemed' | 'cancelled';

export interface AppInvite {
  token: string;
  status: AppInviteStatus;
  redeemedEmail: string | null;
  createdAt: string;
}

export type AppActivityType =
  'invite_created' | 'invite_redeemed' | 'invite_cancelled' | 'access_revoked' | 'sign_in_rejected';

export interface AppActivityEntry {
  id: string;
  type: AppActivityType;
  email: string | null;
  token: string | null;
  actor: 'admin' | 'system';
  createdAt: string;
}
