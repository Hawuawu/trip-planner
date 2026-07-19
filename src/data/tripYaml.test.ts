import { describe, it, expect } from 'vitest';
import { parseCheckpointsYaml, parseTripYaml, serializeTrip } from './tripYaml';
import type { Trip, Checkpoint, Alternative } from '../types';

const TRIP: Trip = {
  id: 'trip-1',
  name: 'Japan 2026',
  dateRange: { start: '2026-10-01', end: '2026-10-14' },
  memberIds: ['u1'],
  ownerId: 'u1',
};

const CHECKPOINTS: Checkpoint[] = [
  {
    id: 'c1',
    type: 'flight',
    name: 'JFK → NRT',
    startTime: '2026-10-01T14:00:00.000Z',
    endTime: '2026-10-02T17:00:00.000Z',
    notes: 'JL 005, seat 32A',
    linkedBookingId: 'b1',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c2',
    type: 'hotel',
    name: 'Shinjuku Granbell Hotel',
    startTime: '2026-10-02T15:00:00.000Z',
    endTime: '2026-10-05T11:00:00.000Z',
    location: { lat: 35.6938, lng: 139.7034, label: 'Shinjuku, Tokyo' },
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const ALTERNATIVES: Alternative[] = [
  {
    id: 'a1',
    type: 'poi',
    name: 'teamLab Borderless',
    location: { lat: 35.6591, lng: 139.7138, label: 'Azabudai Hills, Tokyo' },
    notes: 'Optional rainy-day activity',
  },
];

describe('serializeTrip / parseTripYaml — round trip', () => {
  it('round-trips name, dateRange, checkpoints and alternatives', () => {
    const yamlText = serializeTrip(TRIP, CHECKPOINTS, ALTERNATIVES);
    const parsed = parseTripYaml(yamlText);

    expect(parsed.errors).toEqual([]);
    expect(parsed.name).toBe(TRIP.name);
    expect(parsed.dateRange).toEqual(TRIP.dateRange);
    expect(parsed.checkpoints).toHaveLength(2);
    expect(parsed.checkpoints[0]).toMatchObject({
      type: 'flight',
      name: 'JFK → NRT',
      startTime: '2026-10-01T14:00:00.000Z',
      endTime: '2026-10-02T17:00:00.000Z',
      notes: 'JL 005, seat 32A',
    });
    expect(parsed.checkpoints[1]).toMatchObject({
      type: 'hotel',
      name: 'Shinjuku Granbell Hotel',
      location: { lat: 35.6938, lng: 139.7034, label: 'Shinjuku, Tokyo' },
    });
    expect(parsed.alternatives).toHaveLength(1);
    expect(parsed.alternatives[0]).toMatchObject({
      type: 'poi',
      name: 'teamLab Borderless',
      notes: 'Optional rainy-day activity',
    });
  });

  it('strips id, updatedAt and linkedBookingId from exported checkpoints', () => {
    const yamlText = serializeTrip(TRIP, CHECKPOINTS, ALTERNATIVES);
    expect(yamlText).not.toContain('linkedBookingId');
    expect(yamlText).not.toContain('updatedAt');
    expect(yamlText).not.toContain('c1');
    expect(yamlText).not.toContain('c2');
  });

  it('ignores id/updatedAt/linkedBookingId if present on import', () => {
    const yamlText = `
name: Test Trip
dateRange:
  start: "2026-01-01"
  end: "2026-01-05"
checkpoints:
  - id: should-be-ignored
    updatedAt: "2020-01-01T00:00:00.000Z"
    linkedBookingId: some-booking
    type: poi
    name: Has extra fields
    startTime: "2026-01-01T09:00:00.000Z"
`;
    const parsed = parseTripYaml(yamlText);
    expect(parsed.errors).toEqual([]);
    expect(parsed.checkpoints[0]).not.toHaveProperty('id');
    expect(parsed.checkpoints[0]).not.toHaveProperty('updatedAt');
    expect(parsed.checkpoints[0]).not.toHaveProperty('linkedBookingId');
  });

  it('a full-trip export file also parses cleanly via parseCheckpointsYaml', () => {
    const yamlText = serializeTrip(TRIP, CHECKPOINTS, ALTERNATIVES);
    const parsed = parseCheckpointsYaml(yamlText);
    expect(parsed.errors).toEqual([]);
    expect(parsed.checkpoints).toHaveLength(2);
    expect(parsed.alternatives).toHaveLength(1);
  });
});

describe('parseCheckpointsYaml — checkpoints-only schema', () => {
  it('parses a minimal checkpoints-only file with no trip metadata', () => {
    const yamlText = `
checkpoints:
  - type: poi
    name: Nara Deer Park
    startTime: "2026-10-09T09:00:00.000Z"
    location: { lat: 34.6851, lng: 135.8048, label: Nara Park }
alternatives:
  - type: poi
    name: Todai-ji Temple (backup if raining)
`;
    const parsed = parseCheckpointsYaml(yamlText);
    expect(parsed.errors).toEqual([]);
    expect(parsed.checkpoints).toHaveLength(1);
    expect(parsed.alternatives).toHaveLength(1);
  });

  it('treats missing checkpoints/alternatives keys as empty lists, not errors', () => {
    const parsed = parseCheckpointsYaml('checkpoints: []');
    expect(parsed.errors).toEqual([]);
    expect(parsed.alternatives).toEqual([]);
  });

  it('treats a null checkpoints key (empty YAML value) as an empty list', () => {
    const parsed = parseCheckpointsYaml('checkpoints:\nalternatives:\n');
    expect(parsed.errors).toEqual([]);
    expect(parsed.checkpoints).toEqual([]);
    expect(parsed.alternatives).toEqual([]);
  });
});

describe('YAML syntax errors', () => {
  it('returns a single top-level error for invalid YAML syntax', () => {
    const parsed = parseCheckpointsYaml('checkpoints: [unterminated');
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].path).toBe('(document)');
    expect(parsed.checkpoints).toEqual([]);
  });

  it('rejects a top-level YAML list instead of a mapping', () => {
    const parsed = parseCheckpointsYaml('- just\n- a\n- list\n');
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].path).toBe('(document)');
  });

  it('rejects a bare scalar document', () => {
    const parsed = parseCheckpointsYaml('just a string');
    expect(parsed.errors).toHaveLength(1);
  });
});

