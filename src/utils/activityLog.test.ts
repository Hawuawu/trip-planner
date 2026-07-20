import { describe, it, expect } from 'vitest';
import { formatActivityLogEntry } from './activityLog';
import type { ActivityLogEntry } from '../types';

function makeEntry(overrides: Partial<ActivityLogEntry> = {}): ActivityLogEntry {
  return {
    id: 'e1',
    type: 'checkpoint_added',
    actorUid: 'u1',
    actorLabel: 'Alice',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('formatActivityLogEntry', () => {
  it('formats member_invited', () => {
    expect(
      formatActivityLogEntry(makeEntry({ type: 'member_invited', entityName: 'bob@example.com' }))
    ).toBe('Alice invited bob@example.com');
  });

  it('formats member_joined', () => {
    expect(formatActivityLogEntry(makeEntry({ type: 'member_joined' }))).toBe(
      'Alice joined the trip'
    );
  });

  it('formats member_removed', () => {
    expect(formatActivityLogEntry(makeEntry({ type: 'member_removed', entityName: 'Bob' }))).toBe(
      'Alice removed Bob'
    );
  });

  it('formats member_left', () => {
    expect(formatActivityLogEntry(makeEntry({ type: 'member_left' }))).toBe('Alice left the trip');
  });

  it('formats trip_renamed', () => {
    expect(
      formatActivityLogEntry(makeEntry({ type: 'trip_renamed', entityName: 'Japan Redux' }))
    ).toBe('Alice renamed the trip to "Japan Redux"');
  });

  it('formats checkpoint_added', () => {
    expect(
      formatActivityLogEntry(makeEntry({ type: 'checkpoint_added', entityName: 'Senso-ji' }))
    ).toBe('Alice added checkpoint "Senso-ji"');
  });

  it('formats checkpoint_updated with a name', () => {
    expect(
      formatActivityLogEntry(
        makeEntry({ type: 'checkpoint_updated', entityName: 'Senso-ji', changedFields: ['name'] })
      )
    ).toBe('Alice updated checkpoint "Senso-ji"');
  });

  it('formats checkpoint_updated without a name, listing changed fields', () => {
    expect(
      formatActivityLogEntry(
        makeEntry({ type: 'checkpoint_updated', changedFields: ['startTime', 'notes'] })
      )
    ).toBe('Alice updated a checkpoint (startTime, notes)');
  });

  it('formats checkpoints_imported with singular count', () => {
    expect(formatActivityLogEntry(makeEntry({ type: 'checkpoints_imported', count: 1 }))).toBe(
      'Alice imported 1 checkpoint'
    );
  });

  it('formats checkpoints_imported with plural count', () => {
    expect(formatActivityLogEntry(makeEntry({ type: 'checkpoints_imported', count: 5 }))).toBe(
      'Alice imported 5 checkpoints'
    );
  });

  it('formats alternative_promoted', () => {
    expect(
      formatActivityLogEntry(
        makeEntry({ type: 'alternative_promoted', entityName: 'Nishiki Market' })
      )
    ).toBe('Alice promoted "Nishiki Market" to the timeline');
  });

  it('formats booking_deleted', () => {
    expect(formatActivityLogEntry(makeEntry({ type: 'booking_deleted', entityName: 'ANA' }))).toBe(
      'Alice deleted booking "ANA"'
    );
  });

  it('formats checkpoint_deleted', () => {
    expect(
      formatActivityLogEntry(makeEntry({ type: 'checkpoint_deleted', entityName: 'Senso-ji' }))
    ).toBe('Alice deleted checkpoint "Senso-ji"');
  });

  it('formats alternative_added', () => {
    expect(
      formatActivityLogEntry(makeEntry({ type: 'alternative_added', entityName: 'Nishiki Market' }))
    ).toBe('Alice added alternative "Nishiki Market"');
  });

  it('formats alternative_updated with a name', () => {
    expect(
      formatActivityLogEntry(
        makeEntry({ type: 'alternative_updated', entityName: 'Nishiki Market' })
      )
    ).toBe('Alice updated alternative "Nishiki Market"');
  });

  it('formats alternative_updated without a name', () => {
    expect(formatActivityLogEntry(makeEntry({ type: 'alternative_updated' }))).toBe(
      'Alice updated an alternative'
    );
  });

  it('formats alternative_deleted', () => {
    expect(
      formatActivityLogEntry(
        makeEntry({ type: 'alternative_deleted', entityName: 'Nishiki Market' })
      )
    ).toBe('Alice deleted alternative "Nishiki Market"');
  });

  it('formats alternatives_imported with plural count', () => {
    expect(formatActivityLogEntry(makeEntry({ type: 'alternatives_imported', count: 3 }))).toBe(
      'Alice imported 3 alternatives'
    );
  });

  it('formats booking_added', () => {
    expect(formatActivityLogEntry(makeEntry({ type: 'booking_added', entityName: 'ANA' }))).toBe(
      'Alice added booking "ANA"'
    );
  });

  it('formats booking_updated with a name', () => {
    expect(formatActivityLogEntry(makeEntry({ type: 'booking_updated', entityName: 'ANA' }))).toBe(
      'Alice updated booking "ANA"'
    );
  });

  it('formats booking_updated without a name', () => {
    expect(formatActivityLogEntry(makeEntry({ type: 'booking_updated' }))).toBe(
      'Alice updated a booking'
    );
  });

  it('falls back to a generic message for an unrecognized type', () => {
    expect(
      formatActivityLogEntry(
        makeEntry({ type: 'something_unexpected' as ActivityLogEntry['type'] })
      )
    ).toBe('Alice made a change');
  });
});
