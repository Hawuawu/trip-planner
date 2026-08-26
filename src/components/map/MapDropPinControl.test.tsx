import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapDropPinControl } from './MapDropPinControl';

describe('MapDropPinControl', () => {
  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<MapDropPinControl active={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add point of interest' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('offers to add a point of interest when inactive', () => {
    render(<MapDropPinControl active={false} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Add point of interest' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('offers to cancel when active', () => {
    render(<MapDropPinControl active onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Cancel adding point of interest' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
