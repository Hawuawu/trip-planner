export const COMMON_CURRENCY_CODES = [
  'JPY',
  'USD',
  'EUR',
  'GBP',
  'KRW',
  'CNY',
  'AUD',
  'CAD',
  'CZK',
] as const;

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}
