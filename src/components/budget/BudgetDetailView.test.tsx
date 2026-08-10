import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BudgetDetailView } from './BudgetDetailView';
import { renderWithProviders, resetStores } from '../../test/helpers';
import { useTripStore } from '../../store/tripStore';
import type { TripRepository } from '../../data/TripRepository';
import type { Budget, BudgetItem, BudgetSection } from '../../types';

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'budget-1',
    name: 'Backpacker',
    currency: 'JPY',
    updatedAt: '2026-01-01T00:00:00.000Z',
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

function makeRepo(overrides: Partial<TripRepository> = {}): TripRepository {
  return {
    addBudgetSection: vi.fn().mockResolvedValue(makeSection({ id: 'section-saved' })),
    updateBudgetSection: vi.fn().mockResolvedValue(undefined),
    deleteBudgetSection: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as TripRepository;
}

function pasteIntoNotes(text: string) {
  const editor = screen.getByRole('textbox', { name: 'Notes' });
  fireEvent.focus(editor);
  fireEvent.paste(editor, {
    clipboardData: { getData: (fmt: string) => (fmt === 'text/plain' ? text : '') },
  });
}

beforeEach(() => {
  resetStores();
});

describe('BudgetDetailView', () => {
  it('returns null when the budget is not found', () => {
    const repo = makeRepo();
    useTripStore.setState({ repo, tripId: 'trip-1', budgets: [] });

    const { container } = renderWithProviders(
      <BudgetDetailView budgetId="missing" onBack={() => {}} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('calls onBack when the back button is clicked', async () => {
    const onBack = vi.fn();
    const repo = makeRepo();
    useTripStore.setState({ repo, tripId: 'trip-1', budgets: [makeBudget()] });

    renderWithProviders(<BudgetDetailView budgetId="budget-1" onBack={onBack} />);

    await userEvent.click(screen.getByLabelText('Back to budgets'));
    expect(onBack).toHaveBeenCalled();
  });

  it('adds a section with a category and name', async () => {
    const addBudgetSection = vi.fn().mockResolvedValue(makeSection({ id: 'section-saved' }));
    const repo = makeRepo({ addBudgetSection });
    useTripStore.setState({ repo, tripId: 'trip-1', budgets: [makeBudget()], budgetSections: [] });

    renderWithProviders(<BudgetDetailView budgetId="budget-1" onBack={() => {}} />);

    await userEvent.click(screen.getByText('+ Add section'));
    await userEvent.type(screen.getByLabelText('Section name'), 'Meals');
    await userEvent.click(screen.getByText('Save'));

    expect(addBudgetSection).toHaveBeenCalledWith(
      'trip-1',
      expect.objectContaining({ budgetId: 'budget-1', name: 'Meals', category: 'other', order: 0 })
    );
  });

  it('shows the items-sum subtotal when the section has items', () => {
    const repo = makeRepo();
    const section = makeSection();
    const item: BudgetItem = {
      id: 'item-1',
      budgetSectionId: 'section-1',
      name: 'Ryokan',
      rateType: 'constant',
      quantity: 1,
      price: 8000,
      order: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    useTripStore.setState({
      repo,
      tripId: 'trip-1',
      budgets: [makeBudget()],
      budgetSections: [section],
      budgetItems: [item],
    });

    renderWithProviders(<BudgetDetailView budgetId="budget-1" onBack={() => {}} />);

    expect(screen.getByText(/Hotel — ¥8,000/)).toBeInTheDocument();
  });

  it('shows the flat-price subtotal when the section has no items', () => {
    const repo = makeRepo();
    const section = makeSection({ price: 5000 });
    useTripStore.setState({
      repo,
      tripId: 'trip-1',
      budgets: [makeBudget()],
      budgetSections: [section],
      budgetItems: [],
    });

    renderWithProviders(<BudgetDetailView budgetId="budget-1" onBack={() => {}} />);

    expect(screen.getByText(/Hotel — ¥5,000/)).toBeInTheDocument();
  });

  it('deletes a section after confirmation', async () => {
    const deleteBudgetSection = vi.fn().mockResolvedValue(undefined);
    const repo = makeRepo({ deleteBudgetSection });
    useTripStore.setState({
      repo,
      tripId: 'trip-1',
      budgets: [makeBudget()],
      budgetSections: [makeSection()],
    });

    renderWithProviders(<BudgetDetailView budgetId="budget-1" onBack={() => {}} />);

    await userEvent.click(screen.getByLabelText('Delete Hotel'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteBudgetSection).toHaveBeenCalledWith('trip-1', 'section-1');
  });

  it('moves sections up and down by swapping order', async () => {
    const updateBudgetSection = vi.fn().mockResolvedValue(undefined);
    const repo = makeRepo({ updateBudgetSection });
    const sections = [
      makeSection({ id: 'section-1', name: 'First', order: 0 }),
      makeSection({ id: 'section-2', name: 'Second', order: 1 }),
    ];
    useTripStore.setState({
      repo,
      tripId: 'trip-1',
      budgets: [makeBudget()],
      budgetSections: sections,
    });

    renderWithProviders(<BudgetDetailView budgetId="budget-1" onBack={() => {}} />);

    await userEvent.click(screen.getByLabelText('Move Second up'));

    expect(updateBudgetSection).toHaveBeenCalledWith('trip-1', 'section-2', { order: 0 });
    expect(updateBudgetSection).toHaveBeenCalledWith('trip-1', 'section-1', { order: 1 });
  });

  it('renders section notes as real markdown elements, not literal syntax', () => {
    const repo = makeRepo();
    const section = makeSection({ notes: 'ask front desk for **late checkout**' });
    useTripStore.setState({
      repo,
      tripId: 'trip-1',
      budgets: [makeBudget()],
      budgetSections: [section],
      budgetItems: [],
    });

    renderWithProviders(<BudgetDetailView budgetId="budget-1" onBack={() => {}} />);

    const strong = screen.getByText('late checkout');
    expect(strong.tagName).toBe('STRONG');
  });

  it('does not render a notes block when the section has none', () => {
    const repo = makeRepo();
    useTripStore.setState({
      repo,
      tripId: 'trip-1',
      budgets: [makeBudget()],
      budgetSections: [makeSection({ notes: undefined })],
      budgetItems: [],
    });

    renderWithProviders(<BudgetDetailView budgetId="budget-1" onBack={() => {}} />);

    expect(screen.queryByRole('textbox', { name: 'Notes' })).not.toBeInTheDocument();
  });

  it('saves notes typed into the add-section form', async () => {
    const addBudgetSection = vi.fn().mockResolvedValue(makeSection({ id: 'section-saved' }));
    const repo = makeRepo({ addBudgetSection });
    useTripStore.setState({ repo, tripId: 'trip-1', budgets: [makeBudget()], budgetSections: [] });

    renderWithProviders(<BudgetDetailView budgetId="budget-1" onBack={() => {}} />);

    await userEvent.click(screen.getByText('+ Add section'));
    await userEvent.type(screen.getByLabelText('Section name'), 'Meals');
    pasteIntoNotes('tax not included');
    await userEvent.click(screen.getByText('Save'));

    expect(addBudgetSection).toHaveBeenCalledWith(
      'trip-1',
      expect.objectContaining({ notes: expect.stringContaining('tax not included') })
    );
  });
});
