import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { categories } from './categories';
import { namesForSearch, type AppState, type Search } from './domain';

export default function CategoryPicker({ state, search, onChange }: {
  state: AppState; search: Search; onChange: (categories: string[]) => void;
}) {
  const selected = search.categories ?? [];
  const [expanded, setExpanded] = useState(() => categories.slice(4).some(c => selected.includes(c.id)) || selected.includes('reported-low'));
  const matching = useMemo(() => namesForSearch(state, search).length, [state, search]);
  const button = (category: {id: string; label: string}) => <button
    key={category.id} type="button" aria-pressed={selected.includes(category.id)}
    className={selected.includes(category.id) ? 'chosen' : ''}
    onClick={() => onChange(selected.includes(category.id) ? selected.filter(id => id !== category.id) : [...selected, category.id])}
  >{category.label}</button>;
  return <fieldset className="form-group category-picker">
    <legend>סגנון או נושא <span className="optional">לא חובה</span></legend>
    <p className="fine-print">אפשר לבחור כמה קטגוריות: יוצגו שמות שמתאימים לפחות לאחת מהן. הסיווג מבוסס גם על פירושים אפשריים; שם יכול להשתייך לכמה קטגוריות.</p>
    <div className="chips">{categories.slice(0, 4).map(button)}</div>
    <button type="button" className="text-link category-expand" aria-expanded={expanded} aria-controls="more-categories" onClick={() => setExpanded(!expanded)}>
      {expanded ? 'פחות נושאים' : 'עוד נושאים'} <ChevronDown size={16} aria-hidden="true" />
    </button>
    <div id="more-categories" hidden={!expanded}>
      <div className="chips">{[...categories.slice(4), {id: 'reported-low', label: 'מעט ילידים מדווחים'}].map(button)}</div>
      <p className="fine-print">עדיין ללא סיווג: לא נמצא מספיק מידע לשיוך נושאי. מעט ילידים מדווחים: עד 100 ברשומות שפורסמו לילידי 2020–2024; הנתונים אינם כוללים את כל האוכלוסייה ולכן אינם מדד ודאי לנדירות.</p>
    </div>
    <p className="category-match" role="status">{matching.toLocaleString('he-IL')} שמות מתאימים לבחירה{matching === 0 ? ' — נסו להרחיב את הסינון.' : ''}</p>
  </fieldset>;
}
