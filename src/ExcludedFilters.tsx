import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { categories } from "./categories";
import type { Search } from "./domain";

const populationGroups = ["יהודים", "מוסלמים", "נוצרים ערבים", "דרוזים"];

export default function ExcludedFilters({
  search,
  onChange,
}: {
  search: Search;
  onChange: (next: Search) => void;
}) {
  const excluded = search.excludedCategories ?? [];
  const groups = search.excludedPopulationGroups ?? [];
  const [expanded, setExpanded] = useState(
    excluded.length > 0 || groups.length > 0,
  );
  return (
    <div className="exclude-picker">
      <button
        type="button"
        className="accordion-toggle"
        aria-expanded={expanded}
        aria-controls="excluded-filters"
        onClick={() => setExpanded(!expanded)}
      >
        <span>
          <span className="small-icon">−</span> מה לא להציג?{" "}
          <small>לא חובה</small>
        </span>
        <ChevronDown size={18} className={expanded ? "turned" : ""} />
      </button>
      <div id="excluded-filters" hidden={!expanded} className="exclude-content">
        <fieldset>
          <legend>ללא נושאים</legend>
          <p>
            שמות שמשויכים לאחד הנושאים שבחרתם לא יוצגו, גם אם הם מתאימים לנושא
            אחר שביקשתם. השיוך מבוסס על פירושים אפשריים.
          </p>
          <div className="chips">
            {[
              ...categories,
              { id: "reported-low", label: "מעט ילידים מדווחים" },
            ].map((category) => {
              const selected = excluded.includes(category.id);
              return (
                <button
                  type="button"
                  key={category.id}
                  className={selected ? "chosen" : ""}
                  aria-pressed={selected}
                  onClick={() =>
                    onChange({
                      ...search,
                      excludedCategories: selected
                        ? excluded.filter((id) => id !== category.id)
                        : [...excluded, category.id],
                      categories: selected
                        ? search.categories
                        : (search.categories ?? []).filter(
                            (id) => id !== category.id,
                          ),
                    })
                  }
                >
                  ללא {category.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend>ללא נתונים שפורסמו בקבוצות אוכלוסייה</legend>
          <p>
            לא יוצגו שמות שהלמ״ס פרסמה לגביהם נתונים בקבוצה שנבחרה לילידי
            2020–2024. נתונים חסרים אינם הוכחה ששם אינו קיים בקבוצה.
          </p>
          <div className="chips">
            {populationGroups.map((group) => {
              const selected = groups.includes(group);
              return (
                <button
                  type="button"
                  key={group}
                  className={selected ? "chosen" : ""}
                  aria-pressed={selected}
                  onClick={() =>
                    onChange({
                      ...search,
                      excludedPopulationGroups: selected
                        ? groups.filter((value) => value !== group)
                        : [...groups, group],
                    })
                  }
                >
                  ללא נתונים שפורסמו אצל {group}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
