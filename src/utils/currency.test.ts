import { describe, it, expect } from 'vitest';
import { formatMoney, COMMON_CURRENCY_CODES } from './currency';

describe('formatMoney', () => {
  it('formats a zero-decimal currency like JPY without cents', () => {
    expect(formatMoney(15000, 'JPY')).toBe('¥15,000');
  });

  it('formats a two-decimal currency like USD with cents', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50');
  });

  it('formats EUR with the euro symbol', () => {
    expect(formatMoney(99, 'EUR')).toBe('€99.00');
  });

  it('formats zero', () => {
    expect(formatMoney(0, 'USD')).toBe('$0.00');
  });

  it('formats CZK', () => {
    // Intl inserts a non-breaking space (not U+0020) between the ISO code
    // and the amount for locales with no dedicated CZK symbol — match on
    // content, not the exact whitespace character.
    expect(formatMoney(239110, 'CZK')).toMatch(/^CZK\s239,110\.00$/);
  });
});

describe('COMMON_CURRENCY_CODES', () => {
  it('includes JPY as the first (default) entry', () => {
    expect(COMMON_CURRENCY_CODES[0]).toBe('JPY');
  });

  it('has no duplicate codes', () => {
    expect(new Set(COMMON_CURRENCY_CODES).size).toBe(COMMON_CURRENCY_CODES.length);
  });

  it('includes CZK', () => {
    expect(COMMON_CURRENCY_CODES).toContain('CZK');
  });
});
