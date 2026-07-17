import { describe, it, expect } from 'vitest';
import { CheckpointIcon } from '../components/timeline/CheckpointIcon';
import { renderWithProviders } from './helpers';
import type { CheckpointType } from '../types';

describe('CheckpointIcon', () => {
  const types: Array<{ type: CheckpointType; testId?: string; title: string }> = [
    { type: 'flight', title: 'flight icon' },
    { type: 'train', title: 'train icon' },
    { type: 'metro', title: 'metro icon' },
    { type: 'hotel', title: 'hotel icon' },
    { type: 'poi', title: 'poi icon' },
    { type: 'other', title: 'other icon' },
  ];

  types.forEach(({ type }) => {
    it(`renders an svg for type "${type}"`, () => {
      const { container } = renderWithProviders(<CheckpointIcon type={type} />);
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });

  it('passes extra SvgIconProps down (e.g. fontSize)', () => {
    const { container } = renderWithProviders(<CheckpointIcon type="flight" fontSize="large" />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.toString()).toMatch(/MuiSvgIcon-fontSizeLarge/);
  });

  it('renders a different svg element for each distinct type', () => {
    // Each type maps to a different MUI icon — verify by aria-label or path data-testid.
    // We confirm the icon class names differ between two clearly distinct types.
    const { container: c1 } = renderWithProviders(<CheckpointIcon type="flight" />);
    const { container: c2 } = renderWithProviders(<CheckpointIcon type="hotel" />);
    const path1 = c1.querySelector('svg path')?.getAttribute('d');
    const path2 = c2.querySelector('svg path')?.getAttribute('d');
    expect(path1).not.toEqual(path2);
  });
});
