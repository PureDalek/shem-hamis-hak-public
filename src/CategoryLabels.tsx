import { categories } from './categories';

export default function CategoryLabels({ tags }: { tags?: string[] }) {
  return <div className="category-labels">{categories.filter(category => tags?.includes(category.id))
    .map(category => <span key={category.id}>{category.label}</span>)}</div>;
}
