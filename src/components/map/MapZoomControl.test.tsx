import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapZoomControl } from './MapZoomControl';
import { ZOOM_DURATION_MS } from './mapConstants';

const zoomIn = vi.fn();
const zoomOut = vi.fn();

vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: { zoomIn, zoomOut } }),
}));

beforeEach(() => {
  zoomIn.mockClear();
  zoomOut.mockClear();
});

describe('MapZoomControl', () => {
  it('zooms in when the + button is clicked', () => {
    render(<MapZoomControl />);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(zoomIn).toHaveBeenCalledWith({ duration: ZOOM_DURATION_MS });
  });

  it('zooms out when the - button is clicked', () => {
    render(<MapZoomControl />);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(zoomOut).toHaveBeenCalledWith({ duration: ZOOM_DURATION_MS });
  });
});
