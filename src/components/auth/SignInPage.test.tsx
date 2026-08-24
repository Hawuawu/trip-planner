import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignInPage } from './SignInPage';
import { useAuthStore } from '../../store/authStore';
import { renderWithProviders, resetStores } from '../../test/helpers';

const EMAIL_FOR_SIGN_IN_KEY = 'trip-planner:emailForSignIn';

beforeEach(() => {
  resetStores();
});

afterEach(() => {
  localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
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

  it('reveals the email form and sends a sign-in link on submit', async () => {
    const sendSignInLinkToEmail = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ sendSignInLinkToEmail });
    renderWithProviders(<SignInPage />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sign in with email instead/i }));
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }));

    expect(sendSignInLinkToEmail).toHaveBeenCalledWith('a@b.com');
    expect(await screen.findByText(/check your email for a sign-in link/i)).toBeInTheDocument();
  });

  it('auto-completes sign-in when a link is detected with a stored email', async () => {
    localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, 'a@b.com');
    const completeEmailLinkSignIn = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      isSignInLink: vi.fn().mockReturnValue(true),
      completeEmailLinkSignIn,
    });
    renderWithProviders(<SignInPage />);

    await waitFor(() => {
      expect(completeEmailLinkSignIn).toHaveBeenCalledWith('a@b.com', window.location.href);
    });
  });

  it('shows a cross-device confirm-email prompt when no stored email is found', () => {
    useAuthStore.setState({ isSignInLink: vi.fn().mockReturnValue(true) });
    renderWithProviders(<SignInPage />);

    expect(screen.getByText(/confirm your email to finish signing in/i)).toBeInTheDocument();
  });

  it('submitting the cross-device confirm form calls completeEmailLinkSignIn', async () => {
    const completeEmailLinkSignIn = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      isSignInLink: vi.fn().mockReturnValue(true),
      completeEmailLinkSignIn,
    });
    renderWithProviders(<SignInPage />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    expect(completeEmailLinkSignIn).toHaveBeenCalledWith('a@b.com', window.location.href);
  });
});
