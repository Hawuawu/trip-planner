import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/helpers';
import { AlternativesShelf } from './AlternativesShelf';
import { useTripStore } from '../../store/tripStore';
import { LocalTripRepository } from '../../data/localTripRepository';

const SEED_ALTS = [
  {
    id: 'a1',
    type: 'poi' as const,
    name: 'teamLab Borderless',
    notes: 'Azabudai Hills',
    location: { lat: 35.6591, lng: 139.7138, label: 'Azabudai Hills, Tokyo' },
  },
  {
    id: 'a2',
    type: 'hotel' as const,
    name: 'Park Hyatt Tokyo',
    location: { lat: 35.6878, lng: 139.6922, label: 'Shinjuku, Tokyo' },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  // Reset data slices in merge mode to preserve action functions
  useTripStore.setState({
    trip: null,
    checkpoints: [],
    alternatives: [],
    selectedId: null,
    undoCheckpoint: null,
    undoAlternative: null,
    repo: null,
    tripId: null,
  });
  const repo = new LocalTripRepository();
  useTripStore.getState().init('demo', repo);
  // init() synchronously delivers LocalTripRepository's seeded alternatives —
  // force back to empty so each test controls its own starting state.
  useTripStore.setState({ alternatives: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AlternativesShelf', () => {
  // ── Button presence ──────────────────────────────────────────────────────

  it('shows exactly one "Add alternative" button when empty, centered in the panel', () => {
    useTripStore.setState({ alternatives: [] });
    renderWithProviders(<AlternativesShelf />);
    expect(screen.getAllByRole('button', { name: /add alternative/i })).toHaveLength(1);
  });

  it('hides the "Add alternative" button once there are alternatives', () => {
    useTripStore.setState({ alternatives: SEED_ALTS });
    renderWithProviders(<AlternativesShelf />);
    expect(screen.queryByRole('button', { name: /add alternative/i })).not.toBeInTheDocument();
  });

  // ── Add drawer open / close ──────────────────────────────────────────────

  it('opens the add form when "Add alternative" is clicked', async () => {
    renderWithProviders(<AlternativesShelf />);
    await userEvent.click(screen.getByRole('button', { name: /add alternative/i }));
    expect(screen.getByRole('heading', { name: /add alternative/i })).toBeInTheDocument();
  });

  it('opens the add form when openAddSignal changes externally (e.g. from the menu)', () => {
    useTripStore.setState({ alternatives: SEED_ALTS });
    renderWithProviders(<AlternativesShelf openAddSignal={1} />);
    expect(screen.getByRole('heading', { name: /add alternative/i })).toBeInTheDocument();
  });

  it('closes the form when Cancel is clicked without calling addAlternative', async () => {
    renderWithProviders(<AlternativesShelf />);
    const spy = vi.spyOn(useTripStore.getState(), 'addAlternative');

    await userEvent.click(screen.getByRole('button', { name: /add alternative/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(spy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /add alternative/i })).not.toBeInTheDocument();
    });
  });

  // ── Submit validation ────────────────────────────────────────────────────

  it('does not call addAlternative when submitting with an empty name', async () => {
    renderWithProviders(<AlternativesShelf />);
    const spy = vi.spyOn(useTripStore.getState(), 'addAlternative');

    await userEvent.click(screen.getByRole('button', { name: /add alternative/i }));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(spy).not.toHaveBeenCalled();
  });

  // ── Valid submit ─────────────────────────────────────────────────────────

  it('calls addAlternative with at least { name, type } on valid submit', async () => {
    renderWithProviders(<AlternativesShelf />);
    const spy = vi.spyOn(useTripStore.getState(), 'addAlternative');

    await userEvent.click(screen.getByRole('button', { name: /add alternative/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /name/i }), 'Test Place');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test Place', type: 'poi' }));
  });

  it('closes the form after a successful submit', async () => {
    renderWithProviders(<AlternativesShelf />);

    await userEvent.click(screen.getByRole('button', { name: /add alternative/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /name/i }), 'Test Place');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /add alternative/i })).not.toBeInTheDocument();
    });
  });

  it('includes location when lat and lng are provided', async () => {
    renderWithProviders(<AlternativesShelf />);
    const spy = vi.spyOn(useTripStore.getState(), 'addAlternative');

    await userEvent.click(screen.getByRole('button', { name: /add alternative/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /name/i }), 'Senso-ji');
    await userEvent.type(
      screen.getByRole('textbox', { name: /location label/i }),
      'Asakusa, Tokyo'
    );
    await userEvent.type(screen.getByRole('spinbutton', { name: /lat/i }), '35.7148');
    await userEvent.type(screen.getByRole('spinbutton', { name: /lng/i }), '139.7967');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Senso-ji',
        location: expect.objectContaining({ lat: 35.7148, lng: 139.7967, label: 'Asakusa, Tokyo' }),
      })
    );
  });

  it('omits location when lat/lng are not provided', async () => {
    renderWithProviders(<AlternativesShelf />);
    const spy = vi.spyOn(useTripStore.getState(), 'addAlternative');

    await userEvent.click(screen.getByRole('button', { name: /add alternative/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /name/i }), 'No Location');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'No Location', location: undefined })
    );
  });

  // ── Edit via clicking a card ─────────────────────────────────────────────

  it('opens the edit form with prefilled values when an alternative card is clicked', async () => {
    useTripStore.setState({ alternatives: SEED_ALTS });
    renderWithProviders(<AlternativesShelf />);

    await userEvent.click(screen.getByText('teamLab Borderless'));

    expect(screen.getByRole('heading', { name: /edit alternative/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('teamLab Borderless');
  });

  it('calls updateAlternative with edited values on save', async () => {
    useTripStore.setState({ alternatives: SEED_ALTS });
    const spy = vi.spyOn(useTripStore.getState(), 'updateAlternative');
    renderWithProviders(<AlternativesShelf />);

    await userEvent.click(screen.getByText('teamLab Borderless'));
    const nameInput = screen.getByRole('textbox', { name: /name/i });
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'teamLab Planets');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(spy).toHaveBeenCalledWith('a1', expect.objectContaining({ name: 'teamLab Planets' }));
  });

  // ── Alternatives list ────────────────────────────────────────────────────

  it('renders existing alternatives from the store', () => {
    useTripStore.setState({ alternatives: SEED_ALTS });
    renderWithProviders(<AlternativesShelf />);
    expect(screen.getByText('teamLab Borderless')).toBeInTheDocument();
    expect(screen.getByText('Park Hyatt Tokyo')).toBeInTheDocument();
  });

  it('shows empty-state text when there are no alternatives', () => {
    useTripStore.setState({ alternatives: [] });
    renderWithProviders(<AlternativesShelf />);
    expect(screen.getByText(/no alternatives yet/i)).toBeInTheDocument();
  });

  // ── Search filter ────────────────────────────────────────────────────────

  it('filters the alternatives list by the search input', async () => {
    useTripStore.setState({ alternatives: SEED_ALTS });
    renderWithProviders(<AlternativesShelf />);

    await userEvent.type(screen.getByPlaceholderText(/search alternatives/i), 'Park Hyatt');

    expect(screen.getByText('Park Hyatt Tokyo')).toBeInTheDocument();
    expect(screen.queryByText('teamLab Borderless')).not.toBeInTheDocument();
  });

  it('shows a no-match message when the search filters out everything', async () => {
    useTripStore.setState({ alternatives: SEED_ALTS });
    renderWithProviders(<AlternativesShelf />);

    await userEvent.type(screen.getByPlaceholderText(/search alternatives/i), 'Nonexistent Place');

    expect(screen.queryByText('Park Hyatt Tokyo')).not.toBeInTheDocument();
    expect(screen.queryByText('teamLab Borderless')).not.toBeInTheDocument();
    expect(screen.getByText(/no alternatives match/i)).toBeInTheDocument();
  });

  // ── Delete with confirmation + undo ──────────────────────────────────────

  it('opens a confirmation dialog and calls deleteAlternative once confirmed', async () => {
    useTripStore.setState({ alternatives: SEED_ALTS });
    // Mock deleteAlternative to avoid hitting localStorage
    const spy = vi.spyOn(useTripStore.getState(), 'deleteAlternative').mockResolvedValue();
    renderWithProviders(<AlternativesShelf />);

    const deleteBtns = screen
      .getAllByTestId('DeleteOutlineIcon')
      .map((icon) => icon.closest('button')!);
    await userEvent.click(deleteBtns[0]);

    expect(spy).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(spy).toHaveBeenCalledWith('a1');
  });

  it('does not call deleteAlternative when the confirmation dialog is cancelled', async () => {
    useTripStore.setState({ alternatives: SEED_ALTS });
    const spy = vi.spyOn(useTripStore.getState(), 'deleteAlternative').mockResolvedValue();
    renderWithProviders(<AlternativesShelf />);

    const deleteBtns = screen
      .getAllByTestId('DeleteOutlineIcon')
      .map((icon) => icon.closest('button')!);
    await userEvent.click(deleteBtns[0]);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(spy).not.toHaveBeenCalled();
  });

  it('shows an undo snackbar after deleting an alternative', async () => {
    useTripStore.setState({ alternatives: SEED_ALTS, undoAlternative: SEED_ALTS[0] });
    renderWithProviders(<AlternativesShelf />);
    await waitFor(() => {
      expect(screen.getByText(/deleted "teamLab Borderless"/i)).toBeInTheDocument();
    });
  });

  it('calls undoDeleteAlternative when UNDO is clicked in the snackbar', async () => {
    useTripStore.setState({ alternatives: SEED_ALTS, undoAlternative: SEED_ALTS[0] });
    const spy = vi.spyOn(useTripStore.getState(), 'undoDeleteAlternative').mockResolvedValue();
    renderWithProviders(<AlternativesShelf />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  // ── Promote dialog ───────────────────────────────────────────────────────

  it('opens the promote dialog when "Add to timeline" icon is clicked', async () => {
    useTripStore.setState({ alternatives: SEED_ALTS });
    renderWithProviders(<AlternativesShelf />);

    const promoteBtns = screen.getAllByTitle('Add to timeline');
    await userEvent.click(promoteBtns[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Dialog title includes the alternative name
    expect(screen.getByRole('heading')).toHaveTextContent(/teamLab Borderless/i);
  });

  it('calls promoteAlternative with the entered start time', async () => {
    useTripStore.setState({ alternatives: SEED_ALTS });
    const spy = vi.spyOn(useTripStore.getState(), 'promoteAlternative').mockResolvedValue();
    renderWithProviders(<AlternativesShelf />);

    await userEvent.click(screen.getAllByTitle('Add to timeline')[0]);
    const timeInput = screen.getByLabelText(/start time/i);
    fireEvent.change(timeInput, { target: { value: '2026-10-07T10:00' } });
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(spy).toHaveBeenCalledWith('a1', expect.any(String));
  });

  it('cancels the promote dialog without calling promoteAlternative', async () => {
    useTripStore.setState({ alternatives: SEED_ALTS });
    const spy = vi.spyOn(useTripStore.getState(), 'promoteAlternative').mockResolvedValue();
    renderWithProviders(<AlternativesShelf />);

    await userEvent.click(screen.getAllByTitle('Add to timeline')[0]);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(spy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
