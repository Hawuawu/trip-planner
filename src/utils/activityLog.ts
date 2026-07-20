import type { ActivityLogEntry, ActivityLogEntryType } from '../types';

type Formatter = (entry: ActivityLogEntry) => string;

// "who <verb> <noun> "<name>"" — shared by every add/delete entry type.
function quoted(verb: string, noun: string): Formatter {
  return (entry) => `${entry.actorLabel} ${verb} ${noun} "${entry.entityName ?? ''}"`;
}

// "who updated <noun> "<name>"", or — when no name was captured — "who
// updated a/an <noun> (field, field)" listing whatever changed.
function updated(noun: string, article: 'a' | 'an'): Formatter {
  return (entry) => {
    if (entry.entityName) return `${entry.actorLabel} updated ${noun} "${entry.entityName}"`;
    const fields = entry.changedFields?.length ? ` (${entry.changedFields.join(', ')})` : '';
    return `${entry.actorLabel} updated ${article} ${noun}${fields}`;
  };
}

// "who imported N <noun>(s)" — shared by the two bulk-import entry types.
function imported(noun: string): Formatter {
  return (entry) => {
    const count = entry.count ?? 0;
    return `${entry.actorLabel} imported ${count} ${noun}${count === 1 ? '' : 's'}`;
  };
}

const FORMATTERS: Record<ActivityLogEntryType, Formatter> = {
  member_invited: (e) => `${e.actorLabel} invited ${e.entityName ?? 'a new member'}`,
  member_joined: (e) => `${e.actorLabel} joined the trip`,
  member_removed: (e) => `${e.actorLabel} removed ${e.entityName ?? 'a member'}`,
  member_left: (e) => `${e.actorLabel} left the trip`,
  trip_renamed: (e) => `${e.actorLabel} renamed the trip to "${e.entityName ?? ''}"`,
  checkpoint_added: quoted('added', 'checkpoint'),
  checkpoint_updated: updated('checkpoint', 'a'),
  checkpoint_deleted: quoted('deleted', 'checkpoint'),
  checkpoints_imported: imported('checkpoint'),
  alternative_added: quoted('added', 'alternative'),
  alternative_updated: updated('alternative', 'an'),
  alternative_deleted: quoted('deleted', 'alternative'),
  alternatives_imported: imported('alternative'),
  alternative_promoted: (e) => `${e.actorLabel} promoted "${e.entityName ?? ''}" to the timeline`,
  booking_added: quoted('added', 'booking'),
  booking_updated: updated('booking', 'a'),
  booking_deleted: quoted('deleted', 'booking'),
};

export function formatActivityLogEntry(entry: ActivityLogEntry): string {
  const format = FORMATTERS[entry.type];
  return format ? format(entry) : `${entry.actorLabel} made a change`;
}
