import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CheckpointMarker } from './CheckpointMarker';
import type { Checkpoint } from '../../types';

vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children, onClick }: { children: React.ReactNode; onClick: (e: unknown) => void }) => (
    <button data-testid="marker" onClick={(e) => onClick({ originalEvent: e })}>
      {children}
    </button>
  ),
  Popup: ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div data-testid="popup">
      {children}
      <button data-testid="popup-close" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

function makeCheckpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return {
    id: 'cp-1',
    type: 'poi',
    name: 'Fushimi Inari',
    startTime: '2026-09-05T09:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    location: { lat: 34.9, lng: 135.77, label: 'Kyoto' },
    ...overrides,
  };
}

describe('CheckpointMarker', () => {
  it('renders nothing when the checkpoint has no location', () => {
    const { container } = render(
      <CheckpointMarker
        checkpoint={makeCheckpoint({ location: undefined })}
        isSelected={false}
        onSelect={() => {}}
        onEdit={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onSelect when clicked; the popup only appears once the parent reflects isSelected', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <CheckpointMarker
        checkpoint={makeCheckpoint()}
        isSelected={false}
        onSelect={onSelect}
        onEdit={() => {}}
      />
    );

    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('marker'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();

    rerender(
      <CheckpointMarker
        checkpoint={makeCheckpoint()}
        isSelected
        onSelect={onSelect}
        onEdit={() => {}}
      />
    );
    expect(screen.getByTestId('popup')).toBeInTheDocument();
    expect(screen.getByText('Fushimi Inari')).toBeInTheDocument();
    expect(screen.getByText('Kyoto')).toBeInTheDocument();
  });

  it('shows the popup whenever isSelected is true, and calls onSelect (to deselect) when its close action fires', () => {
    const onSelect = vi.fn();
    render(
      <CheckpointMarker
        checkpoint={makeCheckpoint()}
        isSelected
        onSelect={onSelect}
        onEdit={() => {}}
      />
    );
    expect(screen.getByTestId('popup')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('popup-close'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('at most one popup is ever shown: deselecting one marker while selecting another never leaves both open', () => {
    const { rerender } = render(
      <CheckpointMarker
        checkpoint={makeCheckpoint()}
        isSelected
        onSelect={() => {}}
        onEdit={() => {}}
      />
    );
    expect(screen.getByTestId('popup')).toBeInTheDocument();

    // Simulates the store deselecting this checkpoint because a different
    // item (another checkpoint or a POI) was just selected instead.
    rerender(
      <CheckpointMarker
        checkpoint={makeCheckpoint()}
        isSelected={false}
        onSelect={() => {}}
        onEdit={() => {}}
      />
    );
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });

  it('omits the location label line when none is provided', () => {
    render(
      <CheckpointMarker
        checkpoint={makeCheckpoint({ location: { lat: 34.9, lng: 135.77 } })}
        isSelected
        onSelect={() => {}}
        onEdit={() => {}}
      />
    );
    expect(screen.queryByText('Kyoto')).not.toBeInTheDocument();
  });

  it('gives the selected marker a non-color signal (larger size), not color alone', () => {
    const { rerender } = render(
      <CheckpointMarker
        checkpoint={makeCheckpoint()}
        isSelected={false}
        onSelect={() => {}}
        onEdit={() => {}}
      />
    );
    const unselectedPin = screen.getByTestId('marker').firstElementChild as HTMLElement;
    const unselectedWidth = unselectedPin.style.width;

    rerender(
      <CheckpointMarker
        checkpoint={makeCheckpoint()}
        isSelected
        onSelect={() => {}}
        onEdit={() => {}}
      />
    );
    const selectedPin = screen.getByTestId('marker').firstElementChild as HTMLElement;
    expect(selectedPin.style.width).not.toBe(unselectedWidth);
  });

  it('calls onEdit when the popup edit button is clicked, without re-triggering onSelect', () => {
    const onSelect = vi.fn();
    const onEdit = vi.fn();
    render(
      <CheckpointMarker
        checkpoint={makeCheckpoint()}
        isSelected
        onSelect={onSelect}
        onEdit={onEdit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit checkpoint' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
