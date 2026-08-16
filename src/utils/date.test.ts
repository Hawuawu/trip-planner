import { describe, it, expect } from 'vitest';
import {
  parseLocalDate,
  enumerateDays,
  localDayKey,
  formatDayLabel,
  parseOffsetDateTime,
  extractOffset,
  formatCheckpointTime,
  formatCheckpointDate,
  currentUtcOffsetString,
  pad,
} from './date';

describe('parseLocalDate', () => {
  it('builds a Date from the local calendar components of a bare date string', () => {
    const d = parseLocalDate('2026-10-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(1);
  });
});

describe('enumerateDays', () => {
  it('returns a single-element array when start === end', () => {
    expect(enumerateDays('2026-10-01', '2026-10-01')).toEqual(['2026-10-01']);
  });

  it('is inclusive of both boundaries', () => {
    expect(enumerateDays('2026-10-01', '2026-10-03')).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
  });

  it('spans a month boundary correctly', () => {
    expect(enumerateDays('2026-10-30', '2026-11-01')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });
});

describe('parseOffsetDateTime', () => {
  it('parses a +09:00 offset', () => {
    expect(parseOffsetDateTime('2026-09-13T14:00:00+09:00')).toEqual({
      year: 2026,
      month: 9,
      day: 13,
      hour: 14,
      minute: 0,
      second: 0,
      offset: '+09:00',
    });
  });

  it('parses a -05:00 offset', () => {
    expect(parseOffsetDateTime('2026-09-13T14:00:00-05:00')).toEqual({
      year: 2026,
      month: 9,
      day: 13,
      hour: 14,
      minute: 0,
      second: 0,
      offset: '-05:00',
    });
  });

  it('parses a Z (UTC) offset', () => {
    expect(parseOffsetDateTime('2026-09-13T14:00:00Z')).toEqual({
      year: 2026,
      month: 9,
      day: 13,
      hour: 14,
      minute: 0,
      second: 0,
      offset: 'Z',
    });
  });

  it('throws on an ISO string with no explicit offset', () => {
    expect(() => parseOffsetDateTime('2026-09-13T14:00:00')).toThrow();
  });

  it('throws on a bare date string', () => {
    expect(() => parseOffsetDateTime('2026-09-13')).toThrow();
  });
});

describe('extractOffset', () => {
  it('returns just the offset portion of an ISO string', () => {
    expect(extractOffset('2026-09-13T14:00:00+09:00')).toBe('+09:00');
  });
});

describe('formatCheckpointTime / formatCheckpointDate', () => {
  it('formats the wall-clock digits embedded in the offset, regardless of TZ', () => {
    const iso = '2026-09-13T14:00:00+09:00';
    expect(formatCheckpointTime(iso)).toMatch(/^0?2:00\s*PM$|^14:00$/);
    expect(formatCheckpointDate(iso)).toMatch(/Sep/);
    expect(formatCheckpointDate(iso)).toMatch(/13/);
  });

  it('produces the same result for a negative offset regardless of process.env.TZ', () => {
    const iso = '2026-09-13T14:00:00-05:00';
    const time = formatCheckpointTime(iso);
    expect(time).toMatch(/^0?2:00\s*PM$|^14:00$/);
  });
});

describe('currentUtcOffsetString', () => {
  it('returns a +HH:MM/-HH:MM string matching the runtime timezone offset', () => {
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMin);
    const expected = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
    expect(currentUtcOffsetString()).toBe(expected);
  });
});

describe('localDayKey', () => {
  it('extracts the calendar day from the ISO datetime using its own offset', () => {
    expect(localDayKey('2026-10-06T08:00:00.000Z')).toBe('2026-10-06');
  });

  it('buckets a negative-offset checkpoint into its own destination-local day, not the UTC day', () => {
    // 19:00 at -07:00 is still Oct 1 at the checkpoint's own location, even
    // though the equivalent UTC instant (02:00Z) is already Oct 2.
    expect(localDayKey('2026-10-01T19:00:00-07:00')).toBe('2026-10-01');
  });
});

describe('formatDayLabel', () => {
  it('formats a day key as a short month/day label', () => {
    const label = formatDayLabel('2026-10-02');
    expect(label).toMatch(/Oct/);
    expect(label).toMatch(/2/);
  });
});
