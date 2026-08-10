import type { Budget, BudgetItem, BudgetSection } from '../types';

function rateContribution(
  price: number,
  rateType: BudgetItem['rateType'],
  quantity: number
): number {
  return rateType === 'constant' ? price : price * quantity;
}

export function computeItemContribution(item: BudgetItem): number {
  if (item.alternatives?.length) {
    const selected = item.alternatives.find((alt) => alt.selected);
    if (!selected) return 0;
    return rateContribution(selected.price, selected.rateType, selected.quantity);
  }
  return rateContribution(item.price ?? 0, item.rateType, item.quantity);
}

export function computeSectionSubtotal(section: BudgetSection, items: BudgetItem[]): number {
  const sectionItems = items.filter((item) => item.budgetSectionId === section.id);
  if (sectionItems.length) {
    return sectionItems.reduce((sum, item) => sum + computeItemContribution(item), 0);
  }
  return section.price ?? 0;
}

export function computeBudgetTotal(
  budget: Budget,
  sections: BudgetSection[],
  items: BudgetItem[]
): number {
  const budgetSections = sections.filter((section) => section.budgetId === budget.id);
  return budgetSections.reduce((sum, section) => sum + computeSectionSubtotal(section, items), 0);
}
