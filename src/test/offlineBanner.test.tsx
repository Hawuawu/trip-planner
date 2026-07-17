import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { OfflineBanner } from '../components/layout/OfflineBanner';
import { renderWithProviders } from './helpers';

// Save and restore the real navigator.onLine descriptor between tests.
const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

afterEach(() => {
  // Restore original descriptor
  if (originalDescriptor) {
    Object.defineProperty(navigator, 'onLine', originalDescriptor);
  } else {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
  }
});

describe('OfflineBanner', () => {
  it('renders nothing when the browser is online', () => {
    setOnline(true);
    const { container } = renderWithProviders(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the offline message when navigator.onLine is false', () => {
    setOnline(false);
    renderWithProviders(<OfflineBanner />);
    expect(screen.getByText(/saved locally/i)).toBeInTheDocument();
  });

  it('shows the banner when an "offline" event fires', () => {
    setOnline(true);
    renderWithProviders(<OfflineBanner />);
    // Start online — no banner
    expect(screen.queryByText(/saved locally/i)).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByText(/saved locally/i)).toBeInTheDocument();
  });

  it('hides the banner when an "online" event fires after going offline', () => {
    setOnline(false);
    renderWithProviders(<OfflineBanner />);
    expect(screen.getByText(/saved locally/i)).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByText(/saved locally/i)).not.toBeInTheDocument();
  });
});
