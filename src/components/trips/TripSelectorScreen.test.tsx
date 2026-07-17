import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TripSelectorScreen } from './TripSelectorScreen';
import { renderWithProviders } from '../../test/helpers';
import type { TripRepository } from '../../data/TripRepository';
import type { Trip } from '../../types';

// ── localStorage mock ─────────────────────────────────────────────────────────

function makeLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
}

let storageMock: ReturnType<typeof makeLocalStorageMock>;

beforeEach(() => {
  storageMock = makeLocalStorageMock();
  vi.stubGlobal('localStorage', storageMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Mock repo factory ─────────────────────────────────────────────────────────

const TRIP_A: Trip = { id: 'trip-1', name: 'Japan 2026', dateRange: { start: '2026-10-01', end: '2026-10-14' }, memberIds: [] };
const TRIP_B: Trip = { id: 'trip-2', name: 'Korea 2027', dateRange: { start: '2027-05-01', end: '2027-05-10' }, memberIds: [] };

function makeRepo(overrides: Partial<TripRepository> = {}): TripRepository {
  return {
    getTrip: vi.fn().mockResolvedValue(TRIP_A),
    listTrips: vi.fn().mockResolvedValue([TRIP_A, TRIP_B]),
    createTrip: vi.fn().mockResolvedValue({ id: 'trip-new', name: 'New Trip', dateRange: { start: '2027-01-01', end: '2027-01-10' }, memberIds: [] }),
    subscribeToCheckpoints: vi.fn().mockReturnValue(() => {}),
    addCheckpoint: vi.fn(),
    updateCheckpoint: vi.fn(),
    deleteCheckpoint: vi.fn(),
    subscribeToAlternatives: vi.fn().mockReturnValue(() => {}),
    addAlternative: vi.fn(),
    deleteAlternative: vi.fn(),
    promoteAlternative: vi.fn(),
    ...overrides,
  } as TripRepository;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TripSelectorScreen — trip list', () => {
  it('renders a list of trips returned by repo.listTrips', async () => {
    const repo = makeRepo();
    const onSelect = vi.fn();
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Japan 2026')).toBeInTheDocument();
      expect(screen.getByText('Korea 2027')).toBeInTheDocument();
    });
  });

  it('clicking a trip calls onSelect with the trip id and saves to localStorage', async () => {
    const user = userEvent.setup();
    const repo = makeRepo();
    const onSelect = vi.fn();
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={onSelect} />);

    await waitFor(() => screen.getByText('Japan 2026'));
    await user.click(screen.getByText('Japan 2026'));

    expect(onSelect).toHaveBeenCalledWith('trip-1');
    expect(storageMock.getItem('trip-planner:activeTripId')).toBe('trip-1');
  });
});

describe('TripSelectorScreen — new trip dialog', () => {
  it('"New trip" button opens the form dialog', async () => {
    const user = userEvent.setup();
    const repo = makeRepo();
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('New trip'));
    await user.click(screen.getByText('New trip'));

    expect(screen.getByText('Create a new trip')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /trip name/i })).toBeInTheDocument();
  });

  it('submitting with empty name does not call onSelect', async () => {
    const user = userEvent.setup();
    const repo = makeRepo();
    const onSelect = vi.fn();
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={onSelect} />);

    await waitFor(() => screen.getByText('New trip'));
    await user.click(screen.getByText('New trip'));
    // Do not fill name, click Create
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(repo.createTrip).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    // Validation error shown
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });

  it('submitting with end date before start date does not call onSelect', async () => {
    const user = userEvent.setup();
    const repo = makeRepo();
    const onSelect = vi.fn();
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={onSelect} />);

    await waitFor(() => screen.getByText('New trip'));
    await user.click(screen.getByText('New trip'));

    await user.type(screen.getByRole('textbox', { name: /trip name/i }), 'My Trip');

    // Set start date to 2027-06-10 and end to 2027-06-01 (before start)
    const startInput = screen.getByLabelText(/start date/i);
    const endInput = screen.getByLabelText(/end date/i);
    await user.type(startInput, '2027-06-10');
    await user.type(endInput, '2027-06-01');

    await user.click(screen.getByRole('button', { name: /^create$/i }));

    expect(repo.createTrip).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText(/end date must be on or after start date/i)).toBeInTheDocument();
  });

  it('submitting a valid form calls repo.createTrip and then onSelect', async () => {
    const user = userEvent.setup();
    const newTrip: Trip = { id: 'trip-new', name: 'My New Trip', dateRange: { start: '2027-01-01', end: '2027-01-10' }, memberIds: [] };
    const repo = makeRepo({ createTrip: vi.fn().mockResolvedValue(newTrip) });
    const onSelect = vi.fn();
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={onSelect} />);

    await waitFor(() => screen.getByText('New trip'));
    await user.click(screen.getByText('New trip'));

    await user.type(screen.getByRole('textbox', { name: /trip name/i }), 'My New Trip');

    const startInput = screen.getByLabelText(/start date/i);
    const endInput = screen.getByLabelText(/end date/i);
    await user.type(startInput, '2027-01-01');
    await user.type(endInput, '2027-01-10');

    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(repo.createTrip).toHaveBeenCalledWith('My New Trip', {
        start: '2027-01-01',
        end: '2027-01-10',
      });
      expect(onSelect).toHaveBeenCalledWith('trip-new');
    });
  });
});
