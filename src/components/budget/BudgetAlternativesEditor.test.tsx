import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BudgetAlternativesEditor } from './BudgetAlternativesEditor';
import { renderWithProviders, resetStores } from '../../test/helpers';
import { useTripStore } from '../../store/tripStore';
import type { TripRepository } from '../../data/TripRepository';
import type { BudgetItem } from '../../types';

function makeItem(overrides: Partial<BudgetItem> = {}): BudgetItem {
  return {
    id: 'item-1',
    budgetSectionId: 'section-1',
    name: 'Hotel',
    rateType: 'per_night',
    quantity: 1,
    order: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRepo(overrides: Partial<TripRepository> = {}): TripRepository {
  return {
    updateBudgetItem: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as TripRepository;
}

beforeEach(() => {
  resetStores();
});

describe('BudgetAlternativesEditor', () => {
  it('adds a new alternative and auto-selects it when it is the first one', async () => {
    const updateBudgetItem = vi.fn().mockResolvedValue(undefined);
    const repo = makeRepo({ updateBudgetItem });
    useTripStore.setState({ repo, tripId: 'trip-1' });
    const item = makeItem();

    renderWithProviders(<BudgetAlternativesEditor item={item} currency="JPY" />);

    await userEvent.click(screen.getByText('+ Add alternative'));
    await userEvent.type(screen.getByLabelText('Label'), 'Ryokan');
    await userEvent.click(screen.getByText('Save'));

    expect(updateBudgetItem).toHaveBeenCalledWith(
      'trip-1',
      'item-1',
      expect.objectContaining({
        alternatives: [expect.objectContaining({ label: 'Ryokan', selected: true })],
      })
    );
  });

  it('does not auto-select a second alternative added after the first', async () => {
    const updateBudgetItem = vi.fn().mockResolvedValue(undefined);
    const repo = makeRepo({ updateBudgetItem });
    useTripStore.setState({ repo, tripId: 'trip-1' });
    const item = makeItem({
      alternatives: [
        {
          id: 'alt-1',
          label: 'Ryokan',
          price: 15000,
          rateType: 'per_night',
          quantity: 1,
          selected: true,
        },
      ],
    });

    renderWithProviders(<BudgetAlternativesEditor item={item} currency="JPY" />);

    await userEvent.click(screen.getByText('+ Add alternative'));
    await userEvent.type(screen.getByLabelText('Label'), 'Business hotel');
    await userEvent.click(screen.getByText('Save'));

    expect(updateBudgetItem).toHaveBeenCalledWith(
      'trip-1',
      'item-1',
      expect.objectContaining({
        alternatives: expect.arrayContaining([
          expect.objectContaining({ label: 'Business hotel', selected: false }),
        ]),
      })
    );
  });

  it('selecting a radio calls selectBudgetItemAlternative, not a raw update', async () => {
    const selectBudgetItemAlternative = vi.fn().mockResolvedValue(undefined);
    const repo = makeRepo();
    useTripStore.setState({ repo, tripId: 'trip-1', selectBudgetItemAlternative });
    const item = makeItem({
      alternatives: [
        {
          id: 'alt-1',
          label: 'Ryokan',
          price: 15000,
          rateType: 'per_night',
          quantity: 1,
          selected: true,
        },
        {
          id: 'alt-2',
          label: 'Business hotel',
          price: 8000,
          rateType: 'per_night',
          quantity: 1,
          selected: false,
        },
      ],
    });

    renderWithProviders(<BudgetAlternativesEditor item={item} currency="JPY" />);

    await userEvent.click(screen.getByRole('radio', { name: /Business hotel/ }));

    expect(selectBudgetItemAlternative).toHaveBeenCalledWith('item-1', 'alt-2');
  });

  it('removes an alternative and reassigns selection to the first remaining one', async () => {
    const updateBudgetItem = vi.fn().mockResolvedValue(undefined);
    const repo = makeRepo({ updateBudgetItem });
    useTripStore.setState({ repo, tripId: 'trip-1' });
    const item = makeItem({
      alternatives: [
        {
          id: 'alt-1',
          label: 'Ryokan',
          price: 15000,
          rateType: 'per_night',
          quantity: 1,
          selected: true,
        },
        {
          id: 'alt-2',
          label: 'Business hotel',
          price: 8000,
          rateType: 'per_night',
          quantity: 1,
          selected: false,
        },
      ],
    });

    renderWithProviders(<BudgetAlternativesEditor item={item} currency="JPY" />);

    await userEvent.click(screen.getByLabelText('Delete Ryokan'));

    expect(updateBudgetItem).toHaveBeenCalledWith(
      'trip-1',
      'item-1',
      expect.objectContaining({
        alternatives: [expect.objectContaining({ id: 'alt-2', selected: true })],
      })
    );
  });
});
