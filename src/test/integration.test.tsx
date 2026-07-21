/**
 * Integration tests — full user flows
 *
 * These tests render complete component trees backed by a real LocalTripRepository
 * (not mocks) so they exercise the whole stack: UI → Zustand store → data layer.
 *
 * Setup note — matchMedia:
 *   The global setup in setup.ts returns `matches: false` for all media queries.
 *   That makes `isPhone = false` and `isWide = false` in AppShell / TimelineView,
 *   producing the tablet split layout (no bottom nav tabs, no alternatives shelf).
 *   For these integration tests we override matchMedia so that
 *   `(max-width:599.95px)` (MUI sm breakpoint) returns `matches: true`, forcing
 *   the phone layout with bottom-nav tabs and all three views accessible.
 *
 * Setup note — localStorage:
 *   Node 26 exposes an experimental `localStorage` global (undefined without
 *   --localstorage-file) that shadows jsdom's. We stub it with a Map-backed
 *   mock the same way localTripRepository.test.ts does.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useTripStore } from '../store/tripStore';
import { useAuthStore } from '../store/authStore';
import { LocalTripRepository } from '../data/localTripRepository';
import { renderWithProviders, resetStores } from './helpers';
import { AppShell } from '../components/layout/AppShell';

// ---------------------------------------------------------------------------
// react-map-gl / maplibre-gl mocks — these use WebGL unavailable in jsdom
// ---------------------------------------------------------------------------
vi.mock('react-map-gl/maplibre', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  AttributionControl: () => null,
  Source: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Layer: () => null,
  Marker: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div onClick={onClick}>{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({
    current: {
      easeTo: vi.fn(),
      panTo: vi.fn(),
      jumpTo: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
    },
  }),
}));

vi.mock('maplibre-gl', () => ({ __esModule: true, default: {} }));

// ---------------------------------------------------------------------------
// localStorage mock (Node 26 compatibility)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// matchMedia override — force phone layout so bottom-nav tabs are rendered
// MUI sm breakpoint = "(max-width:599.95px)", lg = "(min-width:1200px)"
// ---------------------------------------------------------------------------
function installPhoneMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      // sm down = true (phone) | lg up = false (not wide desktop)
      matches: query.includes('max-width'),
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

// ---------------------------------------------------------------------------
// navigator.onLine helpers
// ---------------------------------------------------------------------------
const originalOnlineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  // Stub localStorage before anything else so LocalTripRepository reads seeds
  vi.stubGlobal('localStorage', makeLocalStorageMock());
  resetStores();
  // Force phone layout (bottom-nav tabs) so all three tabs are accessible
  installPhoneMatchMedia();
  // Restore online state before each test so offline banner is hidden by default
  setOnline(true);
  const repo = new LocalTripRepository();
  useAuthStore.setState({
    user: { uid: 'test-user', email: 'test@test.com', displayName: 'Test' },
    loading: false,
    service: null,
  });
  useTripStore.getState().init('demo', repo);
});

afterEach(() => {
  vi.unstubAllGlobals();
  // Restore setup.ts's matchMedia (returns false for all queries)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
  if (originalOnlineDescriptor) {
    Object.defineProperty(navigator, 'onLine', originalOnlineDescriptor);
  } else {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  }
});

// ---------------------------------------------------------------------------
// Flow 1 — Add checkpoint
// ---------------------------------------------------------------------------
describe('Flow 1: Add checkpoint', () => {
  it('adds a new checkpoint and shows it on the timeline', async () => {
    renderWithProviders(<AppShell onBack={() => {}} />);

    // Wait for seed checkpoints to load (Timeline tab is default on phone)
    await waitFor(() => {
      expect(screen.getByText('JFK → NRT')).toBeInTheDocument();
    });

    // Open the add form via the hamburger drawer menu's "Add checkpoint" item
    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));
    fireEvent.click(screen.getByText('Add checkpoint'));

    // The add form drawer should be open
    await waitFor(() => {
      expect(screen.getByText('Add checkpoint')).toBeInTheDocument();
    });

    // Fill in the Name field
    const nameInput = screen.getByRole('textbox', { name: /^name$/i });
    fireEvent.change(nameInput, { target: { value: 'Arashiyama Bamboo Grove' } });

    // Fill in the Start time field (datetime-local, required)
    const startInput = document.querySelector(
      'input[type="datetime-local"][required]'
    ) as HTMLInputElement;
    expect(startInput).toBeTruthy();
    fireEvent.change(startInput, { target: { value: '2026-10-07T09:00' } });

    // Click Save
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    // The new checkpoint should appear in the timeline
    await waitFor(() => {
      expect(screen.getByText('Arashiyama Bamboo Grove')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Flow 2 — Edit checkpoint
// ---------------------------------------------------------------------------
describe('Flow 2: Edit checkpoint', () => {
  it('edits an existing checkpoint and shows the updated name', async () => {
    renderWithProviders(<AppShell onBack={() => {}} />);

    // Wait for seed data
    await waitFor(() => {
      expect(screen.getByText('JFK → NRT')).toBeInTheDocument();
    });

    // Click the first checkpoint's edit button to open the edit drawer
    fireEvent.click(screen.getAllByRole('button', { name: /edit checkpoint/i })[0]);

    // Edit form should appear
    await waitFor(() => {
      expect(screen.getByText('Edit checkpoint')).toBeInTheDocument();
    });

    // Change the name
    const nameInput = screen.getByRole('textbox', { name: /^name$/i });
    fireEvent.change(nameInput, { target: { value: 'Updated Flight' } });

    // Save
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    // Updated name should appear
    await waitFor(() => {
      expect(screen.getByText('Updated Flight')).toBeInTheDocument();
    });

    // Original name should no longer appear as a visible list item
    await waitFor(() => {
      const matches = screen.queryAllByText('JFK → NRT').filter((el) => el.tagName !== 'INPUT');
      expect(matches.length).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Flow 3 — Delete + undo
// ---------------------------------------------------------------------------
describe('Flow 3: Delete and undo', () => {
  it('deletes a checkpoint then restores it via the UNDO snackbar', async () => {
    renderWithProviders(<AppShell onBack={() => {}} />);

    // Wait for seed checkpoints
    await waitFor(() => {
      expect(screen.getByText('JFK → NRT')).toBeInTheDocument();
    });

    // Each checkpoint row's delete button carries an explicit aria-label;
    // click the first checkpoint's.
    const deleteBtn = screen.getAllByRole('button', { name: /delete checkpoint/i })[0];
    fireEvent.click(deleteBtn);

    // Confirm the deletion in the confirmation dialog
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    // The checkpoint should disappear from the list
    await waitFor(() => {
      expect(screen.queryByText('JFK → NRT')).not.toBeInTheDocument();
    });

    // The undo snackbar should appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^undo$/i })).toBeInTheDocument();
    });

    // Click UNDO to restore the checkpoint
    fireEvent.click(screen.getByRole('button', { name: /^undo$/i }));

    // The checkpoint should reappear
    await waitFor(() => {
      expect(screen.getByText('JFK → NRT')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Flow 4 — Promote alternative to timeline
// ---------------------------------------------------------------------------
describe('Flow 4: Promote alternative to timeline', () => {
  it('promotes an alternative to the timeline via the promote dialog', async () => {
    renderWithProviders(<AppShell onBack={() => {}} />);

    // Wait for the initial timeline to render
    await waitFor(() => {
      expect(screen.getByText('JFK → NRT')).toBeInTheDocument();
    });

    // Navigate to the Alternatives tab.
    // MUI BottomNavigationAction renders a <button> whose accessible name is
    // the concatenation of the icon aria-hidden text and the label text.
    // Using text-based query to find the tab reliably.
    const altTab = screen.getByText('Alternatives').closest('button');
    expect(altTab).toBeTruthy();
    fireEvent.click(altTab!);

    // Wait for alternatives to load
    await waitFor(() => {
      expect(screen.getByText('teamLab Borderless')).toBeInTheDocument();
    });

    // Click the "Add to timeline" promote button for the first alternative
    const promoteBtns = screen.getAllByTitle('Add to timeline');
    fireEvent.click(promoteBtns[0]);

    // The promote dialog should appear
    await waitFor(() => {
      expect(screen.getByText(/add "teamLab Borderless" to timeline/i)).toBeInTheDocument();
    });

    // Fill in the start time
    const datetimeInput = document.querySelector(
      'input[type="datetime-local"]'
    ) as HTMLInputElement;
    expect(datetimeInput).toBeTruthy();
    fireEvent.change(datetimeInput, { target: { value: '2026-10-04T11:00' } });

    // The Add button should now be enabled
    const addBtn = screen.getByRole('button', { name: /^add$/i });
    expect(addBtn).not.toBeDisabled();
    fireEvent.click(addBtn);

    // Navigate back to Timeline tab and verify the promoted item appears
    const timelineTab = screen.getByText('Timeline').closest('button');
    expect(timelineTab).toBeTruthy();
    fireEvent.click(timelineTab!);

    await waitFor(() => {
      expect(screen.getByText('teamLab Borderless')).toBeInTheDocument();
    });

    // Navigate back to Alternatives and verify it's been removed
    fireEvent.click(altTab!);
    await waitFor(() => {
      // teamLab Borderless should no longer be in the alternatives list
      // (it moved to the timeline, which is not rendered in this tab)
      expect(screen.queryByText('teamLab Borderless')).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Flow 5 — Offline banner
// ---------------------------------------------------------------------------
describe('Flow 5: Offline banner', () => {
  it('shows the offline banner on "offline" event and hides it on "online" event', async () => {
    setOnline(true);
    renderWithProviders(<AppShell onBack={() => {}} />);

    // Banner should not be present initially
    expect(screen.queryByText(/saved locally/i)).not.toBeInTheDocument();

    // Go offline
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // Banner should appear
    await waitFor(() => {
      expect(screen.getByText(/saved locally/i)).toBeInTheDocument();
    });

    // Go back online
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Banner should disappear
    await waitFor(() => {
      expect(screen.queryByText(/saved locally/i)).not.toBeInTheDocument();
    });
  });

  it('shows the offline banner immediately when navigator.onLine is false at mount', () => {
    setOnline(false);
    renderWithProviders(<AppShell onBack={() => {}} />);

    expect(screen.getByText(/saved locally/i)).toBeInTheDocument();
  });
});
