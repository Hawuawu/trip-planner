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
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onSelect and opens a popup with the checkpoint name when clicked', () => {
    const onSelect = vi.fn();
    render(
      <CheckpointMarker checkpoint={makeCheckpoint()} isSelected={false} onSelect={onSelect} />
    );

    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('marker'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('popup')).toBeInTheDocument();
    expect(screen.getByText('Fushimi Inari')).toBeInTheDocument();
    expect(screen.getByText('Kyoto')).toBeInTheDocument();
  });

  it('closes the popup when its close action fires', () => {
    render(<CheckpointMarker checkpoint={makeCheckpoint()} isSelected onSelect={() => {}} />);

    fireEvent.click(screen.getByTestId('marker'));
    expect(screen.getByTestId('popup')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('popup-close'));
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });

  it('omits the location label line when none is provided', () => {
    render(
      <CheckpointMarker
        checkpoint={makeCheckpoint({ location: { lat: 34.9, lng: 135.77 } })}
        isSelected={false}
        onSelect={() => {}}
      />
    );

    fireEvent.click(screen.getByTestId('marker'));
    expect(screen.queryByText('Kyoto')).not.toBeInTheDocument();
  });
});
