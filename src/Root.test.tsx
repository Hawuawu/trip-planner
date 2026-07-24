import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Root } from './Root';
import { renderWithProviders, resetStores } from './test/helpers';
import { useAuthStore } from './store/authStore';
import { useTripStore } from './store/tripStore';
import type { TripRepository } from './data/TripRepository';

vi.mock('./App', () => ({ default: () => <div>app-shell-stub</div> }));
vi.mock('./components/auth/SignInPage', () => ({
  SignInPage: () => <div>sign-in-stub</div>,
}));
vi.mock('./components/auth/PendingApprovalPage', () => ({
  PendingApprovalPage: () => <div>pending-stub</div>,
}));
vi.mock('./components/trips/TripSelectorScreen', () => ({
  TripSelectorScreen: () => <div>trip-selector-stub</div>,
}));

// ── localStorage mock ─────────────────────────────────────────────────────────
// Same pattern as TripSelectorScreen.test.tsx — Root reads/writes the
// active-trip-id key directly via the global.

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
const repo = {} as TripRepository; // never exercised — App/TripSelectorScreen are mocked out

beforeEach(() => {
  storageMock = makeLocalStorageMock();
  vi.stubGlobal('localStorage', storageMock);
  resetStores();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const approvedUser = { uid: 'u1', email: 'a@example.com', displayName: null, appAccess: true };

describe('Root', () => {
  it('shows a spinner while auth is loading', () => {
    useAuthStore.setState({ loading: true });
    renderWithProviders(<Root tripRepo={repo} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows sign-in when there is no user', () => {
    useAuthStore.setState({ loading: false, user: null });
    renderWithProviders(<Root tripRepo={repo} />);
    expect(screen.getByText('sign-in-stub')).toBeInTheDocument();
  });

  it('shows the pending-approval screen when signed in but not appAccess-approved', () => {
    useAuthStore.setState({
      loading: false,
      user: { uid: 'u1', email: 'a@example.com', displayName: null, appAccess: false },
    });
    renderWithProviders(<Root tripRepo={repo} />);
    expect(screen.getByText('pending-stub')).toBeInTheDocument();
  });

  it('shows the trip selector when approved but no trip is active yet', () => {
    useAuthStore.setState({ loading: false, user: approvedUser });
    renderWithProviders(<Root tripRepo={repo} />);
    expect(screen.getByText('trip-selector-stub')).toBeInTheDocument();
  });

  it('shows the app and initializes the trip store when a trip is already active', () => {
    storageMock.setItem('trip-planner:activeTripId', 'trip-1');
    useAuthStore.setState({ loading: false, user: approvedUser });
    const init = vi.fn();
    useTripStore.setState({ init });

    renderWithProviders(<Root tripRepo={repo} />);

    expect(screen.getByText('app-shell-stub')).toBeInTheDocument();
    expect(init).toHaveBeenCalledWith('trip-1', repo);
  });
});
