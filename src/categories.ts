import classified from './data/name-categories.json';

export const categories = classified.categories;

const assignments = classified.names as Record<string, string[]>;

export function initialCategories(name: string): string[] {
  return [...(Object.prototype.hasOwnProperty.call(assignments, name) ? assignments[name] : ['unclassified'])];
}
