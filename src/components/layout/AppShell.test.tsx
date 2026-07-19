import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { AppShell } from './AppShell';
import { renderWithProviders, resetStores } from '../../test/helpers';
import { useTripStore } from '../../store/tripStore';

vi.mock('react-map-gl/maplibre', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  NavigationControl: () => null,
  Source: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Layer: () => null,
  Marker: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div onClick={onClick}>{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ current: { easeTo: vi.fn() } }),
}));
vi.mock('maplibre-gl', () => ({ __esModule: true, default: {} }));

function installMatchMedia({ phone = false, wide = false }: { phone?: boolean; wide?: boolean }) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('max-width') ? phone : query.includes('min-width') ? wide : false,
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

beforeEach(() => {
  resetStores();
  installMatchMedia({});
});

describe('AppShell — tablet split layout (neither phone nor wide)', () => {
  it('renders both the timeline and alternatives panels, with both toggles', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    expect(screen.getByText(/no checkpoints yet/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Collapse timeline')).toBeInTheDocument();
    expect(screen.getByText(/no alternatives/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Collapse alternatives')).toBeInTheDocument();
  });

  it('collapses and expands the timeline panel via its toggle', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Collapse timeline'));
    expect(screen.queryByText(/no checkpoints yet/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Expand timeline')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Expand timeline'));
    expect(screen.getByText(/no checkpoints yet/i)).toBeInTheDocument();
  });

  it('collapses and expands the alternatives panel via its toggle', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Collapse alternatives'));
    expect(screen.queryByText(/no alternatives/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Expand alternatives')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Expand alternatives'));
    expect(screen.getByText(/no alternatives/i)).toBeInTheDocument();
  });
});

describe('AppShell — wide desktop layout', () => {
  beforeEach(() => {
    installMatchMedia({ wide: true });
  });

  it('renders the alternatives panel and both toggles', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    expect(screen.getByLabelText('Collapse timeline')).toBeInTheDocument();
    expect(screen.getByLabelText('Collapse alternatives')).toBeInTheDocument();
    expect(screen.getByText(/no alternatives/i)).toBeInTheDocument();
  });

  it('collapses and expands the alternatives panel via its toggle', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Collapse alternatives'));
    expect(screen.queryByText(/no alternatives/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Expand alternatives')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Expand alternatives'));
    expect(screen.getByText(/no alternatives/i)).toBeInTheDocument();
  });
});

describe('AppShell — phone layout', () => {
  beforeEach(() => {
    installMatchMedia({ phone: true });
  });

  it('renders bottom navigation and switches between tabs', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);

    expect(screen.getByText(/no checkpoints yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(screen.queryByText(/no checkpoints yet/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('map')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Alternatives' }));
    expect(screen.getByText(/no alternatives/i)).toBeInTheDocument();
  });
});

describe('AppShell — app bar', () => {
  it('falls back to "Maiyun\'s Trip Planner" when no trip is loaded', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);
    expect(screen.getByText("Maiyun's Trip Planner")).toBeInTheDocument();
  });

  it("shows the trip's name once one is loaded", () => {
    useTripStore.setState({
      trip: {
        id: 't1',
        name: 'Japan 2026',
        dateRange: { start: '2026-09-01', end: '2026-09-10' },
        memberIds: [],
      },
    });
    renderWithProviders(<AppShell onBack={vi.fn()} />);
    expect(screen.getByText('Japan 2026')).toBeInTheDocument();
  });

  it('does not render a sign-out button (sign-out lives only on the trip selector)', () => {
    renderWithProviders(<AppShell onBack={vi.fn()} />);
    expect(screen.queryByTitle('Sign out')).not.toBeInTheDocument();
  });

  it('shows the back button and calls onBack when clicked', () => {
    const onBack = vi.fn();
    renderWithProviders(<AppShell onBack={onBack} />);

    const backButton = screen.getByTitle('Back to trips');
    expect(backButton).toBeInTheDocument();

    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
