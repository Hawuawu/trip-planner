import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlternativeMarker } from './AlternativeMarker';
import type { Alternative } from '../../types';

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

function makeAlternative(overrides: Partial<Alternative> = {}): Alternative {
  return {
    id: 'alt-1',
    type: 'poi',
    name: 'Backup Shrine',
    location: { lat: 34.9, lng: 135.77, label: 'Kyoto' },
    ...overrides,
  };
}

describe('AlternativeMarker', () => {
  it('renders nothing when the alternative has no location', () => {
    const { container } = render(
      <AlternativeMarker alternative={makeAlternative({ location: undefined })} onEdit={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('opens a popup with the alternative name when clicked', () => {
    render(<AlternativeMarker alternative={makeAlternative()} onEdit={() => {}} />);

    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('marker'));

    expect(screen.getByTestId('popup')).toBeInTheDocument();
    expect(screen.getByText('Backup Shrine')).toBeInTheDocument();
    expect(screen.getByText('Kyoto')).toBeInTheDocument();
  });

  it('closes the popup when its close action fires', () => {
    render(<AlternativeMarker alternative={makeAlternative()} onEdit={() => {}} />);

    fireEvent.click(screen.getByTestId('marker'));
    expect(screen.getByTestId('popup')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('popup-close'));
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });

  it('omits the location label line when none is provided', () => {
    render(
      <AlternativeMarker
        alternative={makeAlternative({ location: { lat: 34.9, lng: 135.77 } })}
        onEdit={() => {}}
      />
    );

    fireEvent.click(screen.getByTestId('marker'));
    expect(screen.queryByText('Kyoto')).not.toBeInTheDocument();
  });

  it('calls onEdit when the popup edit button is clicked', () => {
    const onEdit = vi.fn();
    render(<AlternativeMarker alternative={makeAlternative()} onEdit={onEdit} />);

    fireEvent.click(screen.getByTestId('marker'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit alternative' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
