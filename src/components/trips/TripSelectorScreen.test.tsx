import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TripSelectorScreen } from './TripSelectorScreen';
import { renderWithProviders, resetStores } from '../../test/helpers';
import { useAuthStore } from '../../store/authStore';
import type { TripRepository } from '../../data/TripRepository';
import type { Trip, Checkpoint, Alternative } from '../../types';
import type { AuthService } from '../../data/AuthService';
import { downloadTextFile } from '../../utils/fileTransfer';

vi.mock('../../utils/fileTransfer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/fileTransfer')>();
  return { ...actual, downloadTextFile: vi.fn() };
});

// ── localStorage mock ─────────────────────────────────────────────────────────

function makeLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };
}

let storageMock: ReturnType<typeof makeLocalStorageMock>;

beforeEach(() => {
  storageMock = makeLocalStorageMock();
  vi.stubGlobal('localStorage', storageMock);
  resetStores();
  vi.mocked(downloadTextFile).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.querySelectorAll('input[type="file"]').forEach((el) => el.remove());
});

// ── Mock repo factory ─────────────────────────────────────────────────────────

const TRIP_A: Trip = {
  id: 'trip-1',
  name: 'Japan 2026',
  dateRange: { start: '2026-10-01', end: '2026-10-14' },
  memberIds: [],
};
const TRIP_B: Trip = {
  id: 'trip-2',
  name: 'Korea 2027',
  dateRange: { start: '2027-05-01', end: '2027-05-10' },
  memberIds: [],
};

function makeRepo(overrides: Partial<TripRepository> = {}): TripRepository {
  return {
    getTrip: vi.fn().mockResolvedValue(TRIP_A),
    listTrips: vi.fn().mockResolvedValue([TRIP_A, TRIP_B]),
    createTrip: vi.fn().mockResolvedValue({
      id: 'trip-new',
      name: 'New Trip',
      dateRange: { start: '2027-01-01', end: '2027-01-10' },
      memberIds: [],
    }),
    updateTrip: vi.fn().mockResolvedValue(undefined),
    deleteTrip: vi.fn().mockResolvedValue(undefined),
    subscribeToCheckpoints: vi.fn().mockReturnValue(() => {}),
    addCheckpoint: vi.fn(),
    addCheckpoints: vi.fn().mockResolvedValue([]),
    updateCheckpoint: vi.fn(),
    deleteCheckpoint: vi.fn(),
    subscribeToAlternatives: vi.fn().mockReturnValue(() => {}),
    addAlternative: vi.fn(),
    addAlternatives: vi.fn().mockResolvedValue([]),
    deleteAlternative: vi.fn(),
    promoteAlternative: vi.fn(),
    ...overrides,
  } as TripRepository;
}

async function uploadYamlFile(content: string, fileName = 'trip.yaml') {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /choose yaml file/i }));

  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([content], fileName, { type: 'text/yaml' });
  Object.defineProperty(input, 'files', { value: [file] });
  input.dispatchEvent(new Event('change'));
  // readUploadedFileText/FileReader resolves asynchronously
  await new Promise((r) => setTimeout(r, 0));
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
    const newTrip: Trip = {
      id: 'trip-new',
      name: 'My New Trip',
      dateRange: { start: '2027-01-01', end: '2027-01-10' },
      memberIds: [],
    };
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

