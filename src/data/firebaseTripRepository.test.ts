/**
 * Pure unit tests for the toIso conversion logic extracted from FirebaseTripRepository.
 * These run with the normal vitest config (jsdom/node) — no emulator needed.
 */
import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// toIso — replicated here so it can be tested without instantiating the repo
// (which calls import.meta.env at module level via getDb()).
// ---------------------------------------------------------------------------

function toIso(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

describe('toIso (FirebaseTripRepository conversion helper)', () => {
  it('converts a Firestore Timestamp to an ISO 8601 string', () => {
    const ts = Timestamp.fromDate(new Date('2026-10-01T00:00:00.000Z'));
    expect(toIso(ts)).toBe('2026-10-01T00:00:00.000Z');
  });

  it('returns a string value unchanged', () => {
    expect(toIso('already-a-string')).toBe('already-a-string');
  });

  it('returns a valid ISO string for undefined (falls back to now)', () => {
    const before = Date.now();
    const result = toIso(undefined);
    const after = Date.now();

    expect(typeof result).toBe('string');
    // Must be parseable as a date
    const parsed = new Date(result).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  it('returns a valid ISO string for null (falls back to now)', () => {
    const result = toIso(null);
    expect(() => new Date(result)).not.toThrow();
    expect(new Date(result).toISOString()).toBe(result);
  });

  it('handles a Timestamp for an arbitrary date', () => {
    const date = new Date('2025-03-15T12:30:00.000Z');
    const ts = Timestamp.fromDate(date);
    expect(toIso(ts)).toBe('2025-03-15T12:30:00.000Z');
  });

  it('handles a numeric epoch value (falls back to now)', () => {
    // Numbers are not strings or Timestamps — should fall back
    const before = Date.now();
    const result = toIso(1234567890);
    const after = Date.now();
    const parsed = new Date(result).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });
});
