import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppAccessDialog } from './AppAccessDialog';
import { useAuthStore } from '../../store/authStore';
import { renderWithProviders, resetStores } from '../../test/helpers';
import type { AuthService } from '../../data/AuthService';
import type { AllowedUser, AccessRequest, AppActivityEntry } from '../../types';

const allowedUsers: AllowedUser[] = [
  { email: 'hawuawu@gmail.com', invitedVia: 'seed', createdAt: '2026-07-01T10:00:00.000Z' },
  { email: 'friend@example.com', invitedVia: 'approved', createdAt: '2026-07-02T10:00:00.000Z' },
];

const requests: AccessRequest[] = [
  {
    email: 'newcomer@example.com',
    displayName: 'New Comer',
    status: 'pending',
    firstSeenAt: '2026-07-03T09:00:00.000Z',
    lastSeenAt: '2026-07-03T09:00:00.000Z',
  },
  {
    email: 'friend@example.com',
    displayName: 'Friend',
    status: 'approved',
    firstSeenAt: '2026-07-02T09:00:00.000Z',
    lastSeenAt: '2026-07-02T09:00:00.000Z',
  },
];

const activity: AppActivityEntry[] = [
  {
    id: 'a1',
    type: 'access_requested',
    email: 'newcomer@example.com',
    actor: 'system',
    createdAt: '2026-07-03T09:00:00.000Z',
  },
];

function makeService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    getCurrentUser: () => null,
    onAuthStateChanged: () => () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {},
    refreshAccess: vi.fn().mockResolvedValue(null),
    approveAccess: vi.fn().mockResolvedValue(undefined),
    denyAccess: vi.fn().mockResolvedValue(undefined),
    revokeAccess: vi.fn().mockResolvedValue(undefined),
    subscribeToAllowedUsers: vi.fn((cb) => {
      cb(allowedUsers);
      return () => {};
    }),
    subscribeToAccessRequests: vi.fn((cb) => {
      cb(requests);
      return () => {};
    }),
    subscribeToAppActivity: vi.fn((cb) => {
      cb(activity);
      return () => {};
    }),
    ...overrides,
  };
}

beforeEach(() => {
  resetStores();
});

function renderDialog(service = makeService()) {
  useAuthStore.getState().init(service);
  renderWithProviders(<AppAccessDialog open onClose={vi.fn()} />);
  return service;
}

describe('AppAccessDialog — People', () => {
  it('lists allowed users, marks the admin, and revokes via the confirm dialog', async () => {
    const service = renderDialog();
    const user = userEvent.setup();

    expect(screen.getByText('hawuawu@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.queryByLabelText('Revoke access for hawuawu@gmail.com')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Revoke access for friend@example.com'));
    await user.click(screen.getByRole('button', { name: /^revoke$/i }));

    await waitFor(() => expect(service.revokeAccess).toHaveBeenCalledWith('friend@example.com'));
  });
});

describe('AppAccessDialog — Requests', () => {
  it('shows the pending count in the tab label and lists requests with status', async () => {
    renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: 'Requests (1)' }));
    expect(screen.getByText('newcomer@example.com')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText(/New Comer/)).toBeInTheDocument();
  });

  it('approves a pending request', async () => {
    const service = renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: /requests/i }));
    await user.click(screen.getByLabelText('Approve newcomer@example.com'));

    await waitFor(() => expect(service.approveAccess).toHaveBeenCalledWith('newcomer@example.com'));
  });

  it('denies a pending request, and offers no deny for an approved one', async () => {
    const service = renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: /requests/i }));
    expect(screen.queryByLabelText('Deny friend@example.com')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Deny newcomer@example.com'));
    await waitFor(() => expect(service.denyAccess).toHaveBeenCalledWith('newcomer@example.com'));
  });
});

describe('AppAccessDialog — Activity', () => {
  it('renders activity entries with readable labels', async () => {
    renderDialog();
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Activity' }));
    expect(screen.getByText(/Access requested — newcomer@example.com/)).toBeInTheDocument();
  });
});
