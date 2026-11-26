import RULES from './categories.json';

/** Kinds of items, for the list's filter. Checked in this order; the first match wins. */
export interface Category { id: string; code: string; label: string; tags: string[]; words: string[] }
export const CATEGORIES: Category[] = RULES;
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const categoryLabel = (id?: string) => CATEGORIES.find((c) => c.id === id)?.label ?? 'Other';
export const categoryFromCode = (code: string) => CATEGORIES.find((c) => c.code === code)?.id;

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const patterns = CATEGORIES.map((c) => ({ id: c.id, re: c.words.length ? new RegExp(`\\b(${c.words.join('|')})\\b`, 'i') : null }));

/** From Open Food Facts' category tags ("en:breads"). */
export function categoryFromTags(tags: unknown): string | undefined {
  if (!Array.isArray(tags) || !tags.length) return undefined;
  const plain = new Set(tags.filter((t): t is string => typeof t === 'string').map((t) => t.replace(/^[a-z]{2}:/, '')));
  return CATEGORIES.find((c) => c.tags.some((t) => plain.has(t)))?.id;
}

/** From words: a product name, or a database's own category name ("Breads & Buns"). */
export function categoryFromWords(text: string | undefined): string | undefined {
  if (!text?.trim()) return undefined;
  const t = fold(text);
  return patterns.find((p) => p.re?.test(t))?.id;
}

/** An item's category: the one it was given, or a guess from its name. */
export const categoryOf = (item: { category?: string; name: string; brand?: string }) => item.category ?? categoryFromWords(`${item.name} ${item.brand ?? ''}`) ?? 'other';
