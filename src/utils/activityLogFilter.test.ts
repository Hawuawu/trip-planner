import { describe, it, expect } from 'vitest';
import { filterActivityLog, collectActorLabels } from './activityLogFilter';
import type { ActivityLogEntry } from '../types';

function makeEntry(overrides: Partial<ActivityLogEntry> = {}): ActivityLogEntry {
  return {
    id: 'e1',
    type: 'checkpoint_added',
    actorUid: 'u1',
    actorLabel: 'Alice',
    entityName: 'Senso-ji',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('filterActivityLog', () => {
  it('returns all entries when no filters are set', () => {
    const entries = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2', actorLabel: 'Bob' })];
    expect(filterActivityLog(entries, { search: '', actors: [] })).toEqual(entries);
  });

  it('matches the rendered sentence case-insensitively, not raw fields', () => {
    const entries = [
      makeEntry({ id: 'e1', type: 'checkpoint_added', entityName: 'Senso-ji' }),
      makeEntry({ id: 'e2', type: 'member_joined', entityName: undefined, actorLabel: 'Bob' }),
    ];
    // "added checkpoint" only appears in the formatted sentence for
    // checkpoint_added, never in the raw `type` enum value itself.
    const result = filterActivityLog(entries, { search: 'ADDED CHECKPOINT', actors: [] });
    expect(result.map((e) => e.id)).toEqual(['e1']);
  });

  it('treats an empty actors array as no filter', () => {
    const entries = [makeEntry({ id: 'e1', actorLabel: 'Alice' })];
    expect(filterActivityLog(entries, { search: '', actors: [] })).toEqual(entries);
  });

  it('narrows to entries matching the selected actors', () => {
    const entries = [
      makeEntry({ id: 'e1', actorLabel: 'Alice' }),
      makeEntry({ id: 'e2', actorLabel: 'Bob' }),
      makeEntry({ id: 'e3', actorLabel: 'Carol' }),
    ];
    const result = filterActivityLog(entries, { search: '', actors: ['Bob', 'Carol'] });
    expect(result.map((e) => e.id)).toEqual(['e2', 'e3']);
  });

  it('combines search and actor filters with AND', () => {
    const entries = [
      makeEntry({
        id: 'e1',
        actorLabel: 'Alice',
        type: 'checkpoint_added',
        entityName: 'Senso-ji',
      }),
      makeEntry({ id: 'e2', actorLabel: 'Bob', type: 'checkpoint_added', entityName: 'Senso-ji' }),
      makeEntry({
        id: 'e3',
        actorLabel: 'Alice',
        type: 'checkpoint_deleted',
        entityName: 'Fushimi',
      }),
    ];
    // e1 matches both search+actor; e2 matches search but not actor; e3
    // matches actor but not search — only e1 should survive the AND.
    const result = filterActivityLog(entries, { search: 'senso-ji', actors: ['Alice'] });
    expect(result.map((e) => e.id)).toEqual(['e1']);
  });
});

describe('collectActorLabels', () => {
  it('returns an empty array for no entries', () => {
    expect(collectActorLabels([])).toEqual([]);
  });

  it('dedupes repeated actor labels', () => {
    const entries = [
      makeEntry({ id: 'e1', actorLabel: 'Alice' }),
      makeEntry({ id: 'e2', actorLabel: 'Alice' }),
      makeEntry({ id: 'e3', actorLabel: 'Bob' }),
    ];
    expect(collectActorLabels(entries)).toEqual(['Alice', 'Bob']);
  });

  it('sorts alphabetically', () => {
    const entries = [
      makeEntry({ id: 'e1', actorLabel: 'Carol' }),
      makeEntry({ id: 'e2', actorLabel: 'Alice' }),
      makeEntry({ id: 'e3', actorLabel: 'Bob' }),
    ];
    expect(collectActorLabels(entries)).toEqual(['Alice', 'Bob', 'Carol']);
  });
});
