import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PendingApprovalPage } from './PendingApprovalPage';
import { useAuthStore } from '../../store/authStore';
import { renderWithProviders, resetStores } from '../../test/helpers';

beforeEach(() => {
  resetStores();
});

describe('PendingApprovalPage', () => {
  it('shows the signed-in email and explains the sign-in already requested access', () => {
    useAuthStore.setState({
      user: { uid: 'u1', email: 'waiting@example.com', displayName: 'W', appAccess: false },
    });
    renderWithProviders(<PendingApprovalPage />);
    expect(screen.getByText(/waiting@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/approval/i)).toBeInTheDocument();
  });

  it('Check again triggers a claims refresh and reports still-pending', async () => {
    const refreshAccess = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ refreshAccess });
    renderWithProviders(<PendingApprovalPage />);

    await userEvent.setup().click(screen.getByRole('button', { name: /check again/i }));

    await waitFor(() => expect(refreshAccess).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/not approved yet/i)).toBeInTheDocument();
  });

  it('offers sign out', async () => {
    const signOut = vi.fn();
    useAuthStore.setState({ signOut });
    renderWithProviders(<PendingApprovalPage />);
    await userEvent.setup().click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
