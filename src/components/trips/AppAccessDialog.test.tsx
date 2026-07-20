import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppAccessDialog } from './AppAccessDialog';
import { useAuthStore } from '../../store/authStore';
import { renderWithProviders, resetStores } from '../../test/helpers';
import type { AuthService } from '../../data/AuthService';
import type { AllowedUser, AppInvite, AppActivityEntry } from '../../types';

const allowedUsers: AllowedUser[] = [
  { email: 'hawuawu@gmail.com', invitedVia: 'seed', createdAt: '2026-07-01T10:00:00.000Z' },
  { email: 'friend@example.com', invitedVia: 'tok-1', createdAt: '2026-07-02T10:00:00.000Z' },
];

const invites: AppInvite[] = [
  {
    token: 'tok-1',
    status: 'redeemed',
    redeemedEmail: 'friend@example.com',
    createdAt: '2026-07-02T09:00:00.000Z',
  },
  { token: 'tok-2', status: 'pending', redeemedEmail: null, createdAt: '2026-07-03T09:00:00.000Z' },
];

const activity: AppActivityEntry[] = [
  {
    id: 'a1',
    type: 'sign_in_rejected',
    email: 'stranger@example.com',
    token: null,
    actor: 'system',
    createdAt: '2026-07-04T09:00:00.000Z',
  },
];

function makeService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    getCurrentUser: () => null,
    onAuthStateChanged: () => () => {},
    signInWithGoogle: async () => {},
    signOut: async () => {},
    createInvite: vi.fn().mockResolvedValue('tok-new'),
    redeemInvite: vi.fn(),
    cancelInvite: vi.fn().mockResolvedValue(undefined),
    revokeAccess: vi.fn().mockResolvedValue(undefined),
    subscribeToAllowedUsers: vi.fn((cb) => {
      cb(allowedUsers);
      return () => {};
    }),
    subscribeToInvites: vi.fn((cb) => {
      cb(invites);
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

describe('AppAccessDialog — Invites', () => {
  it('creates an invite link and shows it for copying', async () => {
    const service = renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: 'Invites' }));
    await user.click(screen.getByRole('button', { name: /new invite link/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Invite link')).toHaveValue(
        `${location.origin}/?invite=tok-new`
      );
    });
    expect(service.createInvite).toHaveBeenCalledTimes(1);
  });

  it('shows invite statuses and cancels a pending invite', async () => {
    const service = renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: 'Invites' }));
    expect(screen.getByText('redeemed')).toBeInTheDocument();
    expect(screen.getByText('friend@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(service.cancelInvite).toHaveBeenCalledWith('tok-2'));
  });
});

describe('AppAccessDialog — Activity', () => {
  it('renders activity entries with readable labels', async () => {
    renderDialog();
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Activity' }));
    expect(screen.getByText(/Sign-in rejected — stranger@example.com/)).toBeInTheDocument();
  });
});
