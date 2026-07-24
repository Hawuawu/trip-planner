import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignInPage } from './SignInPage';
import { useAuthStore } from '../../store/authStore';
import { renderWithProviders, resetStores } from '../../test/helpers';

beforeEach(() => {
  resetStores();
});

describe('SignInPage', () => {
  it('renders a Google sign-in button and calls signInWithGoogle on click', async () => {
    const signInWithGoogle = vi.fn();
    useAuthStore.setState({ signInWithGoogle });
    renderWithProviders(<SignInPage />);

    await userEvent.setup().click(screen.getByRole('button', { name: /sign in with google/i }));

    expect(signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('shows an error alert when authError is set', () => {
    useAuthStore.setState({ authError: 'Something went wrong signing in.' });
    renderWithProviders(<SignInPage />);
    expect(screen.getByText('Something went wrong signing in.')).toBeInTheDocument();
  });

  it('does not show an error alert when authError is null', () => {
    useAuthStore.setState({ authError: null });
    renderWithProviders(<SignInPage />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