describe('TripSelectorScreen — owner-gated rename/delete visibility', () => {
  it('shows rename/delete icons for a trip with no ownerId (legacy trip)', async () => {
    const repo = makeRepo({ listTrips: vi.fn().mockResolvedValue([TRIP_A]) });
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Japan 2026'));
    expect(screen.getByLabelText('Rename Japan 2026')).toBeInTheDocument();
    expect(screen.getByLabelText('Delete Japan 2026')).toBeInTheDocument();
  });

  it('shows rename/delete icons when the current user owns the trip', async () => {
    useAuthStore.setState({ user: { uid: 'owner-1', email: null, displayName: null } });
    const owned: Trip = { ...TRIP_A, ownerId: 'owner-1' };
    const repo = makeRepo({ listTrips: vi.fn().mockResolvedValue([owned]) });
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Japan 2026'));
    expect(screen.getByLabelText('Rename Japan 2026')).toBeInTheDocument();
  });

  it('hides rename/delete icons when the current user does not own the trip', async () => {
    useAuthStore.setState({ user: { uid: 'someone-else', email: null, displayName: null } });
    const owned: Trip = { ...TRIP_A, ownerId: 'owner-1' };
    const repo = makeRepo({ listTrips: vi.fn().mockResolvedValue([owned]) });
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Japan 2026'));
    expect(screen.queryByLabelText('Rename Japan 2026')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Delete Japan 2026')).not.toBeInTheDocument();
  });

  it('still shows the export icon when the current user does not own the trip', async () => {
    useAuthStore.setState({ user: { uid: 'someone-else', email: null, displayName: null } });
    const owned: Trip = { ...TRIP_A, ownerId: 'owner-1' };
    const repo = makeRepo({ listTrips: vi.fn().mockResolvedValue([owned]) });
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Japan 2026'));
    expect(screen.getByLabelText('Export Japan 2026')).toBeInTheDocument();
  });
});

describe('TripSelectorScreen — rename dialog', () => {
  it('opens pre-filled with the trip name and saves via repo.updateTrip', async () => {
    const user = userEvent.setup();
    const repo = makeRepo({ listTrips: vi.fn().mockResolvedValue([TRIP_A]) });
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Japan 2026'));
    await user.click(screen.getByLabelText('Rename Japan 2026'));

    expect(screen.getByText('Rename trip')).toBeInTheDocument();
    const nameInput = screen.getByRole('textbox', { name: /rename trip name/i });
    expect(nameInput).toHaveValue('Japan 2026');

    await user.clear(nameInput);
    await user.type(nameInput, 'Japan Autumn 2026');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(repo.updateTrip).toHaveBeenCalledWith('trip-1', {
        name: 'Japan Autumn 2026',
        dateRange: { start: '2026-10-01', end: '2026-10-14' },
      });
    });
    expect(screen.getByText('Japan Autumn 2026')).toBeInTheDocument();
  });

  it('does not save when the name is cleared', async () => {
    const user = userEvent.setup();
    const repo = makeRepo({ listTrips: vi.fn().mockResolvedValue([TRIP_A]) });
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Japan 2026'));
    await user.click(screen.getByLabelText('Rename Japan 2026'));
    await user.clear(screen.getByRole('textbox', { name: /rename trip name/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(repo.updateTrip).not.toHaveBeenCalled();
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });
});

describe('TripSelectorScreen — delete dialog', () => {
  it('asks for confirmation and calls repo.deleteTrip on confirm', async () => {
    const user = userEvent.setup();
    const repo = makeRepo({ listTrips: vi.fn().mockResolvedValue([TRIP_A, TRIP_B]) });
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Japan 2026'));
    await user.click(screen.getByLabelText('Delete Japan 2026'));

    expect(screen.getByText('Delete trip')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(repo.deleteTrip).toHaveBeenCalledWith('trip-1');
      expect(screen.queryByText('Japan 2026')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Korea 2027')).toBeInTheDocument();
  });

  it('cancelling does not call repo.deleteTrip', async () => {
    const user = userEvent.setup();
    const repo = makeRepo({ listTrips: vi.fn().mockResolvedValue([TRIP_A]) });
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Japan 2026'));
    await user.click(screen.getByLabelText('Delete Japan 2026'));
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(repo.deleteTrip).not.toHaveBeenCalled();
    expect(screen.getByText('Japan 2026')).toBeInTheDocument();
  });
});

describe('TripSelectorScreen — export trip', () => {
  const CHECKPOINTS: Checkpoint[] = [
    {
      id: 'cp-1',
      type: 'poi',
      name: 'Nara Deer Park',
      startTime: '2026-10-09T09:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  const ALTERNATIVES: Alternative[] = [{ id: 'alt-1', type: 'poi', name: 'Todai-ji Temple' }];

  it('fetches checkpoints/alternatives once and downloads a serialized YAML file', async () => {
    const user = userEvent.setup();
    const repo = makeRepo({
      listTrips: vi.fn().mockResolvedValue([TRIP_A]),
      subscribeToCheckpoints: vi.fn((_tripId, cb) => {
        cb(CHECKPOINTS);
        return vi.fn();
      }),
      subscribeToAlternatives: vi.fn((_tripId, cb) => {
        cb(ALTERNATIVES);
        return vi.fn();
      }),
    });
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Japan 2026'));
    await user.click(screen.getByLabelText('Export Japan 2026'));

    await waitFor(() => {
      expect(downloadTextFile).toHaveBeenCalledTimes(1);
    });
    const [filename, yamlText] = vi.mocked(downloadTextFile).mock.calls[0];
    expect(filename).toBe('japan-2026.yaml');
    expect(yamlText).toContain('Japan 2026');
    expect(yamlText).toContain('Nara Deer Park');
    expect(yamlText).toContain('Todai-ji Temple');
  });
});

describe('TripSelectorScreen — import trip', () => {
  it('"Import trip" button opens the import dialog', async () => {
    const user = userEvent.setup();
    const repo = makeRepo();
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Import trip'));
    await user.click(screen.getByText('Import trip'));

    expect(screen.getByText('Import trip', { selector: 'h2' })).toBeInTheDocument();
  });

  it('creates a new trip, batch-adds items, and selects it on a valid import', async () => {
    const user = userEvent.setup();
    const newTrip: Trip = {
      id: 'trip-imported',
      name: 'Imported Trip',
      dateRange: { start: '2026-11-01', end: '2026-11-05' },
      memberIds: [],
    };
    const repo = makeRepo({ createTrip: vi.fn().mockResolvedValue(newTrip) });
    const onSelect = vi.fn();
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={onSelect} />);

    await waitFor(() => screen.getByText('Import trip'));
    await user.click(screen.getByText('Import trip'));

    const yaml = `
name: Imported Trip
dateRange:
  start: "2026-11-01"
  end: "2026-11-05"
checkpoints:
  - type: poi
    name: Nara Deer Park
    startTime: "2026-11-02T09:00:00.000Z"
alternatives:
  - type: poi
    name: Todai-ji Temple
`;
    await uploadYamlFile(yaml);
    await waitFor(() => screen.getByRole('button', { name: /^import$/i }));
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => {
      expect(repo.createTrip).toHaveBeenCalledWith('Imported Trip', {
        start: '2026-11-01',
        end: '2026-11-05',
      });
      expect(repo.addCheckpoints).toHaveBeenCalledWith(
        'trip-imported',
        expect.arrayContaining([expect.objectContaining({ name: 'Nara Deer Park' })])
      );
      expect(repo.addAlternatives).toHaveBeenCalledWith(
        'trip-imported',
        expect.arrayContaining([expect.objectContaining({ name: 'Todai-ji Temple' })])
      );
      expect(onSelect).toHaveBeenCalledWith('trip-imported');
    });
    expect(storageMock.getItem('trip-planner:activeTripId')).toBe('trip-imported');
  });

  it('deletes the orphaned trip and does not select it when the batch add fails', async () => {
    const user = userEvent.setup();
    const newTrip: Trip = {
      id: 'trip-orphan',
      name: 'Orphan Trip',
      dateRange: { start: '2026-11-01', end: '2026-11-05' },
      memberIds: [],
    };
    const repo = makeRepo({
      createTrip: vi.fn().mockResolvedValue(newTrip),
      addCheckpoints: vi.fn().mockRejectedValue(new Error('network error')),
    });
    const onSelect = vi.fn();
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={onSelect} />);

    await waitFor(() => screen.getByText('Import trip'));
    await user.click(screen.getByText('Import trip'));

    const yaml = `
name: Orphan Trip
dateRange:
  start: "2026-11-01"
  end: "2026-11-05"
checkpoints:
  - type: poi
    name: Nara Deer Park
    startTime: "2026-11-02T09:00:00.000Z"
`;
    await uploadYamlFile(yaml);
    await waitFor(() => screen.getByRole('button', { name: /^import$/i }));
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => {
      expect(repo.deleteTrip).toHaveBeenCalledWith('trip-orphan');
    });
    expect(onSelect).not.toHaveBeenCalled();
    expect(storageMock.getItem('trip-planner:activeTripId')).toBeNull();
    expect(screen.getByText('network error')).toBeInTheDocument();
  });

  it('shows the validation error list and does not call repo.createTrip for an invalid file', async () => {
    const user = userEvent.setup();
    const repo = makeRepo();
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Import trip'));
    await user.click(screen.getByText('Import trip'));

    await uploadYamlFile('name: Missing dateRange\n');

    await waitFor(() => {
      expect(screen.getByText(/1 validation error/i)).toBeInTheDocument();
    });
    expect(repo.createTrip).not.toHaveBeenCalled();
  });
});

const fakeAuthService: AuthService = {
  getCurrentUser: () => null,
  onAuthStateChanged: () => () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshAccess: async () => null,
  approveAccess: async () => {},
  denyAccess: async () => {},
  revokeAccess: async () => {},
  subscribeToAllowedUsers: () => () => {},
  subscribeToAccessRequests: () => () => {},
  subscribeToAppActivity: () => () => {},
};

describe('TripSelectorScreen — sign out', () => {
  it('hides the sign-out button in local mode (no auth service)', async () => {
    const repo = makeRepo();
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Japan 2026'));
    expect(screen.queryByTitle('Sign out')).not.toBeInTheDocument();
  });

  it('shows a labeled Logout button and calls signOut when a service is present', async () => {
    const signOut = vi.fn();
    useAuthStore.setState({ service: fakeAuthService, signOut });
    const repo = makeRepo();
    renderWithProviders(<TripSelectorScreen repo={repo} onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Japan 2026'));
    const logoutButton = screen.getByTitle('Sign out');
    expect(logoutButton).toHaveTextContent('Logout');
    await userEvent.setup().click(logoutButton);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('TripSelectorScreen — app access (admin)', () => {
  const adminUser = { uid: 'admin-uid', email: 'hawuawu@gmail.com', displayName: 'Admin' };
  const regularUser = { uid: 'user-uid', email: 'someone@example.com', displayName: 'Someone' };

  it('hides the App access button without an auth service', async () => {
    renderWithProviders(<TripSelectorScreen repo={makeRepo()} onSelect={vi.fn()} />);
    await waitFor(() => screen.getByText('Japan 2026'));
    expect(screen.queryByTitle('App access')).not.toBeInTheDocument();
  });

  it('hides the App access button for a non-admin user', async () => {
    useAuthStore.setState({ service: fakeAuthService, user: regularUser });
    renderWithProviders(<TripSelectorScreen repo={makeRepo()} onSelect={vi.fn()} />);
    await waitFor(() => screen.getByText('Japan 2026'));
    expect(screen.queryByTitle('App access')).not.toBeInTheDocument();
  });

  it('shows the App access button for the admin and opens the dialog', async () => {
    useAuthStore.setState({ service: fakeAuthService, user: adminUser });
    renderWithProviders(<TripSelectorScreen repo={makeRepo()} onSelect={vi.fn()} />);

    await waitFor(() => screen.getByText('Japan 2026'));
    await userEvent.setup().click(screen.getByTitle('App access'));
    expect(screen.getByText('App access', { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'People' })).toBeInTheDocument();
  });
});
