import classified from './data/name-categories.json';

export const categories = classified.categories;

export function exclusionLabel(id: string): string {
  if (id === 'unclassified') return 'ללא שמות ללא סיווג';
  if (id === 'reported-low') return 'ללא שמות עם מעט ילידים מדווחים';
  return `ללא ${categories.find(category => category.id === id)?.label ?? id}`;
}

const assignments = classified.names as Record<string, string[]>;

export function initialCategories(name: string): string[] {
  return [...(Object.prototype.hasOwnProperty.call(assignments, name) ? assignments[name] : ['unclassified'])];
}
