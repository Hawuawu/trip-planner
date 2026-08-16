import type { ActivityLogEntry } from '../types';
import { formatActivityLogEntry } from './activityLog';

export interface ActivityLogFilterOptions {
  search: string;
  actors: string[];
}

export function filterActivityLog(
  entries: ActivityLogEntry[],
  { search, actors }: ActivityLogFilterOptions
): ActivityLogEntry[] {
  const q = search.trim().toLowerCase();
  return entries.filter((e) => {
    const matchesSearch = !q || formatActivityLogEntry(e).toLowerCase().includes(q);
    const matchesActor = actors.length === 0 || actors.includes(e.actorLabel);
    return matchesSearch && matchesActor;
  });
}

export function collectActorLabels(entries: ActivityLogEntry[]): string[] {
  return Array.from(new Set(entries.map((e) => e.actorLabel))).sort();
}
