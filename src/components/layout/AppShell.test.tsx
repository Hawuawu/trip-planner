import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './AppShell';
import { renderWithProviders, resetStores } from '../../test/helpers';
import { useTripStore } from '../../store/tripStore';
import { useAuthStore } from '../../store/authStore';
import type { TripRepository } from '../../data/TripRepository';
import { downloadTextFile } from '../../utils/fileTransfer';

vi.mock('../../utils/fileTransfer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/fileTransfer')>();
  return { ...actual, downloadTextFile: vi.fn() };
});

vi.mock('react-map-gl/maplibre', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  NavigationControl: () => null,
  Source: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Layer: () => null,
  Marker: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div onClick={onClick}>{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ current: { easeTo: vi.fn() } }),
}));
vi.mock('maplibre-gl', () => ({ __esModule: true, default: {} }));

function installMatchMedia({ phone = false, wide = false }: { phone?: boolean; wide?: boolean }) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('max-width') ? phone : query.includes('min-width') ? wide : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function makeMockRepo(overrides: Partial<TripRepository> = {}): TripRepository {
  return {
    getTrip: vi.fn().mockResolvedValue(null),
    subscribeToTrip: vi.fn().mockReturnValue(() => {}),
    listTrips: vi.fn().mockResolvedValue([]),
    createTrip: vi.fn(),
    updateTrip: vi.fn(),
    deleteTrip: vi.fn(),
    inviteMember: vi.fn().mockResolvedValue({ status: 'invited', uid: 'invitee-1' }),
    removeMember: vi.fn().mockResolvedValue(undefined),
    leaveTrip: vi.fn().mockResolvedValue(undefined),
    recordAccess: vi.fn().mockResolvedValue(undefined),
    subscribeToActivityLog: vi.fn().mockReturnValue(() => {}),
    subscribeToCheckpoints: vi.fn().mockReturnValue(() => {}),
    addCheckpoint: vi.fn(),
    addCheckpoints: vi.fn().mockResolvedValue([]),
    updateCheckpoint: vi.fn(),
    deleteCheckpoint: vi.fn(),
    subscribeToAlternatives: vi.fn().mockReturnValue(() => {}),
    addAlternative: vi.fn(),
    addAlternatives: vi.fn().mockResolvedValue([]),
    updateAlternative: vi.fn(),
    deleteAlternative: vi.fn(),
    promoteAlternative: vi.fn(),
    subscribeToBookings: vi.fn().mockReturnValue(() => {}),
    addBooking: vi.fn(),
    updateBooking: vi.fn(),
    deleteBooking: vi.fn(),
    ...overrides,
  } as TripRepository;
}

async function uploadYamlFile(content: string, fileName = 'checkpoints.yaml') {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /choose yaml file/i }));

  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([content], fileName, { type: 'text/yaml' });
  Object.defineProperty(input, 'files', { value: [file] });
  input.dispatchEvent(new Event('change'));
  await new Promise((r) => setTimeout(r, 0));
}

function withinMenu() {
  return within(screen.getByTestId('app-menu'));
}

beforeEach(() => {
  resetStores();
  installMatchMedia({});
  vi.mocked(downloadTextFile).mockClear();
});

afterEach(() => {
  document.querySelectorAll('input[type="file"]').forEach((el) => el.remove());
});

describe('AppShell — tablet split layout (neither phone nor wide)', () => {
  it('renders both the timeline and alternatives panels, with both toggles', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    expect(screen.getByText(/no checkpoints yet/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Collapse timeline')).toBeInTheDocument();
    expect(screen.getByText(/no alternatives/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Collapse alternatives')).toBeInTheDocument();
  });

  it('gives the timeline and alternatives panels the same width', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);
    const timelineWidth = window.getComputedStyle(screen.getByTestId('timeline-panel')).width;
    const alternativesWidth = window.getComputedStyle(
      screen.getByTestId('alternatives-panel')
    ).width;
    expect(timelineWidth).toBe(alternativesWidth);
  });

  it('collapses and expands the timeline panel via its toggle', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Collapse timeline'));
    expect(screen.queryByText(/no checkpoints yet/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Expand timeline')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Expand timeline'));
    expect(screen.getByText(/no checkpoints yet/i)).toBeInTheDocument();
  });

  it('collapses and expands the alternatives panel via its toggle', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Collapse alternatives'));
    expect(screen.queryByText(/no alternatives/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Expand alternatives')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Expand alternatives'));
    expect(screen.getByText(/no alternatives/i)).toBeInTheDocument();
  });
});