describe('per-field validation — checkpoints', () => {
  it('rejects an invalid "type"', () => {
    const parsed = parseCheckpointsYaml(
      'checkpoints:\n  - type: sightseeing\n    name: Nara Deer Park\n    startTime: "2026-10-09T09:00:00.000Z"\n'
    );
    expect(parsed.checkpoints).toEqual([]);
    expect(parsed.errors[0].message).toContain('"type" must be one of');
  });

  it('rejects a missing "type"', () => {
    const parsed = parseCheckpointsYaml(
      'checkpoints:\n  - name: No type\n    startTime: "2026-01-01T00:00:00.000Z"\n'
    );
    expect(parsed.errors.some((e) => e.message.includes('"type"'))).toBe(true);
  });

  it('rejects a missing "name"', () => {
    const parsed = parseCheckpointsYaml(
      'checkpoints:\n  - type: poi\n    startTime: "2026-01-01T00:00:00.000Z"\n'
    );
    expect(parsed.errors.some((e) => e.message.includes('"name"'))).toBe(true);
  });

  it('rejects an empty/whitespace-only "name"', () => {
    const parsed = parseCheckpointsYaml(
      'checkpoints:\n  - type: poi\n    name: "   "\n    startTime: "2026-01-01T00:00:00.000Z"\n'
    );
    expect(parsed.errors.some((e) => e.message.includes('"name"'))).toBe(true);
  });

  it('rejects a missing "startTime"', () => {
    const parsed = parseCheckpointsYaml('checkpoints:\n  - type: poi\n    name: Missing start\n');
    expect(parsed.errors.some((e) => e.message.includes('"startTime"'))).toBe(true);
  });

  it('rejects an unparseable "startTime"', () => {
    const parsed = parseCheckpointsYaml(
      'checkpoints:\n  - type: poi\n    name: Bad date\n    startTime: "not-a-date"\n'
    );
    expect(parsed.errors.some((e) => e.message.includes('"startTime"'))).toBe(true);
  });

  it('rejects an unparseable "endTime"', () => {
    const parsed = parseCheckpointsYaml(
      'checkpoints:\n  - type: poi\n    name: Bad end\n    startTime: "2026-01-01T00:00:00.000Z"\n    endTime: "not-a-date"\n'
    );
    expect(parsed.errors.some((e) => e.message.includes('"endTime"'))).toBe(true);
  });

  it('rejects "endTime" before "startTime"', () => {
    const parsed = parseCheckpointsYaml(
      'checkpoints:\n  - type: poi\n    name: Backwards\n    startTime: "2026-01-05T00:00:00.000Z"\n    endTime: "2026-01-01T00:00:00.000Z"\n'
    );
    expect(parsed.errors.some((e) => e.message.includes('on or after'))).toBe(true);
  });

  it('accepts "endTime" equal to "startTime"', () => {
    const parsed = parseCheckpointsYaml(
      'checkpoints:\n  - type: poi\n    name: Instant\n    startTime: "2026-01-01T00:00:00.000Z"\n    endTime: "2026-01-01T00:00:00.000Z"\n'
    );
    expect(parsed.errors).toEqual([]);
  });

  it('rejects "notes" that is not a string', () => {
    const parsed = parseCheckpointsYaml(
      'checkpoints:\n  - type: poi\n    name: Bad notes\n    startTime: "2026-01-01T00:00:00.000Z"\n    notes: [1, 2, 3]\n'
    );
    expect(parsed.errors.some((e) => e.message.includes('"notes"'))).toBe(true);
  });

  it('rejects "location.lat" out of range', () => {
    const parsed = parseCheckpointsYaml(
      'checkpoints:\n  - type: poi\n    name: Bad lat\n    startTime: "2026-01-01T00:00:00.000Z"\n    location: { lat: 200, lng: 10 }\n'
    );
    expect(parsed.errors.some((e) => e.message.includes('"location.lat"'))).toBe(true);
  });

  it('rejects "location.lng" out of range', () => {
    const parsed = parseCheckpointsYaml(
      'checkpoints:\n  - type: poi\n    name: Bad lng\n    startTime: "2026-01-01T00:00:00.000Z"\n    location: { lat: 10, lng: -200 }\n'
    );
    expect(parsed.errors.some((e) => e.message.includes('"location.lng"'))).toBe(true);
  });

  it('rejects "location" missing lat/lng entirely', () => {
    const parsed = parseCheckpointsYaml(
      'checkpoints:\n  - type: poi\n    name: Bad location\n    startTime: "2026-01-01T00:00:00.000Z"\n    location: { label: "Somewhere" }\n'
    );
    expect(parsed.errors.some((e) => e.message.includes('"location.lat"'))).toBe(true);
  });

  it('rejects a non-object list entry', () => {
    const parsed = parseCheckpointsYaml('checkpoints:\n  - "just a string"\n');
    expect(parsed.errors.some((e) => e.message.includes('must be an object'))).toBe(true);
  });

  it('rejects "checkpoints" that is not a list', () => {
    const parsed = parseCheckpointsYaml('checkpoints: "not a list"\n');
    expect(parsed.errors.some((e) => e.message.includes('must be a list'))).toBe(true);
  });

  it('collects one error entry per invalid item, all-or-nothing', () => {
    const yamlText = `
checkpoints:
  - type: poi
    name: Valid One
    startTime: "2026-01-01T00:00:00.000Z"
  - type: sightseeing
    name: Nara Deer Park
    startTime: "2026-01-02T00:00:00.000Z"
`;
    const parsed = parseCheckpointsYaml(yamlText);
    expect(parsed.checkpoints).toHaveLength(1);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].path).toContain('Nara Deer Park');
  });
});

