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

const FORMATTERS: Record<ActivityLogEntryType, Formatter> = {
  member_invited: (e) => `${e.actorLabel} invited ${e.entityName ?? 'a new member'}`,
  member_joined: (e) => `${e.actorLabel} joined the trip`,
  member_removed: (e) => `${e.actorLabel} removed ${e.entityName ?? 'a member'}`,
  member_left: (e) => `${e.actorLabel} left the trip`,
  trip_created: (e) => `${e.actorLabel} created the trip "${e.entityName ?? ''}"`,
  trip_renamed: (e) => `${e.actorLabel} renamed the trip to "${e.entityName ?? ''}"`,
  trip_dates_updated: (e) => `${e.actorLabel} updated the trip dates`,
  checkpoint_added: quoted('added', 'checkpoint'),
  checkpoint_updated: updated('checkpoint', 'a'),
  checkpoint_deleted: quoted('deleted', 'checkpoint'),
  alternative_added: quoted('added', 'alternative'),
  alternative_updated: updated('alternative', 'an'),
  alternative_deleted: quoted('deleted', 'alternative'),
  booking_added: quoted('added', 'booking'),
  booking_updated: updated('booking', 'a'),
  route_added: quoted('added', 'route'),
  route_updated: updated('route', 'a'),
  route_deleted: quoted('deleted', 'route'),
  wiki_section_added: quoted('added', 'Wiki section'),
  wiki_section_updated: updated('Wiki section', 'a'),
  wiki_section_deleted: quoted('deleted', 'Wiki section'),
  budget_added: quoted('added', 'budget'),
  budget_updated: updated('budget', 'a'),
  budget_deleted: quoted('deleted', 'budget'),
  budget_section_added: quoted('added', 'budget section'),
  budget_section_updated: updated('budget section', 'a'),
  budget_section_deleted: quoted('deleted', 'budget section'),
  budget_item_added: quoted('added', 'budget item'),
  budget_item_updated: updated('budget item', 'a'),
  budget_item_deleted: quoted('deleted', 'budget item'),
};

export function formatActivityLogEntry(entry: ActivityLogEntry): string {
  const format = FORMATTERS[entry.type];
  return format ? format(entry) : `${entry.actorLabel} made a change`;
}
