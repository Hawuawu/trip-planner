import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountMenu } from './AccountMenu';
import { useAuthStore } from '../../store/authStore';
import { renderWithProviders, resetStores } from '../../test/helpers';
import type { AuthService } from '../../data/AuthService';

const fakeAuthService: AuthService = {
  getCurrentUser: () => null,
  onAuthStateChanged: () => () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
  sendSignInLinkToEmail: async () => {},
  isSignInLink: () => false,
  completeEmailLinkSignIn: async () => {},
  refreshAccess: async () => null,
  approveAccess: async () => {},
  denyAccess: async () => {},
  revokeAccess: async () => {},
  setAdminRole: async () => {},
  subscribeToAllowedUsers: () => () => {},
  subscribeToAccessRequests: () => () => {},
  subscribeToAppActivity: () => () => {},
};

beforeEach(() => {
  resetStores();
});

describe('AccountMenu', () => {
  it('renders nothing when there is no auth service (local-dev mode)', () => {
    useAuthStore.setState({
      user: { uid: 'u1', email: 'me@example.com', displayName: 'Me' },
    });
    const { container } = renderWithProviders(<AccountMenu />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there is no signed-in user', () => {
    useAuthStore.setState({ service: fakeAuthService, user: null });
    const { container } = renderWithProviders(<AccountMenu />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the profile photo when photoURL is set', () => {
    useAuthStore.setState({
      service: fakeAuthService,
      user: {
        uid: 'u1',
        email: 'me@example.com',
        displayName: 'Ada Lovelace',
        photoURL: 'https://example.com/photo.jpg',
      },
    });
    renderWithProviders(<AccountMenu />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
  });

  it('falls back to initials from displayName when photoURL is absent', () => {
    useAuthStore.setState({
      service: fakeAuthService,
      user: { uid: 'u1', email: 'me@example.com', displayName: 'Ada Lovelace', photoURL: null },
    });
    renderWithProviders(<AccountMenu />);
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('falls back to the first letter of the email when there is no displayName', () => {
    useAuthStore.setState({
      service: fakeAuthService,
      user: { uid: 'u1', email: 'me@example.com', displayName: null, photoURL: null },
    });
    renderWithProviders(<AccountMenu />);
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('opens a menu with name/email and a Sign out item, and calls signOut on click', async () => {
    const signOut = vi.fn();
    useAuthStore.setState({
      service: fakeAuthService,
      signOut,
      user: { uid: 'u1', email: 'me@example.com', displayName: 'Ada Lovelace', photoURL: null },
    });
    renderWithProviders(<AccountMenu />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /account menu for ada lovelace/i }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('me@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
