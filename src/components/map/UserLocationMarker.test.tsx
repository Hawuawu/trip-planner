import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserLocationMarker } from './UserLocationMarker';

vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
}));

describe('UserLocationMarker', () => {
  it('renders nothing when position is null', () => {
    const { container } = render(<UserLocationMarker position={null} heading={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a dot but no cone when heading is null', () => {
    render(<UserLocationMarker position={{ lat: 35.68, lng: 139.69 }} heading={null} />);
    expect(screen.getByRole('img', { name: 'Your location' })).toBeInTheDocument();
    expect(document.querySelector('circle')).toBeInTheDocument();
    expect(document.querySelector('path')).not.toBeInTheDocument();
  });

  it('renders a cone rotated to match heading when heading is provided', () => {
    render(<UserLocationMarker position={{ lat: 35.68, lng: 139.69 }} heading={90} />);
    const group = document.querySelector('g');
    expect(group).toBeInTheDocument();
    expect(group?.getAttribute('transform')).toContain('rotate(90');
    expect(document.querySelector('path')).toBeInTheDocument();
  });
});
