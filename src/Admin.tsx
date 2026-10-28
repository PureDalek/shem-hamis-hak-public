import {
  lazy,
  Suspense,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ChevronLeft, Download, Plus, X } from "lucide-react";
import {
  allNames,
  availableNames,
  catalogSource,
  isSafeHttpsUrl,
  makeId,
  normalize,
  type AppState,
  type NameRecord,
} from "./domain";
import { downloadJson } from "./storage";
import { cloudConfigured } from "./cloud-config";
import { categories } from "./categories";
const CloudAdmin = lazy(() => import("./CloudAdmin"));

type Props = {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  onBack: () => void;
};
export default function Admin({ state, setState, onBack }: Props) {
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const all = allNames(state);
  const record = all.find((name) => name.id === selected);
  const invalidNames = all.some(
    (name) =>
      !name.name.trim() ||
      (!name.hidden && name.genders.length === 0) ||
      Boolean(name.meaningSource && !isSafeHttpsUrl(name.meaningSource)),
  );
  const active = state.searches.find((search) => search.id === state.activeId);
  const sample = active ? availableNames(state, active).slice(0, 5) : [];
  const edit = (changes: Partial<NameRecord>) => {
    if (!record) return;
    setState((prev) => ({
      ...prev,
      overrides: {
        ...prev.overrides,
        [record.id]: { ...prev.overrides[record.id], ...changes },
      },
    }));
  };
  const add = () => {
    const name = normalize(newName);
    if (!name) return;
    const existing = all.find((n) => normalize(n.name) === name);
    if (existing) {
      setSelected(existing.id);
      setQuery(name);
      setNewName("");
      return;
    }
    const entry: NameRecord = {
      id: `editor:${makeId()}`,
      name,
      genders: ["boy", "girl"],
      observations: [],
    };
    setState((prev) => ({
      ...prev,
      extraCatalog: [...prev.extraCatalog, entry],
    }));
    setSelected(entry.id);
    setQuery(name);
    setNewName("");
  };
  return (
    <div className="screen">
      <div className="section-heading">
        <div>
          <span className="kicker">כלי עבודה</span>
          <h2>ניהול המאגר</h2>
          <p>
            {cloudConfigured
              ? "השינויים נשמרים כטיוטה במכשיר הזה. מנהלי האתר יכולים לפרסם אותם לכולם."
              : "השינויים נשמרים בדפדפן הזה. כדי לעדכן את האתר לכולם, מייצאים ומעדכנים את קובצי המקור בפרויקט."}
          </p>
        </div>
        <button
          className="icon-button"
          onClick={onBack}
          aria-label="חזרה לפרופיל"
        >
          <X size={20} />
        </button>
      </div>
      <div className="admin-settings">
        <label>
          סדר הצגת שמות
          <select
            value={state.settings.sort}
            onChange={(e) =>
              setState({
                ...state,
                settings: {
                  ...state.settings,
                  sort: e.target.value as AppState["settings"]["sort"],
                },
              })
            }
          >
            <option value="mixed">מגוון שמות</option>
            <option value="popular">נפוצים קודם</option>
            <option value="alphabetical">לפי א״ב</option>
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={state.settings.showStatistics}
            onChange={(e) =>
              setState({
                ...state,
                settings: {
                  ...state.settings,
                  showStatistics: e.target.checked,
                },
              })
            }
          />{" "}
          הצגת נתוני הלמ״ס בכרטיסים
        </label>
        <label>
          מספר שמות מרבי בטורניר
          <select
            value={state.settings.limitTournament}
            onChange={(e) =>
              setState({
                ...state,
                settings: {
                  ...state.settings,
                  limitTournament: Number(e.target.value),
                },
              })
            }
          >
            {[8, 16, 32].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        {state.settings.sort === "mixed" && (
          <div className="weight-settings">
            <strong>איזון ההמלצות</strong>
            <p>שנו את המשקלים וצפו בדוגמה לפי החיפוש הפעיל.</p>
            {(
              [
                ["variety", "גיוון"],
                ["popularity", "נפוצות לפי הנתונים הזמינים"],
                ["similarity", "דמיון לשמות שאהבו"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="weight-row">
                <span>
                  {label} · {state.settings.weights[key].toFixed(2)}
                </span>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={state.settings.weights[key]}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        weights: {
                          ...prev.settings.weights,
                          [key]: Number(e.target.value),
                        },
                      },
                    }))
                  }
                />
              </label>
            ))}
            {sample.length > 0 && (
              <div className="weight-preview">
                <small>דוגמה לחיפוש הזה</small>
                <div>{sample.map((name) => name.name).join(" · ")}</div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="admin-head">
        <h3>עריכת שמות</h3>
        <span>{all.length.toLocaleString("he-IL")} במאגר</span>
      </div>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
        }}
        placeholder="חיפוש שם לעריכה"
        aria-label="חיפוש שם לעריכה"
      />
      {query.trim() && (
        <div className="admin-results">
          {all
            .filter((n) => n.name.includes(query.trim()))
            .slice(0, 15)
            .map((n) => (
              <button key={n.id} onClick={() => setSelected(n.id)}>
                {n.name}
                {n.hidden ? " · מוסתר" : ""}
                <ChevronLeft size={16} />
              </button>
            ))}
        </div>
      )}
      <label className="admin-add-label" htmlFor="admin-new-name">
        הוספת שם למאגר
      </label>
      <div className="input-row">
        <input
          id="admin-new-name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="שם חדש"
          maxLength={50}
        />
        <button className="add-button" onClick={add} aria-label="הוספה למאגר">
          <Plus size={20} />
        </button>
      </div>
      {record && (
        <div className="admin-editor">
          <h3>עריכת {record.name}</h3>
          <label>
            שם
            <input
              value={record.name}
              onChange={(e) => edit({ name: e.target.value })}
              maxLength={50}
            />
          </label>
          <label>
            משמעות
            <textarea
              value={record.meaning ?? ""}
              onChange={(e) => edit({ meaning: e.target.value })}
              placeholder="הוסיפו משמעות שנבדקה"
            />
          </label>
          <label>
            מקור
            <input
              value={record.origin ?? ""}
              onChange={(e) => edit({ origin: e.target.value })}
              placeholder="מקור השם"
            />
          </label>
          <label>
            קישור למקור הפירוש (HTTPS)
            <input
              type="url"
              dir="ltr"
              value={record.meaningSource ?? ""}
              onChange={(e) => edit({ meaningSource: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={record.genders.includes("boy")}
              onChange={(e) =>
                edit({
                  genders: e.target.checked
                    ? [...new Set([...record.genders, "boy"])]
                    : record.genders.filter((g) => g !== "boy"),
                })
              }
            />{" "}
            מתאים לחיפוש לבן
          </label>
          <fieldset className="form-group">
            <legend>קטגוריות השם</legend>
            {categories.map(category => (
              <label className="check-row" key={category.id}>
                <input type="checkbox" checked={(record.tags ?? []).includes(category.id)}
                  onChange={e => edit({ tags: e.target.checked
                    ? [...new Set([...(record.tags ?? []), category.id])]
                    : (record.tags ?? []).filter(id => id !== category.id) })} /> {category.label}
              </label>
            ))}
          </fieldset>
          <label className="check-row">
            <input
              type="checkbox"
              checked={record.genders.includes("girl")}
              onChange={(e) =>
                edit({
                  genders: e.target.checked
                    ? [...new Set([...record.genders, "girl"])]
                    : record.genders.filter((g) => g !== "girl"),
                })
              }
            />{" "}
            מתאים לחיפוש לבת
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={!record.hidden}
              onChange={(e) => edit({ hidden: !e.target.checked })}
            />{" "}
            להציג בחיפושים
          </label>
          <p>
            השינויים נשמרים מקומית. מומלץ להוסיף פירושים רק לאחר בדיקת מקור.
          </p>
        </div>
      )}
      {cloudConfigured && (
        <Suspense fallback={null}>
          <CloudAdmin
            state={state}
            setState={setState}
            canPublish={!invalidNames}
          />
        </Suspense>
      )}
      {invalidNames && (
        <p role="alert" className="admin-error">
          יש שם ריק, שם גלוי שאינו משויך לחיפוש או קישור למקור שאינו מתחיל
          ב־https://. תקנו לפני ייצוא או פרסום.
        </p>
      )}
      <div className="admin-export">
        <button
          className="secondary-button"
          disabled={invalidNames}
          onClick={() =>
            downloadJson("catalog.json", {
              source: catalogSource,
              year: 2024,
              names: all,
            })
          }
        >
          <Download size={18} /> ייצוא מאגר מעודכן
        </button>
        <button
          className="secondary-button"
          onClick={() => downloadJson("settings.json", state.settings)}
        >
          <Download size={18} /> ייצוא הגדרות
        </button>
      </div>
      <p className="fine-print">
        הנחיות לעדכון האתר מופיעות בקובץ README בפרויקט.
      </p>
    </div>
  );
}
