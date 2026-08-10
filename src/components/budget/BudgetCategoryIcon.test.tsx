import { describe, it, expect } from 'vitest';
import { BudgetCategoryIcon } from './BudgetCategoryIcon';
import { renderWithProviders } from '../../test/helpers';
import type { BudgetCategory } from '../../types';

describe('BudgetCategoryIcon', () => {
  const categories: BudgetCategory[] = ['travel', 'hotel', 'meals', 'merchandise', 'other'];

  categories.forEach((category) => {
    it(`renders an svg for category "${category}"`, () => {
      const { container } = renderWithProviders(<BudgetCategoryIcon category={category} />);
      expect(container.querySelector('svg')).not.toBeNull();
    });
  });

  it('passes extra SvgIconProps down (e.g. fontSize)', () => {
    const { container } = renderWithProviders(
      <BudgetCategoryIcon category="travel" fontSize="large" />
    );
    const svg = container.querySelector('svg');
    expect(svg?.classList.toString()).toMatch(/MuiSvgIcon-fontSizeLarge/);
  });

  it('renders a different svg element for each distinct category', () => {
    const { container: c1 } = renderWithProviders(<BudgetCategoryIcon category="travel" />);
    const { container: c2 } = renderWithProviders(<BudgetCategoryIcon category="hotel" />);
    const path1 = c1.querySelector('svg path')?.getAttribute('d');
    const path2 = c2.querySelector('svg path')?.getAttribute('d');
    expect(path1).not.toEqual(path2);
  });
});
