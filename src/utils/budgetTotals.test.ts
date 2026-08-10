import { describe, it, expect } from 'vitest';
import {
  computeItemContribution,
  computeSectionSubtotal,
  computeBudgetTotal,
} from './budgetTotals';
import type { Budget, BudgetAlternative, BudgetItem, BudgetSection } from '../types';

function makeItem(overrides: Partial<BudgetItem> = {}): BudgetItem {
  return {
    id: 'item-1',
    budgetSectionId: 'section-1',
    name: 'Hotel',
    rateType: 'constant',
    quantity: 1,
    order: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeAlternative(overrides: Partial<BudgetAlternative> = {}): BudgetAlternative {
  return {
    id: 'alt-1',
    label: 'Ryokan',
    price: 15000,
    rateType: 'per_night',
    quantity: 1,
    selected: false,
    ...overrides,
  };
}

function makeSection(overrides: Partial<BudgetSection> = {}): BudgetSection {
  return {
    id: 'section-1',
    budgetId: 'budget-1',
    category: 'hotel',
    name: 'Hotel',
    order: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    name: 'Backpacker',
    currency: 'JPY',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeItemContribution', () => {
  it('returns the flat price for a constant-rate item with no alternatives', () => {
    expect(computeItemContribution(makeItem({ price: 8000, rateType: 'constant' }))).toBe(8000);
  });

  it('multiplies price by quantity for a per_night item with no alternatives', () => {
    expect(
      computeItemContribution(makeItem({ price: 8000, rateType: 'per_night', quantity: 3 }))
    ).toBe(24000);
  });

  it('multiplies price by quantity for a per_person item with no alternatives', () => {
    expect(
      computeItemContribution(makeItem({ price: 5000, rateType: 'per_person', quantity: 2 }))
    ).toBe(10000);
  });

  it('defaults a missing flat price to 0', () => {
    expect(computeItemContribution(makeItem({ rateType: 'constant' }))).toBe(0);
  });

  it('uses the selected alternative contribution when alternatives are present', () => {
    const item = makeItem({
      alternatives: [
        makeAlternative({
          id: 'alt-1',
          price: 15000,
          rateType: 'per_night',
          quantity: 2,
          selected: true,
        }),
        makeAlternative({
          id: 'alt-2',
          price: 8000,
          rateType: 'per_night',
          quantity: 2,
          selected: false,
        }),
      ],
    });
    expect(computeItemContribution(item)).toBe(30000);
  });

  it('falls back to 0 when alternatives are present but none is selected', () => {
    const item = makeItem({
      alternatives: [
        makeAlternative({ id: 'alt-1', selected: false }),
        makeAlternative({ id: 'alt-2', selected: false }),
      ],
    });
    expect(computeItemContribution(item)).toBe(0);
  });

  it('ignores an empty alternatives array and falls back to the flat price', () => {
    expect(
      computeItemContribution(makeItem({ price: 1000, rateType: 'constant', alternatives: [] }))
    ).toBe(1000);
  });
});

describe('computeSectionSubtotal', () => {
  it('sums item contributions when the section has items', () => {
    const section = makeSection({ id: 'section-1', price: 999999 });
    const items = [
      makeItem({ id: 'item-1', budgetSectionId: 'section-1', price: 1000, rateType: 'constant' }),
      makeItem({ id: 'item-2', budgetSectionId: 'section-1', price: 2000, rateType: 'constant' }),
    ];
    expect(computeSectionSubtotal(section, items)).toBe(3000);
  });

  it('falls back to the flat price when the section has no items', () => {
    const section = makeSection({ id: 'section-1', price: 5000 });
    expect(computeSectionSubtotal(section, [])).toBe(5000);
  });

  it('defaults to 0 when the section has no items and no flat price', () => {
    const section = makeSection({ id: 'section-1' });
    expect(computeSectionSubtotal(section, [])).toBe(0);
  });

  it('only counts items belonging to this section', () => {
    const section = makeSection({ id: 'section-1' });
    const items = [
      makeItem({ id: 'item-1', budgetSectionId: 'section-1', price: 1000, rateType: 'constant' }),
      makeItem({ id: 'item-2', budgetSectionId: 'section-2', price: 9999, rateType: 'constant' }),
    ];
    expect(computeSectionSubtotal(section, items)).toBe(1000);
  });
});

describe('computeBudgetTotal', () => {
  it('sums only this budget’s section subtotals', () => {
    const budget = makeBudget({ id: 'budget-1' });
    const sections = [
      makeSection({ id: 'section-1', budgetId: 'budget-1', price: 1000 }),
      makeSection({ id: 'section-2', budgetId: 'budget-1', price: 2000 }),
      makeSection({ id: 'section-3', budgetId: 'budget-2', price: 9999 }),
    ];
    expect(computeBudgetTotal(budget, sections, [])).toBe(3000);
  });

  it('mixes item-derived and flat-price section subtotals', () => {
    const budget = makeBudget({ id: 'budget-1' });
    const sections = [
      makeSection({ id: 'section-1', budgetId: 'budget-1' }),
      makeSection({ id: 'section-2', budgetId: 'budget-1', price: 4000 }),
    ];
    const items = [
      makeItem({ id: 'item-1', budgetSectionId: 'section-1', price: 1500, rateType: 'constant' }),
    ];
    expect(computeBudgetTotal(budget, sections, items)).toBe(5500);
  });

  it('returns 0 for a budget with no sections', () => {
    expect(computeBudgetTotal(makeBudget(), [], [])).toBe(0);
  });
});
