import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapLocateControl } from './MapLocateControl';

describe('MapLocateControl', () => {
  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<MapLocateControl tracking={false} pivoted={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show my location' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('offers to start showing location when tracking is off', () => {
    render(<MapLocateControl tracking={false} pivoted={false} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Show my location' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('offers to stop when tracking and pivoted (centered and following)', () => {
    render(<MapLocateControl tracking pivoted onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Stop showing my location' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('offers to recenter when tracking but not pivoted (panned away from the live position)', () => {
    render(<MapLocateControl tracking pivoted={false} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Recenter on my location' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
