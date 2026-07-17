import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlternativesShelf } from '../components/alternatives/AlternativesShelf';
import { renderWithProviders, resetStores } from './helpers';
import { useTripStore } from '../store/tripStore';
import type { Alternative } from '../types';

const ALT1: Alternative = {
  id: 'a1',
  type: 'poi',
  name: 'teamLab Borderless',
  notes: 'Azabudai Hills',
};
const ALT2: Alternative = {
  id: 'a2',
  type: 'train',
  name: 'Nishiki Market',
  location: { lat: 35.005, lng: 135.765, label: 'Nishiki, Kyoto' },
};

beforeEach(() => {
  resetStores();
});

function seedAlternatives(alts: Alternative[]) {
  useTripStore.setState({ alternatives: alts });
}

describe('AlternativesShelf', () => {
  it('renders the section heading', () => {
    renderWithProviders(<AlternativesShelf />);
    expect(screen.getByText('Alternatives')).toBeInTheDocument();
  });

  it('shows an empty-state message when there are no alternatives', () => {
    renderWithProviders(<AlternativesShelf />);
    expect(screen.getByText(/no alternatives saved/i)).toBeInTheDocument();
  });

  it('renders each alternative by name', () => {
    seedAlternatives([ALT1, ALT2]);
    renderWithProviders(<AlternativesShelf />);
    expect(screen.getByText('teamLab Borderless')).toBeInTheDocument();
    expect(screen.getByText('Nishiki Market')).toBeInTheDocument();
  });

  it('renders the location label as secondary text when available', () => {
    seedAlternatives([ALT2]);
    renderWithProviders(<AlternativesShelf />);
    expect(screen.getByText('Nishiki, Kyoto')).toBeInTheDocument();
  });

  it('renders the notes as secondary text when there is no location label', () => {
    seedAlternatives([ALT1]);
    renderWithProviders(<AlternativesShelf />);
    expect(screen.getByText('Azabudai Hills')).toBeInTheDocument();
  });

  it('renders an svg icon for each alternative type', () => {
    seedAlternatives([ALT1, ALT2]);
    const { container } = renderWithProviders(<AlternativesShelf />);
    const svgs = container.querySelectorAll('svg');
    // At least one icon per alternative
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it('calls deleteAlternative when delete button is clicked', async () => {
    seedAlternatives([ALT1]);
    // Spy on the real store action rather than replacing it via setState
    const spy = vi.spyOn(useTripStore.getState(), 'deleteAlternative').mockResolvedValue();

    renderWithProviders(<AlternativesShelf />);

    // There are two icon buttons per item: promote and delete.
    // The delete button has no title; the promote button has title "Add to timeline".
    const iconButtons = screen.getAllByRole('button');
    const deleteBtn = iconButtons.find((b) => !b.getAttribute('title'));
    expect(deleteBtn).toBeTruthy();
    fireEvent.click(deleteBtn!);
    expect(spy).toHaveBeenCalledWith('a1');
    spy.mockRestore();
  });

  it('opens the promote dialog when the add-to-timeline button is clicked', async () => {
    seedAlternatives([ALT1]);
    renderWithProviders(<AlternativesShelf />);

    const promoteBtn = screen.getByTitle('Add to timeline');
    fireEvent.click(promoteBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/add "teamLab Borderless" to timeline/i)).toBeInTheDocument();
  });

  it('closes the promote dialog when Cancel is clicked', async () => {
    const user = userEvent.setup();
    seedAlternatives([ALT1]);
    renderWithProviders(<AlternativesShelf />);

    fireEvent.click(screen.getByTitle('Add to timeline'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('the Add button in the promote dialog is disabled until a time is entered', async () => {
    seedAlternatives([ALT1]);
    renderWithProviders(<AlternativesShelf />);

    fireEvent.click(screen.getByTitle('Add to timeline'));

    const addBtn = screen.getByRole('button', { name: /^add$/i });
    expect(addBtn).toBeDisabled();
  });

  it('calls promoteAlternative with an ISO string when Add is confirmed', async () => {
    seedAlternatives([ALT1]);
    const spy = vi.spyOn(useTripStore.getState(), 'promoteAlternative').mockResolvedValue();

    renderWithProviders(<AlternativesShelf />);

    fireEvent.click(screen.getByTitle('Add to timeline'));

    const datetimeInput = document.querySelector(
      'input[type="datetime-local"]'
    ) as HTMLInputElement;
    fireEvent.change(datetimeInput, { target: { value: '2026-10-06T10:00' } });

    const addBtn = screen.getByRole('button', { name: /^add$/i });
    expect(addBtn).not.toBeDisabled();
    fireEvent.click(addBtn);

    expect(spy).toHaveBeenCalledTimes(1);
    const [id, isoTime] = spy.mock.calls[0];
    expect(id).toBe('a1');
    expect(typeof isoTime).toBe('string');
    expect(isoTime.length).toBeGreaterThan(0);
    spy.mockRestore();
  });
});
