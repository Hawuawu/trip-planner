import type { ActivityLogEntry } from '../types';

export function formatActivityLogEntry(entry: ActivityLogEntry): string {
  const who = entry.actorLabel;
  switch (entry.type) {
    case 'member_invited':
      return `${who} invited ${entry.entityName ?? 'a new member'}`;
    case 'member_joined':
      return `${who} joined the trip`;
    case 'member_removed':
      return `${who} removed ${entry.entityName ?? 'a member'}`;
    case 'member_left':
      return `${who} left the trip`;
    case 'trip_renamed':
      return `${who} renamed the trip to "${entry.entityName ?? ''}"`;
    case 'checkpoint_added':
      return `${who} added checkpoint "${entry.entityName ?? ''}"`;
    case 'checkpoint_updated':
      return entry.entityName
        ? `${who} updated checkpoint "${entry.entityName}"`
        : `${who} updated a checkpoint${entry.changedFields?.length ? ` (${entry.changedFields.join(', ')})` : ''}`;
    case 'checkpoint_deleted':
      return `${who} deleted checkpoint "${entry.entityName ?? ''}"`;
    case 'checkpoints_imported':
      return `${who} imported ${entry.count ?? 0} checkpoint${entry.count === 1 ? '' : 's'}`;
    case 'alternative_added':
      return `${who} added alternative "${entry.entityName ?? ''}"`;
    case 'alternative_updated':
      return entry.entityName
        ? `${who} updated alternative "${entry.entityName}"`
        : `${who} updated an alternative`;
    case 'alternative_deleted':
      return `${who} deleted alternative "${entry.entityName ?? ''}"`;
    case 'alternatives_imported':
      return `${who} imported ${entry.count ?? 0} alternative${entry.count === 1 ? '' : 's'}`;
    case 'alternative_promoted':
      return `${who} promoted "${entry.entityName ?? ''}" to the timeline`;
    case 'booking_added':
      return `${who} added booking "${entry.entityName ?? ''}"`;
    case 'booking_updated':
      return entry.entityName
        ? `${who} updated booking "${entry.entityName}"`
        : `${who} updated a booking`;
    case 'booking_deleted':
      return `${who} deleted booking "${entry.entityName ?? ''}"`;
    default:
      return `${who} made a change`;
  }
}
