import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BudgetItemList } from './BudgetItemList';
import { renderWithProviders, resetStores } from '../../test/helpers';
import { useTripStore } from '../../store/tripStore';
import type { TripRepository } from '../../data/TripRepository';
import type { BudgetItem } from '../../types';

function makeItem(overrides: Partial<BudgetItem> = {}): BudgetItem {
  return {
    id: 'item-1',
    budgetSectionId: 'section-1',
    name: 'Hotel',
    rateType: 'constant',
    quantity: 1,
    price: 8000,
    order: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRepo(overrides: Partial<TripRepository> = {}): TripRepository {
  return {
    addBudgetItem: vi.fn().mockResolvedValue(makeItem({ id: 'item-saved' })),
    updateBudgetItem: vi.fn().mockResolvedValue(undefined),
    deleteBudgetItem: vi.fn().mockResolvedValue(undefined),
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

describe('BudgetItemList', () => {
  it('adds an item with a flat price', async () => {
    const addBudgetItem = vi.fn().mockResolvedValue(makeItem({ id: 'item-saved' }));
    const repo = makeRepo({ addBudgetItem });
    useTripStore.setState({ repo, tripId: 'trip-1' });

    renderWithProviders(<BudgetItemList budgetSectionId="section-1" items={[]} currency="JPY" />);

    await userEvent.click(screen.getByText('+ Add item'));
    await userEvent.type(screen.getByLabelText('Item name'), 'Business hotel');
    await userEvent.type(screen.getByLabelText('Price'), '8000');
    await userEvent.click(screen.getByText('Save'));

    expect(addBudgetItem).toHaveBeenCalledWith(
      'trip-1',
      expect.objectContaining({ name: 'Business hotel', price: 8000, order: 0 })
    );
  });

  it('shows the computed contribution reflecting rate type and quantity', () => {
    const repo = makeRepo();
    useTripStore.setState({ repo, tripId: 'trip-1' });
    const item = makeItem({ name: 'Ryokan', price: 15000, rateType: 'per_night', quantity: 3 });

    renderWithProviders(
      <BudgetItemList budgetSectionId="section-1" items={[item]} currency="JPY" />
    );

    expect(screen.getByText(/Ryokan — ¥45,000/)).toBeInTheDocument();
  });

  it('edits an item name in place', async () => {
    const updateBudgetItem = vi.fn().mockResolvedValue(undefined);
    const repo = makeRepo({ updateBudgetItem });
    useTripStore.setState({ repo, tripId: 'trip-1' });
    const item = makeItem();

    renderWithProviders(
      <BudgetItemList budgetSectionId="section-1" items={[item]} currency="JPY" />
    );

    await userEvent.click(screen.getByLabelText('Edit Hotel'));
    const nameField = screen.getByLabelText('Item name');
    await userEvent.clear(nameField);
    await userEvent.type(nameField, 'Business hotel');
    await userEvent.click(screen.getByText('Save'));

    expect(updateBudgetItem).toHaveBeenCalledWith(
      'trip-1',
      'item-1',
      expect.objectContaining({ name: 'Business hotel' })
    );
  });

  it('deletes an item after confirmation', async () => {
    const deleteBudgetItem = vi.fn().mockResolvedValue(undefined);
    const repo = makeRepo({ deleteBudgetItem });
    useTripStore.setState({ repo, tripId: 'trip-1' });
    const item = makeItem();

    renderWithProviders(
      <BudgetItemList budgetSectionId="section-1" items={[item]} currency="JPY" />
    );

    await userEvent.click(screen.getByLabelText('Delete Hotel'));
    expect(screen.getByText(/This can't be undone/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteBudgetItem).toHaveBeenCalledWith('trip-1', 'item-1');
  });

  it('moves items up and down by swapping order', async () => {
    const updateBudgetItem = vi.fn().mockResolvedValue(undefined);
    const repo = makeRepo({ updateBudgetItem });
    useTripStore.setState({ repo, tripId: 'trip-1' });
    const items = [
      makeItem({ id: 'item-1', name: 'First', order: 0 }),
      makeItem({ id: 'item-2', name: 'Second', order: 1 }),
    ];

    renderWithProviders(
      <BudgetItemList budgetSectionId="section-1" items={items} currency="JPY" />
    );

    await userEvent.click(screen.getByLabelText('Move Second up'));

    expect(updateBudgetItem).toHaveBeenCalledWith('trip-1', 'item-2', { order: 0 });
    expect(updateBudgetItem).toHaveBeenCalledWith('trip-1', 'item-1', { order: 1 });
  });

  it('scrolls the highlighted item into view when highlightItemId is set', () => {
    const repo = makeRepo();
    useTripStore.setState({ repo, tripId: 'trip-1' });
    const items = [
      makeItem({ id: 'item-1', name: 'First', order: 0 }),
      makeItem({ id: 'item-2', name: 'Second', order: 1 }),
    ];
    const scrollIntoViewSpy = vi.spyOn(Element.prototype, 'scrollIntoView');

    renderWithProviders(
      <BudgetItemList
        budgetSectionId="section-1"
        items={items}
        currency="JPY"
        highlightItemId="item-2"
      />
    );

    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });

  it('does not scroll when highlightItemId is not set', () => {
    const repo = makeRepo();
    useTripStore.setState({ repo, tripId: 'trip-1' });
    const items = [makeItem({ id: 'item-1', name: 'First', order: 0 })];
    const scrollIntoViewSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockClear();

    renderWithProviders(
      <BudgetItemList budgetSectionId="section-1" items={items} currency="JPY" />
    );

    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
  });

  it('renders item notes as real markdown elements, not literal syntax', () => {
    const repo = makeRepo();
    useTripStore.setState({ repo, tripId: 'trip-1' });
    const item = makeItem({ notes: 'book **early** for a discount' });

    renderWithProviders(
      <BudgetItemList budgetSectionId="section-1" items={[item]} currency="JPY" />
    );

    const strong = screen.getByText('early');
    expect(strong.tagName).toBe('STRONG');
  });

  it('does not render a notes block when the item has none', () => {
    const repo = makeRepo();
    useTripStore.setState({ repo, tripId: 'trip-1' });
    const item = makeItem({ notes: undefined });

    renderWithProviders(
      <BudgetItemList budgetSectionId="section-1" items={[item]} currency="JPY" />
    );

    expect(screen.queryByRole('textbox', { name: 'Notes' })).not.toBeInTheDocument();
  });

  it('saves notes typed into the edit form', async () => {
    const addBudgetItem = vi.fn().mockResolvedValue(makeItem({ id: 'item-saved' }));
    const repo = makeRepo({ addBudgetItem });
    useTripStore.setState({ repo, tripId: 'trip-1' });

    renderWithProviders(<BudgetItemList budgetSectionId="section-1" items={[]} currency="JPY" />);

    await userEvent.click(screen.getByText('+ Add item'));
    await userEvent.type(screen.getByLabelText('Item name'), 'Business hotel');
    pasteIntoNotes('breakfast included');
    await userEvent.click(screen.getByText('Save'));

    expect(addBudgetItem).toHaveBeenCalledWith(
      'trip-1',
      expect.objectContaining({ notes: expect.stringContaining('breakfast included') })
    );
  });
});
