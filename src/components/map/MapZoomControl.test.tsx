import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapZoomControl } from './MapZoomControl';
import { ZOOM_DURATION_MS } from './mapConstants';

const zoomIn = vi.fn();
const zoomOut = vi.fn();
const easeTo = vi.fn();
const getZoom = vi.fn(() => 10);

vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: { zoomIn, zoomOut, easeTo, getZoom } }),
}));

beforeEach(() => {
  zoomIn.mockClear();
  zoomOut.mockClear();
  easeTo.mockClear();
  getZoom.mockClear();
});

describe('MapZoomControl', () => {
  describe('free-move mode (not pivoted)', () => {
    it('zooms in when the + button is clicked', () => {
      render(<MapZoomControl pivoted={false} pivotPosition={null} />);
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      expect(zoomIn).toHaveBeenCalledWith({ duration: ZOOM_DURATION_MS });
      expect(easeTo).not.toHaveBeenCalled();
    });

    it('zooms out when the - button is clicked', () => {
      render(<MapZoomControl pivoted={false} pivotPosition={null} />);
      fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
      expect(zoomOut).toHaveBeenCalledWith({ duration: ZOOM_DURATION_MS });
      expect(easeTo).not.toHaveBeenCalled();
    });
  });

  describe('pivoted mode', () => {
    const position = { lat: 35.68, lng: 139.69 };

    it('zooms in anchored to the pivot position instead of the current map center', () => {
      render(<MapZoomControl pivoted pivotPosition={position} />);
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      expect(easeTo).toHaveBeenCalledWith({
        center: [139.69, 35.68],
        zoom: 11,
        duration: ZOOM_DURATION_MS,
      });
      expect(zoomIn).not.toHaveBeenCalled();
    });

    it('zooms out anchored to the pivot position', () => {
      render(<MapZoomControl pivoted pivotPosition={position} />);
      fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
      expect(easeTo).toHaveBeenCalledWith({
        center: [139.69, 35.68],
        zoom: 9,
        duration: ZOOM_DURATION_MS,
      });
      expect(zoomOut).not.toHaveBeenCalled();
    });

    it('falls back to plain zoom when pivoted but no position is available yet', () => {
      render(<MapZoomControl pivoted pivotPosition={null} />);
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      expect(zoomIn).toHaveBeenCalledWith({ duration: ZOOM_DURATION_MS });
      expect(easeTo).not.toHaveBeenCalled();
    });
  });
});
