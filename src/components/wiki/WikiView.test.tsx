import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WikiView } from './WikiView';
import { renderWithProviders, resetStores } from '../../test/helpers';
import { useTripStore } from '../../store/tripStore';
import type { WikiSection } from '../../types';

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function seedSections(sections: WikiSection[]) {
  useTripStore.setState({ wikiSections: sections });
}

const SECTION_1: WikiSection = {
  id: 'wiki-1',
  title: 'Overview',
  content: 'This trip covers **Tokyo** and Kyoto.',
  order: 0,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SECTION_2: WikiSection = {
  id: 'wiki-2',
  title: 'Day 3 — Kyoto',
  content: 'See [Fushimi Inari](trip://checkpoint/cp-1) in the morning.',
  order: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SECTION_3: WikiSection = {
  id: 'wiki-4',
  title: 'Costs',
  content:
    'Staying at [Ryokan](trip://budget_item/item-1) — see the [Backpacker](trip://budget/budget-1) budget.',
  order: 2,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const LONG_SECTION: WikiSection = {
  id: 'wiki-3',
  title: 'Full Itinerary',
  content: 'A very long day-by-day plan. '.repeat(15),
  order: 2,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function setup(overrides: Partial<React.ComponentProps<typeof WikiView>> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    onNavigate: vi.fn(),
    ...overrides,
  };
  renderWithProviders(<WikiView {...props} />);
  return props;
}

describe('WikiView', () => {
  it('shows an empty-state message when there are no sections', () => {
    setup();
    expect(screen.getByText(/no sections yet/i)).toBeInTheDocument();
  });

  it('renders each section title and its markdown content', () => {
    seedSections([SECTION_1]);
    setup();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    const strong = screen.getByText('Tokyo');
    expect(strong.tagName).toBe('STRONG');
  });

  it('adds a new section via the "+ Add section" control', async () => {
    const addWikiSection = vi
      .spyOn(useTripStore.getState(), 'addWikiSection')
      .mockResolvedValue()
      .mockClear();
    setup();

    fireEvent.click(screen.getByRole('button', { name: '+ Add section' }));
    const titleInput = screen.getByRole('textbox', { name: 'Section title' });
    await userEvent.type(titleInput, 'New Section');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(addWikiSection).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Section', order: 0 })
      );
    });
  });

  it('Edit → change title → Save calls updateWikiSection', async () => {
    const updateWikiSection = vi
      .spyOn(useTripStore.getState(), 'updateWikiSection')
      .mockResolvedValue()
      .mockClear();
    seedSections([SECTION_1]);
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Overview' }));
    const titleInput = screen.getByRole('textbox', { name: 'Section title' });
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Trip Overview');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateWikiSection).toHaveBeenCalledWith(
        'wiki-1',
        expect.objectContaining({ title: 'Trip Overview' })
      );
    });
  });

  it('Edit → change title → Cancel discards the draft', async () => {
    const updateWikiSection = vi
      .spyOn(useTripStore.getState(), 'updateWikiSection')
      .mockResolvedValue()
      .mockClear();
    seedSections([SECTION_1]);
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Overview' }));
    const titleInput = screen.getByRole('textbox', { name: 'Section title' });
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Discarded title');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(updateWikiSection).not.toHaveBeenCalled();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.queryByText('Discarded title')).toBeNull();
  });

  it('deletes a section after confirming', async () => {
    const deleteWikiSection = vi
      .spyOn(useTripStore.getState(), 'deleteWikiSection')
      .mockResolvedValue()
      .mockClear();
    seedSections([SECTION_1]);
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteWikiSection).toHaveBeenCalledWith('wiki-1');
    });
  });

  it('moving a section down swaps order with the next section', async () => {
    const updateWikiSection = vi
      .spyOn(useTripStore.getState(), 'updateWikiSection')
      .mockResolvedValue()
      .mockClear();
    seedSections([SECTION_1, SECTION_2]);
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Move Overview down' }));

    await waitFor(() => {
      expect(updateWikiSection).toHaveBeenCalledWith('wiki-1', { order: 1 });
      expect(updateWikiSection).toHaveBeenCalledWith('wiki-2', { order: 0 });
    });
  });

  it('clicking an internal link fires onNavigate and closes the dialog', async () => {
    seedSections([SECTION_2]);
    const { onNavigate, onClose } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Fushimi Inari' }));

    expect(onClose).toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith('checkpoint', 'cp-1');
  });

  it('clicking a budget link fires onNavigate with kind "budget"', () => {
    seedSections([SECTION_3]);
    const { onNavigate } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Backpacker' }));

    expect(onNavigate).toHaveBeenCalledWith('budget', 'budget-1');
  });

  it('clicking a budget item link fires onNavigate with kind "budget_item"', () => {
    seedSections([SECTION_3]);
    const { onNavigate } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Ryokan' }));

    expect(onNavigate).toHaveBeenCalledWith('budget_item', 'item-1');
  });

  it('includes budgets and budget items in the link picker linkables', async () => {
    useTripStore.setState({
      budgets: [
        {
          id: 'budget-1',
          name: 'Backpacker',
          currency: 'JPY',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      budgetItems: [
        {
          id: 'item-1',
          budgetSectionId: 'section-1',
          name: 'Ryokan',
          rateType: 'constant',
          quantity: 1,
          order: 0,
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    setup();

    fireEvent.click(screen.getByRole('button', { name: '+ Add section' }));
    fireEvent.click(screen.getByRole('button', { name: 'Insert link to trip item' }));
    const input = await screen.findByRole('combobox', { name: 'Link to...' });
    fireEvent.change(input, { target: { value: 'Ryokan' } });

    expect(await screen.findByRole('option', { name: 'Ryokan' })).toBeInTheDocument();
  });

  it('does not show an expand/collapse toggle for a short section', () => {
    seedSections([SECTION_1]);
    setup();
    expect(screen.queryByRole('button', { name: /expand overview/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /show more/i })).toBeNull();
  });

  it('starts a long section collapsed, with a toggle to expand and collapse it again', () => {
    seedSections([LONG_SECTION]);
    setup();

    expect(screen.getByRole('button', { name: 'Expand Full Itinerary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(screen.getByRole('button', { name: 'Collapse Full Itinerary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.getByRole('button', { name: 'Expand Full Itinerary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
  });
});
