import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { MapView } from './MapView';
import { renderWithProviders, resetStores } from '../../test/helpers';
import { useTripStore } from '../../store/tripStore';
import type { Checkpoint } from '../../types';

const easeTo = vi.fn();
const jumpTo = vi.fn();
const zoomIn = vi.fn();
const zoomOut = vi.fn();

vi.mock('react-map-gl/maplibre', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  AttributionControl: () => <div data-testid="attribution-control" />,
  Source: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="source">{children}</div>
  ),
  Layer: () => <div data-testid="layer" />,
  Marker: ({ children, onClick }: { children: React.ReactNode; onClick: (e: unknown) => void }) => (
    <button data-testid="marker" onClick={(e) => onClick({ originalEvent: e })}>
      {children}
    </button>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({ current: { easeTo, jumpTo, zoomIn, zoomOut } }),
}));

function makeCheckpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return {
    id: 'cp-1',
    type: 'poi',
    name: 'Fushimi Inari',
    startTime: '2026-09-05T09:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    location: { lat: 34.9, lng: 135.77 },
    ...overrides,
  };
}

beforeEach(() => {
  resetStores();
  easeTo.mockClear();
  jumpTo.mockClear();
  zoomIn.mockClear();
  zoomOut.mockClear();
});

describe('MapView', () => {
  it('renders a marker only for checkpoints that have a location', () => {
    useTripStore.setState({
      checkpoints: [makeCheckpoint({ id: 'a' }), makeCheckpoint({ id: 'b', location: undefined })],
    });

    renderWithProviders(<MapView />);
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
  });

  it('renders no route source data when fewer than two checkpoints have a location', () => {
    useTripStore.setState({ checkpoints: [makeCheckpoint({ id: 'a' })] });
    renderWithProviders(<MapView />);
    expect(screen.getAllByTestId('marker')).toHaveLength(1);
  });

  it('toggles the base-layer switcher open and closed', () => {
    renderWithProviders(<MapView />);

    expect(screen.queryByText('Base layer')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Toggle layer selector'));
    expect(screen.getByText('Base layer')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Toggle layer selector'));
    expect(screen.queryByText('Base layer')).not.toBeInTheDocument();
  });

  it('switches the map style when a different base layer is selected', () => {
    renderWithProviders(<MapView />);

    fireEvent.click(screen.getByLabelText('Toggle layer selector'));
    fireEvent.click(screen.getByText('Bright'));

    // Selecting a style closes the switcher again.
    expect(screen.queryByText('Base layer')).not.toBeInTheDocument();
  });

  it('eases the map to the selected checkpoint location', () => {
    useTripStore.setState({
      checkpoints: [makeCheckpoint({ id: 'a', location: { lat: 34.9, lng: 135.77 } })],
      selectedId: 'a',
    });

    renderWithProviders(<MapView />);
    expect(easeTo).toHaveBeenCalledWith({ center: [135.77, 34.9], duration: 300 });
  });

  it('does not ease the map when no checkpoint is selected', () => {
    useTripStore.setState({ checkpoints: [makeCheckpoint({ id: 'a' })], selectedId: null });
    renderWithProviders(<MapView />);
    expect(easeTo).not.toHaveBeenCalled();
  });

  it('toggles selection when a marker is clicked', () => {
    useTripStore.setState({ checkpoints: [makeCheckpoint({ id: 'a' })], selectedId: null });
    renderWithProviders(<MapView />);

    fireEvent.click(screen.getByTestId('marker'));
    expect(useTripStore.getState().selectedId).toBe('a');

    fireEvent.click(screen.getByTestId('marker'));
    expect(useTripStore.getState().selectedId).toBeNull();
  });

  it('renders the orientation ball and zoom controls', () => {
    renderWithProviders(<MapView />);
    expect(screen.getByRole('img', { name: /bearing and pitch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();
  });
});