describe('AppShell — wide desktop layout', () => {
  beforeEach(() => {
    installMatchMedia({ wide: true });
  });

  it('renders the alternatives panel and both toggles', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    expect(screen.getByLabelText('Collapse timeline')).toBeInTheDocument();
    expect(screen.getByLabelText('Collapse alternatives')).toBeInTheDocument();
    expect(screen.getByText(/no alternatives/i)).toBeInTheDocument();
  });

  it('collapses and expands the alternatives panel via its toggle', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Collapse alternatives'));
    expect(screen.queryByText(/no alternatives/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Expand alternatives')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Expand alternatives'));
    expect(screen.getByText(/no alternatives/i)).toBeInTheDocument();
  });
});

describe('AppShell — phone layout', () => {
  beforeEach(() => {
    installMatchMedia({ phone: true });
  });

  it('renders bottom navigation and switches between tabs', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    expect(screen.getByText(/no checkpoints yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(screen.queryByText(/no checkpoints yet/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('map')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Alternatives' }));
    expect(screen.getByText(/no alternatives/i)).toBeInTheDocument();
  });
});

describe('AppShell — app bar', () => {
  it('falls back to "Maiyun\'s Trip Planner" when no trip is loaded', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);
    expect(screen.getByText("Maiyun's Trip Planner")).toBeInTheDocument();
  });

  it("shows the trip's name once one is loaded", () => {
    useTripStore.setState({
      trip: {
        id: 't1',
        name: 'Japan 2026',
        dateRange: { start: '2026-09-01', end: '2026-09-10' },
        memberIds: [],
      },
    });
    renderWithProviders(<AppShell onBack={vi.fn()} />);
    expect(screen.getByText('Japan 2026')).toBeInTheDocument();
  });

  it('does not render a sign-out button (sign-out lives only on the trip selector)', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);
    expect(screen.queryByTitle('Sign out')).not.toBeInTheDocument();
  });

  it('shows the hamburger menu button (no separate back button in the toolbar)', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);
    expect(screen.getByLabelText('Menu')).toBeInTheDocument();
    expect(screen.queryByTitle('Back to trips')).not.toBeInTheDocument();
  });
});

