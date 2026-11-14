import type { Category } from '../types/budget';
import { matchesRule } from './budget/merchant';

export function guessCategory(
  description: string, 
  categories: Record<string, Category>, 
  rules: Record<string, string>
): string | undefined {
  for (const [rule, categoryId] of Object.entries(rules)) {
    if (matchesRule(description, rule)) {
      // Find if categoryId still exists in categories
      if (categories[categoryId]) {
        return categoryId;
      }
    }
  }

  return undefined;
}
