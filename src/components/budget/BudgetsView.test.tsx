import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BudgetsView } from './BudgetsView';
import { renderWithProviders, resetStores } from '../../test/helpers';
import { useTripStore } from '../../store/tripStore';
import type { TripRepository } from '../../data/TripRepository';
import type { Budget } from '../../types';

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    name: 'Backpacker',
    currency: 'JPY',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRepo(overrides: Partial<TripRepository> = {}): TripRepository {
  return {
    addBudget: vi.fn().mockResolvedValue(makeBudget({ id: 'budget-saved' })),
    deleteBudget: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as TripRepository;
}

beforeEach(() => {
  resetStores();
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('BudgetsView', () => {
  it('shows an empty state when there are no budgets', () => {
    const repo = makeRepo();
    useTripStore.setState({ repo, tripId: 'trip-1', budgets: [] });

    renderWithProviders(<BudgetsView open onClose={() => {}} />);

    expect(screen.getByText(/No budgets yet/)).toBeInTheDocument();
  });

  it('adds a budget with a name and currency', async () => {
    const addBudget = vi.fn().mockResolvedValue(makeBudget({ id: 'budget-saved' }));
    const repo = makeRepo({ addBudget });
    useTripStore.setState({ repo, tripId: 'trip-1', budgets: [] });

    renderWithProviders(<BudgetsView open onClose={() => {}} />);

    await userEvent.click(screen.getByText('+ Add budget'));
    await userEvent.type(screen.getByLabelText('Budget name'), 'Comfort');
    await userEvent.click(screen.getByText('Save'));

    expect(addBudget).toHaveBeenCalledWith('trip-1', { name: 'Comfort', currency: 'JPY' });
  });

  it('remembers the last-picked currency for the next add', async () => {
    const repo = makeRepo();
    useTripStore.setState({ repo, tripId: 'trip-1', budgets: [] });

    renderWithProviders(<BudgetsView open onClose={() => {}} />);

    await userEvent.click(screen.getByText('+ Add budget'));
    const currencyInput = screen.getByLabelText('Currency');
    await userEvent.clear(currencyInput);
    await userEvent.type(currencyInput, 'USD');
    await userEvent.type(screen.getByLabelText('Budget name'), 'Comfort');
    await userEvent.click(screen.getByText('Save'));

    expect(localStorage.getItem('trip-planner:preferredCurrency')).toBe('USD');
  });

  it('shows the computed total for each budget in the list', () => {
    const repo = makeRepo();
    useTripStore.setState({
      repo,
      tripId: 'trip-1',
      budgets: [makeBudget()],
      budgetSections: [
        {
          id: 'section-1',
          budgetId: 'budget-1',
          category: 'hotel',
          name: 'Hotel',
          price: 8000,
          order: 0,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      budgetItems: [],
    });

    renderWithProviders(<BudgetsView open onClose={() => {}} />);

    expect(screen.getByText('¥8,000')).toBeInTheDocument();
  });

  it('deletes a budget after confirmation', async () => {
    const deleteBudget = vi.fn().mockResolvedValue(undefined);
    const repo = makeRepo({ deleteBudget });
    useTripStore.setState({ repo, tripId: 'trip-1', budgets: [makeBudget()] });

    renderWithProviders(<BudgetsView open onClose={() => {}} />);

    await userEvent.click(screen.getByLabelText('Delete Backpacker'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteBudget).toHaveBeenCalledWith('trip-1', 'budget-1');
  });

  it('opens BudgetDetailView on row click, and back returns to the list', async () => {
    const repo = makeRepo();
    useTripStore.setState({ repo, tripId: 'trip-1', budgets: [makeBudget()] });

    renderWithProviders(<BudgetsView open onClose={() => {}} />);

    await userEvent.click(screen.getByText('Backpacker'));
    expect(screen.getByLabelText('Back to budgets')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Back to budgets'));
    expect(screen.getByText('+ Add budget')).toBeInTheDocument();
  });

  it('jumps straight to a budget’s detail view when budgetNavigationTarget is set', () => {
    const repo = makeRepo();
    useTripStore.setState({
      repo,
      tripId: 'trip-1',
      budgets: [makeBudget()],
      budgetNavigationTarget: { budgetId: 'budget-1', itemId: null },
    });

    renderWithProviders(<BudgetsView open onClose={() => {}} />);

    expect(screen.getByLabelText('Back to budgets')).toBeInTheDocument();
    expect(screen.queryByText('+ Add budget')).toBeNull();
  });

  it('returns to the landing list, clearing the highlight, after Close and reopen with no new target', async () => {
    const repo = makeRepo();
    useTripStore.setState({
      repo,
      tripId: 'trip-1',
      budgets: [makeBudget()],
      budgetNavigationTarget: { budgetId: 'budget-1', itemId: 'item-1' },
    });

    renderWithProviders(<BudgetsView open onClose={() => {}} />);
    expect(screen.getByLabelText('Back to budgets')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('+ Add budget')).toBeInTheDocument();
  });
});
