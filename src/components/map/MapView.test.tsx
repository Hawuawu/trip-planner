import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapView } from './MapView';
import { renderWithProviders, resetStores } from '../../test/helpers';
import { useTripStore } from '../../store/tripStore';
import type { Checkpoint, Alternative } from '../../types';
import { getPoiAtPoint } from './poi';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useDeviceOrientation } from '../../hooks/useDeviceOrientation';

const mockedGetPoiAtPoint = vi.mocked(getPoiAtPoint);
const mockedUseGeolocation = vi.mocked(useGeolocation);
const mockedUseDeviceOrientation = vi.mocked(useDeviceOrientation);

const easeTo = vi.fn();
const jumpTo = vi.fn();
const zoomIn = vi.fn();
const zoomOut = vi.fn();
const getZoom = vi.fn(() => 10);
const on = vi.fn();
const off = vi.fn();

function triggerDragstart() {
  const handler = on.mock.calls.find(([event]) => event === 'dragstart')?.[1];
  act(() => {
    handler?.();
  });
}

vi.mock('./poi', () => ({ getPoiAtPoint: vi.fn() }));
vi.mock('../../hooks/useGeolocation', () => ({ useGeolocation: vi.fn() }));
vi.mock('../../hooks/useDeviceOrientation', () => ({ useDeviceOrientation: vi.fn() }));

