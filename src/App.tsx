import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Admin from "./Admin";
import Compare from "./Compare";
import NameDetails from "./NameDetails";
import NameDetailsDialog from "./NameDetailsDialog";
import CategoryPicker from "./CategoryPicker";
import CategoryLabels from "./CategoryLabels";
import SimilarNames from "./SimilarNames";
import { categories } from "./categories";
import { cloudConfigured } from "./cloud-config";
import {
  ArrowLeft,
  Baby,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Heart,
  Info,
  Plus,
  RotateCcw,
  Settings2,
  Sparkles,
  Star,
  Trophy,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import {
  allNames,
  applyDecision,
  applyDiscoveryDecision,
  availableNames,
  discoveryProgress,
  chooseTournament,
  initialState,
  makeId,
  newSearch,
  normalize,
  numerology,
  startTournament,
  undo,
  type AppState,
  type Gender,
  type NameRecord,
  type Screen,
  type Search,
} from "./domain";
import {
  clearRecovery,
  downloadJson,
  downloadText,
  load,
  parseBackup,
  readRecovery,
  reconcilePublishedSettings,
  save,
} from "./storage";

const CloudAccount = lazy(() => import("./CloudAccount"));
const genderLabel: Record<Gender, string> = {
  boy: "בן",
  girl: "בת",
  unisex: "יוניסקס",
};
const numberWords = [
  "",
  "עצמאות ויוזמה",
  "רגישות ושיתוף",
  "יצירתיות וביטוי",
  "יציבות והתמדה",
  "חופש וסקרנות",
  "אהבה ואחריות",
  "התבוננות וחיפוש",
  "שאפתנות ועשייה",
  "נתינה וחמלה",
];
const tabs: { id: Screen; label: string; icon: typeof Heart }[] = [
  { id: "discover", label: "דפדוף", icon: Sparkles },
  { id: "saved", label: "הרשימה שלי", icon: Heart },
  { id: "tournament", label: "טורניר", icon: Trophy },
  { id: "profile", label: "פרופיל", icon: UserRound },
];
const lookup = (state: AppState, search: Search) =>
  new Map([...allNames(state), ...search.customNames].map((n) => [n.id, n]));
const reportedFiveYearCount = (name: NameRecord) => {
  const observations = name.observations.filter(o => o.year >= 2020 && o.year <= 2024);
  return observations.length ? observations.reduce((sum, o) => sum + o.count, 0) : null;
};

function App() {
  const [state, setState] = useState<AppState>(load);
  const [screen, setScreen] = useState<Screen>(() =>
    load().activeId ? "discover" : "setup",
  );
  const [draft, setDraft] = useState<Search>(() => newSearch());
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState(false);
  const [numericOpen, setNumericOpen] = useState(false);
  const [numberInfo, setNumberInfo] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [listTab, setListTab] = useState<"like" | "pass">("like");
  const [listQuery, setListQuery] = useState("");
  const [listSort, setListSort] = useState<"recent" | "alphabetical" | "reported">("recent");
  const [detailsNameId, setDetailsNameId] = useState<string | null>(null);
  const [similarNameId, setSimilarNameId] = useState<string | null>(null);
  const similarPanelRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [recovery, setRecovery] = useState(readRecovery);
  const backupInput = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalOpen = numberInfo !== null;
  const active = state.searches.find((s) => s.id === state.activeId);
  const names = useMemo(
    () => (active ? lookup(state, active) : new Map<string, NameRecord>()),
    [state, active],
  );
  const available = useMemo(
    () => (active ? availableNames(state, active) : []),
    [state, active],
  );
  const current = available[0];
  const progress = useMemo(() => active ? discoveryProgress(state, active) : null, [state, active]);
  const detailsName = detailsNameId ? names.get(detailsNameId) : undefined;
  const similarReference = similarNameId ? names.get(similarNameId) : undefined;
  const liked = active
    ? Object.entries(active.decisions)
        .filter(([, d]) => d === "like")
        .map(([id]) => id)
        .filter((id) => names.has(id))
    : [];
  const passed = active
    ? Object.entries(active.decisions)
        .filter(([, d]) => d === "pass")
        .map(([id]) => id)
        .filter((id) => names.has(id))
    : [];
  const listIds = listTab === "like" ? liked : passed;
  const listOrder = new Map(listIds.map((id, index) => [id, index]));
  const historyOrder = new Map(active?.history.map((entry, index) => [entry.id, index]) ?? []);
  const visibleListIds = listIds.filter(id =>
    normalize(names.get(id)!.name).toLocaleLowerCase("he").includes(normalize(listQuery).toLocaleLowerCase("he"))
  ).sort((a, b) => {
    const first = names.get(a)!;
    const second = names.get(b)!;
    if (listSort === "alphabetical") return first.name.localeCompare(second.name, "he");
    if (listSort === "reported" && state.settings.showStatistics) {
      return (reportedFiveYearCount(second) ?? -1) - (reportedFiveYearCount(first) ?? -1) || first.name.localeCompare(second.name, "he");
    }
    return (historyOrder.get(b) ?? -1) - (historyOrder.get(a) ?? -1) || listOrder.get(b)! - listOrder.get(a)!;
  });
  useEffect(() => {
    if (similarNameId && screen === "saved") {
      similarPanelRef.current?.scrollIntoView({ block: "start" });
      similarPanelRef.current?.querySelector<HTMLElement>("#similar-title")?.focus({ preventScroll: true });
    }
  }, [similarNameId, screen]);
  useEffect(() => {
    setSimilarNameId(null);
    setListQuery("");
  }, [active?.id]);
  useEffect(() => {
    try {
      save(state);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [state]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = modalRef.current;
    const controls = Array.from(
      dialog?.querySelectorAll<HTMLButtonElement>("button") ?? [],
    );
    controls[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNumberInfo(null);
      if (event.key !== "Tab" || controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [modalOpen]);

  const updateSearch = (fn: (search: Search) => Search) =>
    setState((prev) => ({
      ...prev,
      searches: prev.searches.map((s) => (s.id === prev.activeId ? fn(s) : s)),
    }));
  const flash = (text: string) => setNotice(text);
  const decide = (id: string, value: "like" | "pass") => {
    setState(prev => ({ ...prev, searches: prev.searches.map(s => s.id !== prev.activeId ? s
      : screen === "discover" ? applyDiscoveryDecision(prev, s, id, value) : applyDecision(s, id, value)) }));
  };
  const setSearchScreen = (value: Screen) => {
    if (!active && !["setup", "searches", "profile", "admin"].includes(value))
      setScreen("setup");
    else setScreen(value);
    setInput("");
  };
  const editSearch = () => {
    setDraft(active ? structuredClone(active) : newSearch());
    setEditing(Boolean(active));
    setNumericOpen(false);
    setScreen("setup");
  };
  const createSearch = () => {
    setDraft(newSearch());
    setInput("");
    setEditing(false);
    setNumericOpen(false);
    setScreen("setup");
  };
  const saveDraft = () => {
    const clean = {
      ...draft,
      firstName: draft.firstName.trim(),
      surname: draft.surname.trim(),
    };
    setState((prev) => ({
      ...prev,
      activeId: clean.id,
      searches: editing
        ? prev.searches.map((s) => (s.id === clean.id ? clean : s))
        : [...prev.searches, clean],
    }));
    setScreen("discover");
  };
  const addInspiration = () => {
    const text = normalize(input);
    if (text && !draft.inspirations.includes(text))
      setDraft({ ...draft, inspirations: [...draft.inspirations, text] });
    setInput("");
  };
  const addCustom = () => {
    const text = normalize(input);
    if (!text || !active) return;
    const matches = [...names.values()].filter(
      (n) => normalize(n.name).toLocaleLowerCase("he") === text.toLocaleLowerCase("he"),
    );
    const existing = matches.find(n => active.decisions[n.id] === "like") ?? matches[0];
    if (existing && active.decisions[existing.id] === "like") {
      setInput("");
      flash("השם כבר נמצא ברשימה שלכם");
      return;
    }
    if (existing) updateSearch((s) => applyDecision(s, existing.id, "like"));
    else {
      const entry: NameRecord = {
        id: `custom:${makeId()}`,
        name: text,
        genders: ["boy", "girl"],
        observations: [],
        custom: true,
      };
      updateSearch((s) =>
        applyDecision(
          { ...s, customNames: [...s.customNames, entry] },
          entry.id,
          "like",
        ),
      );
    }
    setInput("");
    flash("השם נוסף לרשימה");
  };
  const changeScreen = (target: Screen) => {
    setSearchScreen(target);
    if (target === "tournament" && active)
      setSelected(liked.slice(-state.settings.limitTournament));
  };
  const savedCount = liked.length;
  const likedNames = liked
    .map((id) => names.get(id))
    .filter((name): name is NameRecord => Boolean(name));
  const shortNames = likedNames.filter((name) => {
    const length = Array.from(normalize(name.name)).filter((letter) =>
      /\p{L}/u.test(letter),
    ).length;
    return length > 0 && length <= 3;
  }).length;
  const numberCounts = likedNames.reduce<Record<number, number>>(
    (counts, name) => {
      const number = numerology(name.name);
      if (number) counts[number] = (counts[number] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const topNumber = Object.entries(numberCounts).sort((a, b) => b[1] - a[1])[0];
  const heroTitle =
    screen === "setup"
      ? "מתחילים מסיפור קטן"
      : screen === "saved"
        ? "השמות שעשו לכם משהו"
        : screen === "tournament"
          ? "הבחירה הגדולה"
          : screen === "profile"
            ? "קצת עליכם"
            : screen === "admin"
              ? "מאחורי הקלעים"
              : screen === "searches"
                ? "כל החיפושים שלכם"
                : "שם אחד יכול להרגיש כמו בית";

  return (
    <div className="app-shell" dir="rtl">
      <header className="topbar">
        <div className="topbar-inner">
          <button
            className="brand"
            onClick={() => (active ? changeScreen("discover") : createSearch())}
            aria-label="שם המשחק, לעמוד הראשי"
          >
            <span className="brand-symbol">
              <Star size={19} fill="currentColor" />
            </span>
            <span>
              שם<span className="brand-red"> המשחק</span>
            </span>
          </button>
          <div className="top-actions">
            <button
              className="quiet-button desktop-action"
              onClick={() => setScreen("searches")}
            >
              החיפושים שלי
            </button>
            {active && (
              <button
                className="saved-pill"
                onClick={() => changeScreen("saved")}
              >
                <Heart size={16} fill="currentColor" />{" "}
                <span>{savedCount} שמורים</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className={`layout ${screen === "setup" ? "setup-layout" : ""}`}>
        <aside className="intro-panel">
          <div className="intro-top">
            <span className="eyebrow">
              <span className="eyebrow-dot" /> משחק קטן לבחירה גדולה
            </span>
            <h1>
              {heroTitle}
              <span className="title-spark">✳</span>
            </h1>
            <p>
              כי למצוא שם זה לא רק לבחור מילה.
              <br />
              זה למצוא את ההרגשה הנכונה.
            </p>
          </div>
          <div className="intro-bottom">
            <div className="scribble">
              אולי השם הבא
              <br />
              הוא בדיוק זה <span>↙</span>
            </div>
            <div className="mini-stack">
              <span>שם</span>
              <span>שלכם</span>
              <span>♡</span>
            </div>
          </div>
          <div className="intro-foot">
            <span>נוצר באהבה, למשפחות שבדרך</span>
            <span>♡</span>
          </div>
        </aside>

        <section className="work-panel" aria-live="polite">
          {screen === "setup" && (
            <div className="screen setup-screen">
              <div className="section-heading">
                <div>
                  <span className="kicker">נעים להכיר</span>
                  <h2>למי מחפשים שם?</h2>
                  <p>כמה בחירות קטנות, ונתחיל לגלות.</p>
                </div>
                {state.searches.length > 0 && (
                  <button
                    className="icon-button"
                    onClick={() => setScreen(active ? "discover" : "searches")}
                    aria-label="ביטול"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
              <div className="choice-card selected">
                <div className="choice-icon">
                  <Baby size={23} />
                </div>
                <div>
                  <strong>תינוק או תינוקת</strong>
                  <small>מתחילים מסיפור חדש</small>
                </div>
                <Check size={19} />
              </div>
              <fieldset className="form-group">
                <legend>בן, בת או גם וגם?</legend>
                <div className="segmented three">
                  {(["boy", "girl", "unisex"] as Gender[]).map((g) => (
                    <button
                      type="button"
                      key={g}
                      className={draft.gender === g ? "active" : ""}
                      onClick={() => setDraft({ ...draft, gender: g })}
                      aria-pressed={draft.gender === g}
                    >
                      {genderLabel[g]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <CategoryPicker state={state} search={draft} onChange={categories => setDraft({ ...draft, categories })} />
              <div className="filter-fields">
                <label className="field-label">אורך השם <span>לא חובה</span>
                  <select value={draft.lengthFilter ?? ""} onChange={e => setDraft({ ...draft, lengthFilter: (e.target.value || undefined) as Search["lengthFilter"] })}>
                    <option value="">כל האורכים</option><option value="short">עד 3 אותיות</option><option value="medium">4 אותיות</option><option value="long">5 אותיות ומעלה</option>
                  </select>
                </label>
                <label className="field-label">אות ראשונה <span>לא חובה</span>
                  <select value={draft.firstLetter ?? ""} onChange={e => setDraft({ ...draft, firstLetter: e.target.value || undefined })}>
                    <option value="">כל האותיות</option>{Array.from("אבגדהוזחטיכלמנסעפצקרשת").map(letter => <option key={letter} value={letter}>{letter}</option>)}
                  </select>
                </label>
              </div>
              <fieldset className="form-group">
                <legend>איזה שם מחפשים?</legend>
                <div className="segmented">
                  <button
                    className={draft.nameType === "first" ? "active" : ""}
                    onClick={() => setDraft({ ...draft, nameType: "first" })}
                    aria-pressed={draft.nameType === "first"}
                  >
                    שם ראשון
                  </button>
                  <button
                    className={draft.nameType === "middle" ? "active" : ""}
                    onClick={() => setDraft({ ...draft, nameType: "middle" })}
                    aria-pressed={draft.nameType === "middle"}
                  >
                    שם אמצעי
                  </button>
                </div>
              </fieldset>
              {draft.nameType === "middle" && (
                <label className="form-group field-label">
                  השם הראשון <span>לא חובה</span>
                  <input
                    value={draft.firstName}
                    onChange={(e) =>
                      setDraft({ ...draft, firstName: e.target.value })
                    }
                    placeholder="כדי לראות איך השמות נשמעים ביחד"
                    maxLength={50}
                  />
                </label>
              )}
              <div className="form-group">
                <label htmlFor="inspiration">
                  שמות שכבר אהבתם <span className="optional">לא חובה</span>
                </label>
                <div className="input-row">
                  <input
                    id="inspiration"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addInspiration()}
                    placeholder="למשל, השם של סבתא"
                    maxLength={50}
                  />
                  <button
                    className="add-button"
                    onClick={addInspiration}
                    aria-label="הוספת שם"
                  >
                    <Plus size={21} />
                  </button>
                </div>
                {draft.inspirations.length > 0 && (
                  <div className="chips">
                    {draft.inspirations.map((n) => (
                      <button
                        key={n}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            inspirations: draft.inspirations.filter(
                              (x) => x !== n,
                            ),
                          })
                        }
                      >
                        {n} <X size={13} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="accordion">
                <button
                  className="accordion-toggle"
                  onClick={() => setNumericOpen(!numericOpen)}
                  aria-expanded={numericOpen}
                >
                  <span>
                    <span className="small-icon">✳</span> סינון לפי נומרולוגיה{" "}
                    <small>לא חובה</small>
                  </span>
                  <ChevronDown
                    size={18}
                    className={numericOpen ? "turned" : ""}
                  />
                </button>
                {numericOpen && (
                  <div className="accordion-content">
                    <p>בחרו מספר אחד או יותר. בלי בחירה יוצגו כל השמות.</p>
                    <div className="number-grid">
                      {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          className={draft.numbers.includes(n) ? "chosen" : ""}
                          onClick={() =>
                            setDraft({
                              ...draft,
                              numbers: draft.numbers.includes(n)
                                ? draft.numbers.filter((x) => x !== n)
                                : [...draft.numbers, n],
                            })
                          }
                          aria-pressed={draft.numbers.includes(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <button
                      className="text-link"
                      onClick={() => setNumberInfo(1)}
                    >
                      מה המשמעות של המספרים?
                    </button>
                  </div>
                )}
              </div>
              <label className="form-group field-label">
                שם משפחה <span>לא חובה</span>
                <input
                  value={draft.surname}
                  onChange={(e) =>
                    setDraft({ ...draft, surname: e.target.value })
                  }
                  placeholder="נציג אותו לצד השמות"
                  maxLength={50}
                />
              </label>
              <button className="primary-button" onClick={saveDraft}>
                יאללה, מתחילים <ArrowLeft size={19} />
              </button>
              <p className="fine-print">אפשר לשנות את הבחירות בכל רגע.</p>
            </div>
          )}

          {screen === "discover" && active && (
            <div className="screen discover-screen">
              <div className="screen-top">
                <div>
                  <span className="kicker">זמן להכיר</span>
                  <h2>בואו נמצא את השם</h2>
                  <p>
                    {genderLabel[active.gender]} ·{" "}
                    {active.nameType === "first" ? "שם ראשון" : "שם אמצעי"}{" "}
                    <button className="inline-link" onClick={editSearch}>
                      שינוי חיפוש
                    </button>
                  </p>
                </div>
                <div className="round-badge">✳</div>
              </div>
              {((active.categories?.length ?? 0) > 0 || active.numbers.length > 0 || active.lengthFilter || active.firstLetter) && (
                <div className="active-filters" aria-label="סינונים פעילים">
                  <span>סינונים פעילים:</span>
                  {(active.categories ?? []).map(id => <button key={id} onClick={() => updateSearch(s => ({ ...s, categories: (s.categories ?? []).filter(category => category !== id) }))} aria-label={`הסרת סינון ${categories.find(c => c.id === id)?.label ?? (id === 'reported-low' ? 'מעט ילידים מדווחים' : id)}`}>
                    {categories.find(c => c.id === id)?.label ?? (id === 'reported-low' ? 'מעט ילידים מדווחים' : id)} <X size={13} />
                  </button>)}
                  {active.numbers.map(number => <button key={number} onClick={() => updateSearch(s => ({ ...s, numbers: s.numbers.filter(n => n !== number) }))} aria-label={`הסרת סינון מספר ${number}`}>מספר {number} <X size={13} /></button>)}
                  {active.lengthFilter && <button onClick={() => updateSearch(s => ({ ...s, lengthFilter: undefined }))} aria-label="הסרת סינון אורך">{active.lengthFilter === 'short' ? 'עד 3 אותיות' : active.lengthFilter === 'medium' ? '4 אותיות' : '5 אותיות ומעלה'} <X size={13} /></button>}
                  {active.firstLetter && <button onClick={() => updateSearch(s => ({ ...s, firstLetter: undefined }))} aria-label={`הסרת סינון אות ${active.firstLetter}`}>אות {active.firstLetter} <X size={13} /></button>}
                </div>
              )}
              {current ? (
                <>
                  <div className="name-card" key={current.id}>
                    <div className="card-top">
                      <span className="card-chip">
                        <span>✦</span> שם להכיר
                      </span>
                      <button
                        className="number-badge"
                        onClick={() => setNumberInfo(numerology(current.name))}
                        aria-label={`מספר נומרולוגי ${numerology(current.name) ?? "לא ידוע"}`}
                      >
                        {numerology(current.name) ?? "—"} <Info size={14} />
                      </button>
                    </div>
                    <div className="card-center">
                      <div className="card-ornament">✻</div>
                      <span className="name-label">אולי קוראים לי</span>
                      <div className="display-name">{current.name}</div>
                      {state.settings.showStatistics && current.observations.length > 0 && (
                        <div className="reported-count">לפחות {current.observations.filter(o => o.year >= 2020 && o.year <= 2024).reduce((sum, o) => sum + o.count, 0).toLocaleString('he-IL')} ילידי 2020–2024 בקבוצות שפורסמו*</div>
                      )}
                      <CategoryLabels tags={current.tags} />
                      {(active.firstName || active.surname) && (
                        <div className="fullname">
                          {[active.firstName, current.name, active.surname]
                            .filter(Boolean)
                            .join(" ")}
                        </div>
                      )}
                      <span className="card-line" />
                    </div>
                    <div className="card-bottom">
                      <button
                        className="details-toggle"
                        onClick={() => setDetails(!details)}
                        aria-expanded={details}
                      >
                        <span>
                          <BookOpen size={16} /> קצת על השם
                        </span>
                        <ChevronDown
                          size={18}
                          className={details ? "turned" : ""}
                        />
                      </button>
                      {details && (
                        <NameDetails name={current} showStatistics={state.settings.showStatistics} />
                      )}
                    </div>
                  </div>
                  <div className="decision-row">
                    <button
                      className="decision no"
                      onClick={() => decide(current.id, "pass")}
                    >
                      <X size={23} />
                      <span>פחות בשבילי</span>
                    </button>
                    <button
                      className="decision yes"
                      onClick={() => decide(current.id, "like")}
                    >
                      <Heart size={21} fill="currentColor" />
                      <span>אהבתי!</span>
                    </button>
                  </div>
                  <button
                    className="undo"
                    disabled={!active.history.length}
                    onClick={() => {
                      updateSearch(undo);
                    }}
                  >
                    <RotateCcw size={15} /> חזרה לשם הקודם
                  </button>
                  <div className="count-line">
                    סבב {progress?.round} · עוד {available.length.toLocaleString("he-IL")} שמות לגלות{" "}
                    <span>✦</span> {savedCount} ברשימה שלכם
                  </div>
                  {progress && progress.round > 1 && <p className="cycle-note">חזרנו להתחלת הרשימה. השמות ששמרתם נשארו ברשימה שלכם.</p>}
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">✳</div>
                  <h3>לא נמצאו שמות שמתאימים לסינון</h3>
                  <p>אפשר להרחיב את הסינון, או להציץ בשמות שכבר שמרתם.</p>
                  <button className="primary-button" onClick={editSearch}>
                    שינוי החיפוש <ArrowLeft size={18} />
                  </button>
                </div>
              )}
            </div>
          )}

          {screen === "saved" && active && (
            <div className="screen">
              <div className="section-heading">
                <div>
                  <span className="kicker">כל הלבבות במקום אחד</span>
                  <h2>הרשימה שלי</h2>
                  <p>לחצו על שם לפירוט, לסטטיסטיקות ולהצעות לשמות דומים.</p>
                </div>
                <span className="section-count">{savedCount}</span>
              </div>
              <div className="list-tabs">
                <button
                  className={listTab === "like" ? "active" : ""}
                  onClick={() => setListTab("like")}
                >
                  שמרתי <span>{liked.length}</span>
                </button>
                <button
                  className={listTab === "pass" ? "active" : ""}
                  onClick={() => setListTab("pass")}
                >
                  ויתרתי <span>{passed.length}</span>
                </button>
              </div>
              <div className="add-name">
                <label htmlFor="manual">יש שם שחסר פה?</label>
                <div className="input-row">
                  <input
                    id="manual"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustom()}
                    placeholder="הוספת שם משלכם"
                    maxLength={50}
                  />
                  <button
                    className="add-button"
                    onClick={addCustom}
                    aria-label="הוספת שם"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
              {similarReference && <div ref={similarPanelRef}>
                <SimilarNames key={`${active.id}:${similarReference.id}`} state={state} search={active} reference={similarReference}
                  onClose={() => setSimilarNameId(null)} onDetails={setDetailsNameId}
                  onSave={id => { updateSearch(s => applyDecision(s, id, 'like')); flash('השם נוסף לרשימה'); }} />
              </div>}
              {listIds.length > 0 && <div className="list-controls">
                <label className="field-label">חיפוש ברשימה<input value={listQuery} onChange={e => setListQuery(e.target.value)} placeholder="חיפוש שם" /></label>
                <label className="field-label">מיון הרשימה<select value={listSort === 'reported' && !state.settings.showStatistics ? 'recent' : listSort} onChange={e => setListSort(e.target.value as typeof listSort)}>
                  <option value="recent">האחרונים שסומנו</option><option value="alphabetical">לפי א״ב</option>{state.settings.showStatistics && <option value="reported">לפי מספר ילידים מדווחים</option>}
                </select></label>
                {listSort === 'reported' && state.settings.showStatistics && <p>לפי נתוני 2020–2024 שפורסמו בלבד; מספרים חסרים אינם אפס.</p>}
              </div>}
              {(listTab === "like" ? liked : passed).length === 0 ? (
                <div className="list-empty">
                  <Heart size={27} />
                  <h3>
                    {listTab === "like"
                      ? "עוד אין שמות ברשימה"
                      : "עדיין לא ויתרתם על שמות"}
                  </h3>
                  <p>
                    {listTab === "like"
                      ? "כל שם שתאהבו יישמר כאן."
                      : "אפשר לחזור אליהם כאן בכל רגע."}
                  </p>
                  <button
                    className="text-link"
                    onClick={() => changeScreen("discover")}
                  >
                    בואו לגלות שמות ←
                  </button>
                </div>
              ) : visibleListIds.length === 0 ? (
                <div className="list-empty"><h3>לא מצאנו שם מתאים ברשימה</h3><p>אפשר לשנות את החיפוש ולנסות שוב.</p><button className="text-link" onClick={() => setListQuery("")}>ניקוי החיפוש</button></div>
              ) : (
                <div className="name-list">
                  {visibleListIds
                    .map((id) => {
                      const n = names.get(id)!;
                      return (
                        <div className="list-item" key={id}>
                          <button
                            className="list-details-button"
                            onClick={() => setDetailsNameId(id)}
                            title={`פירוט על השם ${n.name}`}
                            aria-haspopup="dialog"
                          >
                            <span className="list-number">
                              {numerology(n.name) ?? "✳"}
                            </span>
                            <span className="list-name">
                              <strong>{n.name}</strong>
                              <small>
                                {n.custom ? "שם שהוספתם" : "שם מהמאגר"}
                                {active.surname ? ` · ${active.surname}` : ""}
                              </small>
                              {listSort === "reported" && state.settings.showStatistics && <small>
                                {reportedFiveYearCount(n) === null ? "אין נתונים שפורסמו" : `לפחות ${reportedFiveYearCount(n)!.toLocaleString("he-IL")} ילידים מדווחים`}
                              </small>}
                            </span>
                            <ChevronLeft size={18} className="list-details-icon" aria-hidden="true" />
                          </button>
                          <button
                            className="list-action"
                            onClick={() =>
                              decide(id, listTab === "like" ? "pass" : "like")
                            }
                            aria-label={
                              listTab === "like"
                                ? `העברת ${n.name} לשמות שוויתרתם`
                                : `החזרת ${n.name} לשמות ששמרתם`
                            }
                          >
                            {listTab === "like" ? (
                              <X size={18} />
                            ) : (
                              <Heart size={18} />
                            )}
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
              {liked.length >= 2 && (
                <button
                  className="secondary-button tournament-cta"
                  onClick={() => changeScreen("tournament")}
                >
                  <Trophy size={18} /> מוכנים לטורניר? <ArrowLeft size={17} />
                </button>
              )}
              <Compare
                names={liked
                  .map((id) => names.get(id)?.name ?? "")
                  .filter(Boolean)}
              />
            </div>
          )}

          {screen === "tournament" && active && (
            <div className="screen">
              <div className="section-heading">
                <div>
                  <span className="kicker">זה המשחק!</span>
                  <h2>טורניר השמות</h2>
                  <p>שני שמות בכל פעם. הלב כבר יידע מה לבחור.</p>
                </div>
                <div className="round-badge coral">
                  <Trophy size={23} />
                </div>
              </div>
              {!active.tournament || active.tournament.champion ? (
                <>
                  {active.tournament?.champion &&
                    names.get(active.tournament.champion) && (
                      <div className="winner-card">
                        <span>✦ יש לנו מנצח ✦</span>
                        <h3>{names.get(active.tournament.champion)?.name}</h3>
                        <p>שם אחד, המון אהבה.</p>
                        <button
                          className="text-link"
                          onClick={async () => {
                            try {
                              if (!navigator.clipboard)
                                throw new Error("Clipboard unavailable");
                              await navigator.clipboard.writeText(
                                `השם שבחרנו: ${names.get(active.tournament!.champion!)?.name} ♡`,
                              );
                              flash("השם הועתק ללוח");
                            } catch {
                              flash(
                                "לא הצלחנו להעתיק. אפשר לסמן ולהעתיק את השם.",
                              );
                            }
                          }}
                        >
                          העתקת השם לשיתוף
                        </button>
                      </div>
                    )}
                  <div className="tournament-start">
                    <h3>
                      {active.tournament?.champion
                        ? "רוצים סיבוב נוסף?"
                        : "בוחרים מי נכנס למשחק"}
                    </h3>
                    <p>
                      בחרו בין 2 ל־{state.settings.limitTournament} שמות
                      מהרשימה. שמות שלא נבחרו בסיבוב יישארו שמורים.
                    </p>
                    {liked.length < 2 ? (
                      <div className="list-empty">
                        <p>כדי להתחיל צריך לפחות שני שמות שאהבתם.</p>
                        <button
                          className="secondary-button"
                          onClick={() => changeScreen("discover")}
                        >
                          חזרה לשמות
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="tournament-picks">
                          {liked.map((id) => (
                            <button
                              key={id}
                              className={
                                selected.includes(id) ? "selected" : ""
                              }
                              onClick={() =>
                                setSelected((prev) =>
                                  prev.includes(id)
                                    ? prev.filter((x) => x !== id)
                                    : prev.length <
                                        state.settings.limitTournament
                                      ? [...prev, id]
                                      : prev,
                                )
                              }
                              aria-pressed={selected.includes(id)}
                            >
                              {selected.includes(id) && <Check size={15} />}{" "}
                              {names.get(id)?.name}
                            </button>
                          ))}
                        </div>
                        <button
                          className="primary-button"
                          disabled={selected.length < 2}
                          onClick={() =>
                            updateSearch((s) => ({
                              ...s,
                              tournament: startTournament(selected),
                            }))
                          }
                        >
                          מתחילים טורניר <ArrowLeft size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="match">
                  <div className="match-meta">
                    <span>סיבוב {active.tournament.roundNumber}</span>
                    <span>
                      דו־קרב {Math.floor(active.tournament.index / 2) + 1} מתוך{" "}
                      {Math.floor(active.tournament.round.length / 2)}
                    </span>
                  </div>
                  <h3>מי מרגיש נכון יותר?</h3>
                  <div className="match-cards">
                    {active.tournament.round
                      .slice(
                        active.tournament.index,
                        active.tournament.index + 2,
                      )
                      .map((id) => (
                        <button
                          key={id}
                          onClick={() =>
                            updateSearch((s) => ({
                              ...s,
                              tournament: chooseTournament(s.tournament!, id),
                            }))
                          }
                        >
                          <span>✦</span>
                          <strong>{names.get(id)?.name ?? "שם לא זמין"}</strong>
                          <small>בוחרים בשם הזה ←</small>
                        </button>
                      ))}
                  </div>
                  <p>כל השמות נשארים ברשימה שלכם, גם אחרי המשחק.</p>
                  <button
                    className="text-link"
                    onClick={() => {
                      if (confirm("לסיים את הטורניר הנוכחי?"))
                        updateSearch((s) => ({ ...s, tournament: undefined }));
                    }}
                  >
                    יציאה מהטורניר
                  </button>
                </div>
              )}
            </div>
          )}

          {screen === "searches" && (
            <div className="screen">
              <div className="section-heading">
                <div>
                  <span className="kicker">אפשר להתחיל מחדש, תמיד</span>
                  <h2>החיפושים שלי</h2>
                  <p>לכל חיפוש יש רשימה משלו.</p>
                </div>
              </div>
              <div className="search-list">
                {state.searches.map((s) => (
                  <button
                    key={s.id}
                    className="search-item"
                    onClick={() => {
                      setState({ ...state, activeId: s.id });
                      setScreen("discover");
                    }}
                  >
                    <span className="search-icon">
                      <Baby size={21} />
                    </span>
                    <span>
                      <strong>
                        {genderLabel[s.gender]} ·{" "}
                        {s.nameType === "first" ? "שם ראשון" : "שם אמצעי"}
                      </strong>
                      <small>
                        {
                          Object.values(s.decisions).filter((x) => x === "like")
                            .length
                        }{" "}
                        שמות שמורים
                      </small>
                    </span>
                    <ChevronLeft size={20} />
                  </button>
                ))}
              </div>
              {!state.searches.length && (
                <p className="muted">עוד לא התחלתם חיפוש.</p>
              )}
              <button className="primary-button" onClick={createSearch}>
                <Plus size={19} /> חיפוש חדש
              </button>
            </div>
          )}

          {screen === "profile" && (
            <div className="screen">
              <div className="section-heading">
                <div>
                  <span className="kicker">הפינה שלכם</span>
                  <h2>פרופיל</h2>
                  <p>כל מה ששייך למסע שלכם.</p>
                </div>
                <div className="round-badge">
                  <UserRound size={23} />
                </div>
              </div>
              <div className="style-card">
                <span>✳</span>
                <div>
                  <h3>הסגנון שלכם</h3>
                  {likedNames.length >= 3 ? (
                    <p>
                      {shortNames} מתוך {likedNames.length} השמות ששמרתם כוללים
                      עד שלוש אותיות.
                      {topNumber && Number(topNumber[1]) > 1
                        ? ` המספר הנומרולוגי שמופיע הכי הרבה הוא ${topNumber[0]}.`
                        : ""}
                    </p>
                  ) : (
                    <p>
                      אחרי שתשמרו לפחות שלושה שמות, נציג כאן דברים שמשותפים להם.
                    </p>
                  )}
                </div>
              </div>
              <div className="profile-card">
                <h3>
                  שמות במשפחה <span>♡</span>
                </h3>
                <p>שמרו כאן שמות שחשובים לכם או מזכירים לכם מישהו אהוב.</p>
                <div className="input-row">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && normalize(input)) {
                        setState({
                          ...state,
                          family: [
                            ...new Set([...state.family, normalize(input)]),
                          ],
                        });
                        setInput("");
                      }
                    }}
                    placeholder="הוספת שם במשפחה"
                    aria-label="שם במשפחה"
                    maxLength={50}
                  />
                  <button
                    className="add-button"
                    onClick={() => {
                      if (normalize(input)) {
                        setState({
                          ...state,
                          family: [
                            ...new Set([...state.family, normalize(input)]),
                          ],
                        });
                        setInput("");
                      }
                    }}
                    aria-label="הוספת שם במשפחה"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="chips">
                  {state.family.map((n) => (
                    <button
                      key={n}
                      onClick={() =>
                        setState({
                          ...state,
                          family: state.family.filter((x) => x !== n),
                        })
                      }
                    >
                      {n} <X size={13} />
                    </button>
                  ))}
                </div>
              </div>
              {cloudConfigured && (
                <Suspense fallback={null}>
                  <CloudAccount state={state} setState={setState} />
                </Suspense>
              )}
              {recovery && (
                <div className="privacy-note" role="alert">
                  <Info size={17} />
                  <p>
                    נתונים קודמים לא נקראו בהצלחה ונשמר עבורם עותק.{" "}
                    <button
                      className="text-link"
                      onClick={() =>
                        downloadText("shem-recovery.json", recovery)
                      }
                    >
                      הורדת העותק לשחזור
                    </button>
                  </p>
                </div>
              )}
              <div className="profile-actions">
                <button onClick={() => setScreen("searches")}>
                  <ClipboardList size={19} />
                  <span>
                    <strong>החיפושים שלי</strong>
                    <small>מעבר בין חיפושים והתחלת חיפוש חדש</small>
                  </span>
                  <ChevronLeft size={19} />
                </button>
                <button
                  onClick={() =>
                    downloadJson("shem-hamis-hak-backup.json", state)
                  }
                >
                  <Download size={19} />
                  <span>
                    <strong>גיבוי הנתונים</strong>
                    <small>שמרו עותק של החיפושים והרשימות</small>
                  </span>
                  <ChevronLeft size={19} />
                </button>
                <button onClick={() => backupInput.current?.click()}>
                  <Upload size={19} />
                  <span>
                    <strong>שחזור מגיבוי</strong>
                    <small>טעינת גיבוי קודם במכשיר הזה</small>
                  </span>
                  <ChevronLeft size={19} />
                </button>
                <button onClick={() => setScreen("admin")}>
                  <Settings2 size={19} />
                  <span>
                    <strong>הגדרות ועריכת מאגר מקומית</strong>
                    <small>למנהלי התוכן של המשחק</small>
                  </span>
                  <ChevronLeft size={19} />
                </button>
              </div>
              <input
                ref={backupInput}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const next = parseBackup(await file.text());
                    if (
                      confirm("השחזור יחליף את הנתונים במכשיר הזה. להמשיך?")
                    ) {
                      setState(reconcilePublishedSettings(next));
                      flash("הגיבוי שוחזר");
                    }
                  } catch {
                    flash("לא הצלחנו לקרוא את קובץ הגיבוי");
                  }
                  e.target.value = "";
                }}
              />
              <div className="privacy-note">
                <Info size={17} />
                <p>
                  <strong>הנתונים נשמרים במכשיר הזה.</strong>
                  <br />
                  למעבר למכשיר אחר, השתמשו בגיבוי ושחזור.
                </p>
              </div>
              <button
                className="danger-link"
                onClick={() => {
                  if (confirm("למחוק את כל החיפושים והנתונים מהמכשיר הזה?")) {
                    try {
                      clearRecovery();
                      setRecovery(null);
                    } catch {
                      setStorageError(true);
                      return;
                    }
                    setState(initialState());
                    createSearch();
                    flash("הנתונים נמחקו");
                  }
                }}
              >
                מחיקת כל הנתונים במכשיר
              </button>
            </div>
          )}

          {screen === "admin" && (
            <Admin
              state={state}
              setState={setState}
              onBack={() => setScreen("profile")}
            />
          )}
        </section>
      </main>
      {active && !["setup", "admin", "searches"].includes(screen) && (
        <nav className="bottom-nav" aria-label="ניווט ראשי">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={screen === id ? "active" : ""}
              onClick={() => changeScreen(id)}
              aria-current={screen === id ? "page" : undefined}
            >
              <Icon
                size={20}
                fill={screen === id && id === "saved" ? "currentColor" : "none"}
              />
              <span>{label}</span>
              {id === "saved" && savedCount > 0 && <b>{savedCount}</b>}
            </button>
          ))}
        </nav>
      )}
      {screen === "saved" && active && detailsName && (
        <NameDetailsDialog
          key={`${active.id}:${detailsName.id}`}
          name={detailsName}
          search={active}
          showStatistics={state.settings.showStatistics}
          onClose={() => setDetailsNameId(null)}
          onFindSimilar={() => { setSimilarNameId(detailsName.id); setDetailsNameId(null); }}
        />
      )}
      {numberInfo !== null && (
        <div className="modal-backdrop" onClick={() => setNumberInfo(null)}>
          <div
            className="modal"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="number-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button modal-close"
              onClick={() => setNumberInfo(null)}
              aria-label="סגירה"
            >
              <X size={20} />
            </button>
            <span className="kicker">קצת קסם של מספרים</span>
            <h2 id="number-title">מספר {numberInfo}</h2>
            <p className="modal-meaning">{numberWords[numberInfo]}</p>
            <p>
              לפי מסורת הנומרולוגיה. החישוב משתמש בגימטריה רגילה, כשאותיות
              סופיות נספרות כמו האותיות הרגילות, ומצמצם לספרה אחת.
            </p>
            <div className="modal-nav">
              <button
                onClick={() =>
                  setNumberInfo(numberInfo === 1 ? 9 : numberInfo - 1)
                }
                aria-label="המספר הקודם"
              >
                <ChevronRight size={20} />
              </button>
              <span>{numberInfo} / 9</span>
              <button
                onClick={() =>
                  setNumberInfo(numberInfo === 9 ? 1 : numberInfo + 1)
                }
                aria-label="המספר הבא"
              >
                <ChevronLeft size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {storageError && (
        <div className="storage-warning" role="alert">
          לא הצלחנו לשמור נתונים במכשיר. בדקו שהדפדפן מאפשר אחסון מקומי.
        </div>
      )}
    </div>
  );
}
export default App;
