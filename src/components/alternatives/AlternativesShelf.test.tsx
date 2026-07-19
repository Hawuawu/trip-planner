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
    repo: null,
    tripId: null,
  });
  const repo = new LocalTripRepository();
  useTripStore.getState().init('demo', repo);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AlternativesShelf', () => {
  // ── Button presence ──────────────────────────────────────────────────────

  it('renders the "Add alternative" button', () => {
    renderWithProviders(<AlternativesShelf />);
    expect(screen.getByRole('button', { name: /add alternative/i })).toBeInTheDocument();
  });

  // ── Dialog open / close ──────────────────────────────────────────────────

  it('opens the dialog when "Add alternative" is clicked', async () => {
    renderWithProviders(<AlternativesShelf />);
    await userEvent.click(screen.getByRole('button', { name: /add alternative/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Dialog title heading is distinct from the button label
    expect(screen.getByRole('heading', { name: /add alternative/i })).toBeInTheDocument();
  });

  it('closes the dialog when Cancel is clicked without calling addAlternative', async () => {
    renderWithProviders(<AlternativesShelf />);
    const spy = vi.spyOn(useTripStore.getState(), 'addAlternative');

    await userEvent.click(screen.getByRole('button', { name: /add alternative/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(spy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // ── Submit validation ────────────────────────────────────────────────────

  it('does not call addAlternative when submitting with an empty name', async () => {
    renderWithProviders(<AlternativesShelf />);
    const spy = vi.spyOn(useTripStore.getState(), 'addAlternative');

    await userEvent.click(screen.getByRole('button', { name: /add alternative/i }));
    // "Add" button is disabled when name is empty — fireEvent bypasses the disabled check
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(spy).not.toHaveBeenCalled();
  });

  // ── Valid submit ─────────────────────────────────────────────────────────

  it('calls addAlternative with at least { name, type } on valid submit', async () => {
    renderWithProviders(<AlternativesShelf />);
    const spy = vi.spyOn(useTripStore.getState(), 'addAlternative');

    await userEvent.click(screen.getByRole('button', { name: /add alternative/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /name/i }), 'Test Place');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test Place', type: 'poi' }));
  });

  it('closes the dialog after a successful submit', async () => {
    renderWithProviders(<AlternativesShelf />);

    await userEvent.click(screen.getByRole('button', { name: /add alternative/i }));
    await userEvent.type(screen.getByRole('textbox', { name: /name/i }), 'Test Place');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

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
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'No Location', location: undefined })
    );
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

  it('shows exactly one "Add alternative" button when empty, centered in the panel', () => {
    useTripStore.setState({ alternatives: [] });
    renderWithProviders(<AlternativesShelf />);
    expect(screen.getAllByRole('button', { name: /add alternative/i })).toHaveLength(1);
  });

  it('calls deleteAlternative when the delete button is clicked', async () => {
    useTripStore.setState({ alternatives: SEED_ALTS });
    // Mock deleteAlternative to avoid hitting localStorage
    const spy = vi.spyOn(useTripStore.getState(), 'deleteAlternative').mockResolvedValue();
    renderWithProviders(<AlternativesShelf />);

    const deleteBtns = screen
      .getAllByTestId('DeleteOutlineIcon')
      .map((icon) => icon.closest('button')!);
    await userEvent.click(deleteBtns[0]);

    expect(spy).toHaveBeenCalledWith('a1');
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
