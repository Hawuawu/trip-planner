import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/helpers';
import { ResponsiveEditDrawer } from './ResponsiveEditDrawer';

function installPhoneMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
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

function installDesktopMatchMedia() {
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
}

afterEach(() => {
  installDesktopMatchMedia();
});

describe('ResponsiveEditDrawer', () => {
  it('renders children when open', () => {
    renderWithProviders(
      <ResponsiveEditDrawer open onClose={vi.fn()}>
        <div>Drawer content</div>
      </ResponsiveEditDrawer>
    );
    expect(screen.getByText('Drawer content')).toBeVisible();
  });

  it('does not show children when closed', () => {
    renderWithProviders(
      <ResponsiveEditDrawer open={false} onClose={vi.fn()}>
        <div>Drawer content</div>
      </ResponsiveEditDrawer>
    );
    expect(screen.queryByText('Drawer content')).not.toBeInTheDocument();
  });

  it('anchors right on desktop', () => {
    installDesktopMatchMedia();
    renderWithProviders(
      <ResponsiveEditDrawer open onClose={vi.fn()}>
        <div>Drawer content</div>
      </ResponsiveEditDrawer>
    );
    expect(document.querySelector('.MuiDrawer-paperAnchorRight')).toBeInTheDocument();
    expect(document.querySelector('.MuiDrawer-paperAnchorBottom')).not.toBeInTheDocument();
  });

  it('anchors bottom on phone', () => {
    installPhoneMatchMedia();
    renderWithProviders(
      <ResponsiveEditDrawer open onClose={vi.fn()}>
        <div>Drawer content</div>
      </ResponsiveEditDrawer>
    );
    expect(document.querySelector('.MuiDrawer-paperAnchorBottom')).toBeInTheDocument();
    expect(document.querySelector('.MuiDrawer-paperAnchorRight')).not.toBeInTheDocument();
  });
});
