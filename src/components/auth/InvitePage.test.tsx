import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InvitePage } from './InvitePage';
import { useAuthStore } from '../../store/authStore';
import { renderWithProviders, resetStores } from '../../test/helpers';

beforeEach(() => {
  resetStores();
});

describe('InvitePage', () => {
  it('disables Accept invite until an email is entered', () => {
    renderWithProviders(<InvitePage token="tok-1" />);
    expect(screen.getByRole('button', { name: /accept invite/i })).toBeDisabled();
  });

  it('redeems the token with the entered email and moves to the sign-in step', async () => {
    const redeemInvite = vi.fn().mockResolvedValue(undefined);
    const signInWithGoogle = vi.fn();
    useAuthStore.setState({ redeemInvite, signInWithGoogle });

    const user = userEvent.setup();
    renderWithProviders(<InvitePage token="tok-1" />);

    await user.type(screen.getByLabelText(/your email/i), '  Friend@Example.com ');
    await user.click(screen.getByRole('button', { name: /accept invite/i }));

    await waitFor(() => screen.getByText(/sign in to continue/i));
    expect(redeemInvite).toHaveBeenCalledWith('tok-1', 'Friend@Example.com');

    await user.click(screen.getByRole('button', { name: /sign in with google/i }));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('shows the server error inline when redemption fails', async () => {
    const redeemInvite = vi
      .fn()
      .mockRejectedValue(new Error('This invite link has already been used.'));
    useAuthStore.setState({ redeemInvite });

    const user = userEvent.setup();
    renderWithProviders(<InvitePage token="tok-1" />);

    await user.type(screen.getByLabelText(/your email/i), 'late@example.com');
    await user.click(screen.getByRole('button', { name: /accept invite/i }));

    await waitFor(() =>
      expect(screen.getByText('This invite link has already been used.')).toBeInTheDocument()
    );
    expect(screen.queryByText(/sign in to continue/i)).not.toBeInTheDocument();
  });
});