describe('per-field validation — alternatives', () => {
  it('does not require startTime for alternatives', () => {
    const parsed = parseCheckpointsYaml(
      'alternatives:\n  - type: poi\n    name: No dates needed\n'
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.alternatives).toHaveLength(1);
  });

  it('still validates type/name/location for alternatives', () => {
    const parsed = parseCheckpointsYaml(
      'alternatives:\n  - type: sightseeing\n    name: Bad type\n'
    );
    expect(parsed.errors.some((e) => e.message.includes('"type"'))).toBe(true);
  });
});

describe('parseTripYaml — full-trip-only fields', () => {
  it('requires a non-empty top-level "name"', () => {
    const parsed = parseTripYaml('dateRange:\n  start: "2026-01-01"\n  end: "2026-01-05"\n');
    expect(parsed.errors.some((e) => e.path === 'name')).toBe(true);
  });

  it('requires "dateRange"', () => {
    const parsed = parseTripYaml('name: My Trip\n');
    expect(parsed.errors.some((e) => e.path === 'dateRange')).toBe(true);
  });

  it('requires "dateRange.start"', () => {
    const parsed = parseTripYaml('name: My Trip\ndateRange:\n  end: "2026-01-05"\n');
    expect(parsed.errors.some((e) => e.path === 'dateRange.start')).toBe(true);
  });

  it('requires "dateRange.end"', () => {
    const parsed = parseTripYaml('name: My Trip\ndateRange:\n  start: "2026-01-01"\n');
    expect(parsed.errors.some((e) => e.path === 'dateRange.end')).toBe(true);
  });
});