vi.mock('react-map-gl/maplibre', () => ({
  default: ({
    children,
    onClick,
    onLoad,
  }: {
    children: React.ReactNode;
    onClick?: (e: unknown) => void;
    onLoad?: () => void;
  }) => (
    <div data-testid="map" onClick={() => onClick?.({})}>
      <button data-testid="trigger-load" onClick={() => onLoad?.()} />
      {children}
    </div>
  ),
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
  useMap: () => ({ current: { easeTo, jumpTo, zoomIn, zoomOut, getZoom, on, off } }),
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

function makeAlternative(overrides: Partial<Alternative> = {}): Alternative {
  return {
    id: 'alt-1',
    type: 'poi',
    name: 'Backup Shrine',
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
  getZoom.mockReset().mockReturnValue(10);
  on.mockClear();
  off.mockClear();
  mockedGetPoiAtPoint.mockReset();
  mockedUseGeolocation.mockReset();
  mockedUseDeviceOrientation.mockReset();
  mockedUseGeolocation.mockReturnValue({ position: null, error: null });
  mockedUseDeviceOrientation.mockReturnValue({
    heading: null,
    permissionState: 'prompt',
    requestPermission: vi.fn().mockResolvedValue(undefined),
  });
  // resetStores() merges in fresh data but preserves action function
  // references (see helpers.tsx) — vi.spyOn mutates those functions in
  // place, so a spy from one test otherwise leaks into the next.
  vi.restoreAllMocks();
});

describe('MapView', () => {
  describe('loading overlay', () => {
    it('shows a loading spinner over the map until onLoad fires, without unmounting map content', () => {
      useTripStore.setState({ checkpoints: [makeCheckpoint({ id: 'a' })] });
      renderWithProviders(<MapView />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByTestId('map')).toBeInTheDocument();
      expect(screen.getByTestId('marker')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('trigger-load'));

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      expect(screen.getByTestId('marker')).toBeInTheDocument();
    });
  });

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
    expect(easeTo).toHaveBeenCalledWith({ center: [135.77, 34.9], zoom: 15, duration: 300 });
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

  it('calls onPoiSelected when a click resolves to a POI', () => {
    mockedGetPoiAtPoint.mockReturnValue({
      name: 'Sensō-ji',
      location: { lat: 35.71, lng: 139.79 },
    });
    const onPoiSelected = vi.fn();
    renderWithProviders(<MapView onPoiSelected={onPoiSelected} />);

    fireEvent.click(screen.getByTestId('map'));

    expect(onPoiSelected).toHaveBeenCalledWith({
      name: 'Sensō-ji',
      location: { lat: 35.71, lng: 139.79 },
    });
  });

  it('does not call onPoiSelected when a click does not resolve to a POI', () => {
    mockedGetPoiAtPoint.mockReturnValue(null);
    const onPoiSelected = vi.fn();
    renderWithProviders(<MapView onPoiSelected={onPoiSelected} />);

    fireEvent.click(screen.getByTestId('map'));

    expect(onPoiSelected).not.toHaveBeenCalled();
  });

  describe('day / route filtering', () => {
    it('renders markers only for checkpoints on the selected day', () => {
      useTripStore.setState({
        checkpoints: [
          makeCheckpoint({ id: 'a', startTime: '2026-09-05T09:00:00.000Z' }),
          makeCheckpoint({ id: 'b', startTime: '2026-09-06T09:00:00.000Z' }),
        ],
        selectedDay: '2026-09-05',
      });
      renderWithProviders(<MapView />);
      expect(screen.getAllByTestId('marker')).toHaveLength(1);
    });

    it("renders markers only for a selected route's checkpointIds", () => {
      useTripStore.setState({
        checkpoints: [makeCheckpoint({ id: 'a' }), makeCheckpoint({ id: 'b' })],
        routes: [
          {
            id: 'route-1',
            name: 'Nature route',
            days: ['2026-09-05'],
            checkpointIds: ['a'],
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        selectedRouteId: 'route-1',
      });
      renderWithProviders(<MapView />);
      expect(screen.getAllByTestId('marker')).toHaveLength(1);
    });

    it('renders all located checkpoints when no day or route is selected', () => {
      useTripStore.setState({
        checkpoints: [
          makeCheckpoint({ id: 'a', startTime: '2026-09-05T09:00:00.000Z' }),
          makeCheckpoint({ id: 'b', startTime: '2026-09-06T09:00:00.000Z' }),
        ],
      });
      renderWithProviders(<MapView />);
      expect(screen.getAllByTestId('marker')).toHaveLength(2);
    });
  });

  describe('alternatives layer', () => {
    it('renders the "Show alternatives" switch checked by default', () => {
      renderWithProviders(<MapView />);
      fireEvent.click(screen.getByLabelText('Toggle layer selector'));
      expect(screen.getByRole('checkbox', { name: /show alternatives/i })).toBeChecked();
    });

    it('renders alternative markers by default', () => {
      useTripStore.setState({ alternatives: [makeAlternative()] });
      renderWithProviders(<MapView />);
      expect(screen.getAllByTestId('marker')).toHaveLength(1);
    });

    it('hides alternative markers when the switch is toggled off, and shows them again when toggled back on', () => {
      useTripStore.setState({ alternatives: [makeAlternative()] });
      renderWithProviders(<MapView />);
      expect(screen.getAllByTestId('marker')).toHaveLength(1);

      fireEvent.click(screen.getByLabelText('Toggle layer selector'));
      fireEvent.click(screen.getByRole('checkbox', { name: /show alternatives/i }));
      expect(screen.queryAllByTestId('marker')).toHaveLength(0);

      fireEvent.click(screen.getByRole('checkbox', { name: /show alternatives/i }));
      expect(screen.getAllByTestId('marker')).toHaveLength(1);
    });

    it('remembers the switch state across remounts (store-backed, not component-local)', () => {
      const { unmount } = renderWithProviders(<MapView />);
      fireEvent.click(screen.getByLabelText('Toggle layer selector'));
      fireEvent.click(screen.getByRole('checkbox', { name: /show alternatives/i }));
      expect(useTripStore.getState().showAlternativesOnMap).toBe(false);
      unmount();

      renderWithProviders(<MapView />);
      fireEvent.click(screen.getByLabelText('Toggle layer selector'));
      expect(screen.getByRole('checkbox', { name: /show alternatives/i })).not.toBeChecked();
    });

    it('skips alternatives without a location', () => {
      useTripStore.setState({
        alternatives: [
          makeAlternative({ id: 'a' }),
          makeAlternative({ id: 'b', location: undefined }),
        ],
      });
      renderWithProviders(<MapView />);
      expect(screen.getAllByTestId('marker')).toHaveLength(1);
    });

    it('narrows rendered alternatives to match the store search/tag filter', () => {
      useTripStore.setState({
        alternatives: [
          makeAlternative({ id: 'a', name: 'Backup Shrine' }),
          makeAlternative({ id: 'b', name: 'Other Spot' }),
        ],
        alternativesSearchFilter: 'shrine',
      });
      renderWithProviders(<MapView />);
      expect(screen.getAllByTestId('marker')).toHaveLength(1);
    });

    it('eases and zooms the map to the selected alternative location', () => {
      useTripStore.setState({
        alternatives: [makeAlternative({ id: 'alt-1', location: { lat: 35.0, lng: 135.75 } })],
        selectedAlternativeId: 'alt-1',
      });

      renderWithProviders(<MapView />);
      expect(easeTo).toHaveBeenCalledWith({ center: [135.75, 35.0], zoom: 15, duration: 300 });
    });

    it('does not ease the map when no alternative is selected', () => {
      useTripStore.setState({
        alternatives: [makeAlternative()],
        selectedAlternativeId: null,
      });
      renderWithProviders(<MapView />);
      expect(easeTo).not.toHaveBeenCalled();
    });

    it('does not zoom out when already zoomed in past the focus level', () => {
      getZoom.mockReturnValue(18);
      useTripStore.setState({
        checkpoints: [makeCheckpoint({ id: 'a', location: { lat: 34.9, lng: 135.77 } })],
        selectedId: 'a',
      });

      renderWithProviders(<MapView />);
      expect(easeTo).toHaveBeenCalledWith({ center: [135.77, 34.9], zoom: 18, duration: 300 });
    });
  });

  describe('locate control', () => {
    it('calls requestPermission before enabling tracking', async () => {
      const requestPermission = vi.fn().mockResolvedValue(undefined);
      mockedUseDeviceOrientation.mockReturnValue({
        heading: null,
        permissionState: 'prompt',
        requestPermission,
      });
      renderWithProviders(<MapView />);

      await userEvent.click(screen.getByRole('button', { name: 'Show my location' }));

      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Stop showing my location' })).toBeInTheDocument();
    });

    it('stops tracking without calling requestPermission again when toggled off', async () => {
      const requestPermission = vi.fn().mockResolvedValue(undefined);
      mockedUseDeviceOrientation.mockReturnValue({
        heading: null,
        permissionState: 'granted',
        requestPermission,
      });
      renderWithProviders(<MapView />);

      await userEvent.click(screen.getByRole('button', { name: 'Show my location' }));
      expect(requestPermission).toHaveBeenCalledTimes(1);

      await userEvent.click(screen.getByRole('button', { name: 'Stop showing my location' }));
      expect(requestPermission).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Show my location' })).toBeInTheDocument();
    });

    it('renders the location marker once a position is available', () => {
      mockedUseGeolocation.mockReturnValue({
        position: { lat: 35.68, lng: 139.69, accuracy: 5 },
        error: null,
      });
      mockedUseDeviceOrientation.mockReturnValue({
        heading: 90,
        permissionState: 'granted',
        requestPermission: vi.fn().mockResolvedValue(undefined),
      });
      renderWithProviders(<MapView />);

      expect(screen.getByRole('img', { name: 'Your location' })).toBeInTheDocument();
    });

    it('recenters the map once when tracking turns on and a position becomes available', async () => {
      mockedUseGeolocation.mockImplementation((enabled) =>
        enabled
          ? { position: { lat: 35.68, lng: 139.69, accuracy: 5 }, error: null }
          : { position: null, error: null }
      );
      mockedUseDeviceOrientation.mockReturnValue({
        heading: null,
        permissionState: 'granted',
        requestPermission: vi.fn().mockResolvedValue(undefined),
      });
      renderWithProviders(<MapView />);

      await userEvent.click(screen.getByRole('button', { name: 'Show my location' }));

      expect(easeTo).toHaveBeenCalledWith({ center: [139.69, 35.68], duration: 300 });
    });

    it('surfaces a geolocation error via onError once tracking is enabled', async () => {
      mockedUseGeolocation.mockReturnValue({
        position: null,
        error: 'Location access was denied.',
      });
      const onError = vi.fn();
      renderWithProviders(<MapView onError={onError} />);

      await userEvent.click(screen.getByRole('button', { name: 'Show my location' }));

      expect(onError).toHaveBeenCalledWith('Location access was denied.');
    });

    it('surfaces a denied compass permission via onError once tracking is enabled', async () => {
      mockedUseDeviceOrientation.mockReturnValue({
        heading: null,
        permissionState: 'denied',
        requestPermission: vi.fn().mockResolvedValue(undefined),
      });
      const onError = vi.fn();
      renderWithProviders(<MapView onError={onError} />);

      await userEvent.click(screen.getByRole('button', { name: 'Show my location' }));

      expect(onError).toHaveBeenCalledWith(
        'Compass access was denied — your position will show without a facing direction.'
      );
    });

    describe('pivoted zoom', () => {
      beforeEach(() => {
        mockedUseGeolocation.mockReturnValue({
          position: { lat: 35.68, lng: 139.69, accuracy: 5 },
          error: null,
        });
      });

      it('zoom buttons pivot around the live position while pivoted', async () => {
        renderWithProviders(<MapView />);
        await userEvent.click(screen.getByRole('button', { name: 'Show my location' }));
        easeTo.mockClear();

        fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));

        expect(easeTo).toHaveBeenCalledWith({ center: [139.69, 35.68], zoom: 11, duration: 220 });
        expect(zoomIn).not.toHaveBeenCalled();
      });

      it('a user drag exits pivoted mode, after which zoom buttons zoom in place', async () => {
        renderWithProviders(<MapView />);
        await userEvent.click(screen.getByRole('button', { name: 'Show my location' }));

        triggerDragstart();
        easeTo.mockClear();

        fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));

        expect(zoomIn).toHaveBeenCalledWith({ duration: 220 });
        expect(easeTo).not.toHaveBeenCalled();
      });

      it('a drag swaps the locate button to a "recenter" affordance instead of "stop"', async () => {
        renderWithProviders(<MapView />);
        await userEvent.click(screen.getByRole('button', { name: 'Show my location' }));

        triggerDragstart();

        expect(screen.getByRole('button', { name: 'Recenter on my location' })).toBeInTheDocument();
      });

      it('clicking to recenter after a drag re-engages pivoted mode without stopping tracking', async () => {
        renderWithProviders(<MapView />);
        await userEvent.click(screen.getByRole('button', { name: 'Show my location' }));
        triggerDragstart();

        await userEvent.click(screen.getByRole('button', { name: 'Recenter on my location' }));

        expect(
          screen.getByRole('button', { name: 'Stop showing my location' })
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
        expect(easeTo).toHaveBeenCalledWith({ center: [139.69, 35.68], zoom: 11, duration: 220 });
      });

      it('the dragstart listener is torn down when tracking stops', async () => {
        renderWithProviders(<MapView />);
        await userEvent.click(screen.getByRole('button', { name: 'Show my location' }));
        await userEvent.click(screen.getByRole('button', { name: 'Stop showing my location' }));

        expect(off).toHaveBeenCalledWith('dragstart', expect.any(Function));
      });
    });
  });

  describe('editing from a pin popup', () => {
    it('opens the checkpoint edit drawer, pre-filled, and selects the checkpoint', async () => {
      useTripStore.setState({ checkpoints: [makeCheckpoint({ id: 'a', name: 'Fushimi Inari' })] });
      renderWithProviders(<MapView />);

      fireEvent.click(screen.getByTestId('marker'));
      await userEvent.click(screen.getByRole('button', { name: 'Edit checkpoint' }));

      expect(screen.getByRole('heading', { name: /edit checkpoint/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('Fushimi Inari');
      expect(useTripStore.getState().selectedId).toBe('a');
    });

    it('saves edits to a checkpoint from the map drawer and reports success', async () => {
      useTripStore.setState({ checkpoints: [makeCheckpoint({ id: 'a', name: 'Fushimi Inari' })] });
      const spy = vi.fn().mockResolvedValue(undefined);
      useTripStore.setState({ updateCheckpoint: spy });
      const onSaved = vi.fn();
      renderWithProviders(<MapView onSaved={onSaved} />);

      fireEvent.click(screen.getByTestId('marker'));
      await userEvent.click(screen.getByRole('button', { name: 'Edit checkpoint' }));

      const nameInput = screen.getByRole('textbox', { name: /name/i });
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Fushimi Inari Shrine');
      await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

      expect(spy).toHaveBeenCalledWith(
        'a',
        expect.objectContaining({ name: 'Fushimi Inari Shrine' })
      );
      expect(onSaved).toHaveBeenCalledWith('Checkpoint "Fushimi Inari Shrine" updated.');
      expect(screen.queryByRole('heading', { name: /edit checkpoint/i })).not.toBeInTheDocument();
    });

    it('reports an error via onError when updateCheckpoint rejects', async () => {
      useTripStore.setState({ checkpoints: [makeCheckpoint({ id: 'a', name: 'Fushimi Inari' })] });
      const spy = vi.fn().mockRejectedValueOnce(new Error('network down'));
      useTripStore.setState({ updateCheckpoint: spy });
      const onError = vi.fn();
      renderWithProviders(<MapView onError={onError} />);

      fireEvent.click(screen.getByTestId('marker'));
      await userEvent.click(screen.getByRole('button', { name: 'Edit checkpoint' }));
      await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

      expect(onError).toHaveBeenCalledWith('network down');
    });

    it('cancelling the checkpoint edit drawer does not call updateCheckpoint', async () => {
      useTripStore.setState({ checkpoints: [makeCheckpoint({ id: 'a', name: 'Fushimi Inari' })] });
      const spy = vi.fn().mockResolvedValue(undefined);
      useTripStore.setState({ updateCheckpoint: spy });
      renderWithProviders(<MapView />);

      fireEvent.click(screen.getByTestId('marker'));
      await userEvent.click(screen.getByRole('button', { name: 'Edit checkpoint' }));
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(spy).not.toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: /edit checkpoint/i })).not.toBeInTheDocument();
    });

    it('opens the alternative edit drawer, pre-filled, and selects the alternative', async () => {
      useTripStore.setState({
        alternatives: [makeAlternative({ id: 'alt-1', name: 'Backup Shrine' })],
      });
      renderWithProviders(<MapView />);

      fireEvent.click(screen.getByTestId('marker'));
      await userEvent.click(screen.getByRole('button', { name: 'Edit alternative' }));

      expect(screen.getByRole('heading', { name: /edit alternative/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('Backup Shrine');
      expect(useTripStore.getState().selectedAlternativeId).toBe('alt-1');
    });

    it('saves edits to an alternative from the map drawer and reports success', async () => {
      useTripStore.setState({
        alternatives: [makeAlternative({ id: 'alt-1', name: 'Backup Shrine' })],
      });
      const spy = vi.fn().mockResolvedValue(undefined);
      useTripStore.setState({ updateAlternative: spy });
      const onSaved = vi.fn();
      renderWithProviders(<MapView onSaved={onSaved} />);

      fireEvent.click(screen.getByTestId('marker'));
      await userEvent.click(screen.getByRole('button', { name: 'Edit alternative' }));

      const nameInput = screen.getByRole('textbox', { name: /name/i });
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Backup Shrine 2');
      await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

      expect(spy).toHaveBeenCalledWith(
        'alt-1',
        expect.objectContaining({ name: 'Backup Shrine 2' })
      );
      expect(onSaved).toHaveBeenCalledWith('Alternative "Backup Shrine 2" updated.');
      expect(screen.queryByRole('heading', { name: /edit alternative/i })).not.toBeInTheDocument();
    });

    it('reports an error via onError when updateAlternative rejects', async () => {
      useTripStore.setState({
        alternatives: [makeAlternative({ id: 'alt-1', name: 'Backup Shrine' })],
      });
      const spy = vi.fn().mockRejectedValueOnce(new Error('network down'));
      useTripStore.setState({ updateAlternative: spy });
      const onError = vi.fn();
      renderWithProviders(<MapView onError={onError} />);

      fireEvent.click(screen.getByTestId('marker'));
      await userEvent.click(screen.getByRole('button', { name: 'Edit alternative' }));
      await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

      expect(onError).toHaveBeenCalledWith('network down');
    });

    it('cancelling the alternative edit drawer does not call updateAlternative', async () => {
      useTripStore.setState({
        alternatives: [makeAlternative({ id: 'alt-1', name: 'Backup Shrine' })],
      });
      const spy = vi.fn().mockResolvedValue(undefined);
      useTripStore.setState({ updateAlternative: spy });
      renderWithProviders(<MapView />);

      fireEvent.click(screen.getByTestId('marker'));
      await userEvent.click(screen.getByRole('button', { name: 'Edit alternative' }));
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(spy).not.toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: /edit alternative/i })).not.toBeInTheDocument();
    });

    it('opening the checkpoint edit drawer does not also show the alternative form, and vice versa', async () => {
      useTripStore.setState({
        checkpoints: [makeCheckpoint({ id: 'a', name: 'Fushimi Inari' })],
        alternatives: [makeAlternative({ id: 'alt-1', name: 'Backup Shrine' })],
      });
      renderWithProviders(<MapView />);

      const markers = screen.getAllByTestId('marker');
      fireEvent.click(markers[0]);
      await userEvent.click(screen.getByRole('button', { name: 'Edit checkpoint' }));

      expect(screen.getByRole('heading', { name: /edit checkpoint/i })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /edit alternative/i })).not.toBeInTheDocument();
    });
  });
});