describe('AppShell — hamburger menu', () => {
  it('opens the menu with add/back/export/import options when the hamburger icon is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    await user.click(screen.getByLabelText('Menu'));

    const menu = withinMenu();
    expect(menu.getByRole('button', { name: 'Add checkpoint' })).toBeInTheDocument();
    expect(menu.getByRole('button', { name: 'Add alternative' })).toBeInTheDocument();
    expect(menu.getByText('Back to trips')).toBeInTheDocument();
    expect(menu.getByText('Export trip (.yaml)')).toBeInTheDocument();
    expect(menu.getByText('Import checkpoints…')).toBeInTheDocument();
  });

  it('opens the add-checkpoint form when "Add checkpoint" is clicked from the menu', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    await user.click(screen.getByLabelText('Menu'));
    await user.click(withinMenu().getByRole('button', { name: 'Add checkpoint' }));

    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
  });

  it('opens the add-alternative form when "Add alternative" is clicked from the menu', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    await user.click(screen.getByLabelText('Menu'));
    await user.click(withinMenu().getByRole('button', { name: 'Add alternative' }));

    expect(screen.getByRole('heading', { name: /add alternative/i })).toBeInTheDocument();
  });

  it('calls onBack when "Back to trips" is clicked from the menu', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderWithProviders(<AppShell onBack={onBack} />);

    await user.click(screen.getByLabelText('Menu'));
    await user.click(withinMenu().getByText('Back to trips'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('exports the trip using the live store state and shows a success snackbar', async () => {
    const user = userEvent.setup();
    useTripStore.setState({
      trip: {
        id: 't1',
        name: 'Japan 2026',
        dateRange: { start: '2026-09-01', end: '2026-09-10' },
        memberIds: [],
      },
      checkpoints: [
        {
          id: 'cp-1',
          type: 'poi',
          name: 'Fushimi Inari',
          startTime: '2026-09-02T08:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      alternatives: [],
    });
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    await user.click(screen.getByLabelText('Menu'));
    await user.click(withinMenu().getByText('Export trip (.yaml)'));

    expect(downloadTextFile).toHaveBeenCalledTimes(1);
    const [filename, yamlText] = vi.mocked(downloadTextFile).mock.calls[0];
    expect(filename).toBe('japan-2026.yaml');
    expect(yamlText).toContain('Fushimi Inari');
    await waitFor(() => {
      expect(screen.getByText('Trip exported.')).toBeInTheDocument();
    });
  });

  it('does not attempt to export when no trip is loaded', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    await user.click(screen.getByLabelText('Menu'));
    await user.click(withinMenu().getByText('Export trip (.yaml)'));

    expect(downloadTextFile).not.toHaveBeenCalled();
  });

  it('imports checkpoints via the store and shows a count snackbar', async () => {
    const user = userEvent.setup();
    const repo = makeMockRepo();
    useTripStore.setState({ repo, tripId: 'trip-1' });
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    await user.click(screen.getByLabelText('Menu'));
    await user.click(withinMenu().getByText('Import checkpoints…'));

    const yaml = `
checkpoints:
  - type: poi
    name: Nara Deer Park
    startTime: "2026-10-09T09:00:00.000Z"
alternatives:
  - type: poi
    name: Todai-ji Temple
`;
    await uploadYamlFile(yaml);
    await waitFor(() => screen.getByRole('button', { name: /^import$/i }));
    await user.click(screen.getByRole('button', { name: /^import$/i }));

    await waitFor(() => {
      expect(repo.addCheckpoints).toHaveBeenCalledWith(
        'trip-1',
        expect.arrayContaining([expect.objectContaining({ name: 'Nara Deer Park' })])
      );
      expect(repo.addAlternatives).toHaveBeenCalledWith(
        'trip-1',
        expect.arrayContaining([expect.objectContaining({ name: 'Todai-ji Temple' })])
      );
    });
    await waitFor(() => {
      expect(screen.getByText(/imported 1 checkpoint and 1 alternative\./i)).toBeInTheDocument();
    });
  });
});

describe('AppShell — members and activity log menu entries', () => {
  const TRIP = {
    id: 't1',
    name: 'Japan 2026',
    dateRange: { start: '2026-09-01', end: '2026-09-10' },
    memberIds: ['owner-uid', 'member-uid'],
    ownerId: 'owner-uid',
    memberProfiles: {
      'owner-uid': { email: 'owner@example.com', displayName: 'Owner Person' },
      'member-uid': { email: 'member@example.com', displayName: 'Member Person' },
    },
  };

  it('does not show Members/Activity log entries when no trip is loaded', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell onBack={vi.fn()} />);
    await user.click(screen.getByLabelText('Menu'));
    expect(withinMenu().queryByText('Members')).not.toBeInTheDocument();
    expect(withinMenu().queryByText('Activity log')).not.toBeInTheDocument();
  });

  it('shows both Members and Activity log for the owner', async () => {
    const user = userEvent.setup();
    useTripStore.setState({ trip: TRIP });
    useAuthStore.setState({ user: { uid: 'owner-uid', email: null, displayName: null } });
    renderWithProviders(<AppShell onBack={vi.fn()} />);
    await user.click(screen.getByLabelText('Menu'));
    expect(withinMenu().getByText('Members')).toBeInTheDocument();
    expect(withinMenu().getByText('Activity log')).toBeInTheDocument();
  });

  it('shows Members but hides Activity log for a non-owner member', async () => {
    const user = userEvent.setup();
    useTripStore.setState({ trip: TRIP });
    useAuthStore.setState({ user: { uid: 'member-uid', email: null, displayName: null } });
    renderWithProviders(<AppShell onBack={vi.fn()} />);
    await user.click(screen.getByLabelText('Menu'));
    expect(withinMenu().getByText('Members')).toBeInTheDocument();
    expect(withinMenu().queryByText('Activity log')).not.toBeInTheDocument();
  });

  it('opens the members dialog from the menu', async () => {
    const user = userEvent.setup();
    useTripStore.setState({ trip: TRIP });
    useAuthStore.setState({ user: { uid: 'owner-uid', email: null, displayName: null } });
    renderWithProviders(<AppShell onBack={vi.fn()} />);
    await user.click(screen.getByLabelText('Menu'));
    await user.click(withinMenu().getByText('Members'));
    expect(screen.getByText('Trip members')).toBeInTheDocument();
  });

  it('opens the activity log dialog from the menu for the owner', async () => {
    const user = userEvent.setup();
    useTripStore.setState({ trip: TRIP });
    useAuthStore.setState({ user: { uid: 'owner-uid', email: null, displayName: null } });
    renderWithProviders(<AppShell onBack={vi.fn()} />);
    await user.click(screen.getByLabelText('Menu'));
    await user.click(withinMenu().getByText('Activity log'));
    expect(screen.getByRole('heading', { name: 'Activity log' })).toBeInTheDocument();
  });
});
