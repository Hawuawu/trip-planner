import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlternativeMarker } from './AlternativeMarker';
import { SELECTED_MARKER_COLOR } from './mapConstants';
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
      <AlternativeMarker
        alternative={makeAlternative({ location: undefined })}
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
      <AlternativeMarker
        alternative={makeAlternative()}
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
      <AlternativeMarker
        alternative={makeAlternative()}
        isSelected
        onSelect={onSelect}
        onEdit={() => {}}
      />
    );
    expect(screen.getByTestId('popup')).toBeInTheDocument();
    expect(screen.getByText('Backup Shrine')).toBeInTheDocument();
    expect(screen.getByText('Kyoto')).toBeInTheDocument();
  });

  it('shows the popup whenever isSelected is true, and calls onSelect (to deselect) when its close action fires', () => {
    const onSelect = vi.fn();
    render(
      <AlternativeMarker
        alternative={makeAlternative()}
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
      <AlternativeMarker
        alternative={makeAlternative()}
        isSelected
        onSelect={() => {}}
        onEdit={() => {}}
      />
    );
    expect(screen.getByTestId('popup')).toBeInTheDocument();

    // Simulates the store deselecting this alternative because a different
    // item (another POI or a checkpoint) was just selected instead.
    rerender(
      <AlternativeMarker
        alternative={makeAlternative()}
        isSelected={false}
        onSelect={() => {}}
        onEdit={() => {}}
      />
    );
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
  });

  it('omits the location label line when none is provided', () => {
    render(
      <AlternativeMarker
        alternative={makeAlternative({ location: { lat: 34.9, lng: 135.77 } })}
        isSelected
        onSelect={() => {}}
        onEdit={() => {}}
      />
    );
    expect(screen.queryByText('Kyoto')).not.toBeInTheDocument();
  });

  it('calls onEdit when the popup edit button is clicked', () => {
    const onEdit = vi.fn();
    render(
      <AlternativeMarker
        alternative={makeAlternative()}
        isSelected
        onSelect={() => {}}
        onEdit={onEdit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit alternative' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('gives the selected marker a non-color signal (larger size), not color alone', () => {
    const { rerender } = render(
      <AlternativeMarker
        alternative={makeAlternative()}
        isSelected={false}
        onSelect={() => {}}
        onEdit={() => {}}
      />
    );
    const unselectedPin = screen.getByTestId('marker').firstElementChild as HTMLElement;
    const unselectedWidth = unselectedPin.style.width;

    rerender(
      <AlternativeMarker
        alternative={makeAlternative()}
        isSelected
        onSelect={() => {}}
        onEdit={() => {}}
      />
    );
    const selectedPin = screen.getByTestId('marker').firstElementChild as HTMLElement;
    expect(selectedPin.style.width).not.toBe(unselectedWidth);
  });

  it('uses the shared selected-marker color, not a shade of its own unselected purple', () => {
    render(
      <AlternativeMarker
        alternative={makeAlternative()}
        isSelected
        onSelect={() => {}}
        onEdit={() => {}}
      />
    );
    const pin = screen.getByTestId('marker').firstElementChild as HTMLElement;
    const probe = document.createElement('div');
    probe.style.background = SELECTED_MARKER_COLOR;
    expect(pin.style.background).toBe(probe.style.background);
  });
});
