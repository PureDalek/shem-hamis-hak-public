import source from "./data/catalog.json";
import settings from "./data/settings.json";
import editorial from "./data/editorial.json";
import { categories, initialCategories } from "./categories";

export type Gender = "boy" | "girl" | "unisex";
export type Screen =
  | "setup"
  | "discover"
  | "saved"
  | "tournament"
  | "profile"
  | "searches"
  | "admin";
export type Observation = {
  group: string;
  gender: string;
  count: number;
  year: number;
};
const populationGroups: Record<string, string> = {
  יהודים: "יהודים", יהודיות: "יהודים",
  מוסלמים: "מוסלמים", מוסלמיות: "מוסלמים",
  "נוצרים ערבים": "נוצרים ערבים", "נוצריות ערביות": "נוצרים ערבים",
  דרוזים: "דרוזים", דרוזיות: "דרוזים",
};

export function summarizeObservations(observations: Observation[]) {
  const rows = new Map<string, { year: number; group: string; boy?: number; girl?: number }>();
  const totals = new Map<string, number>();
  for (const item of observations) {
    const group = populationGroups[item.group] ?? item.group;
    if (item.gender !== 'boy' && item.gender !== 'girl') continue;
    const key = `${item.year}:${group}`;
    const row = rows.get(key) ?? { year: item.year, group };
    row[item.gender] = (row[item.gender] ?? 0) + item.count;
    rows.set(key, row);
    totals.set(group, (totals.get(group) ?? 0) + item.count);
  }
  const ranked = [...totals].sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((sum, [, count]) => sum + count, 0);
  return {
    rows: [...rows.values()].sort((a, b) => a.year - b.year || a.group.localeCompare(b.group, 'he')),
    leadingGroup: ranked.length && ranked[0][1] > total / 2 ? ranked[0][0] : null,
  };
}
export type NameRecord = {
  id: string;
  name: string;
  genders: string[];
  observations: Observation[];
  meaning?: string;
  origin?: string;
  meaningSource?: string;
  meaningStatus?: "documented" | "possible" | "disputed";
  meaningNote?: string;
  meaningReferences?: MeaningReference[];
  tags?: string[];
  custom?: boolean;
  hidden?: boolean;
};
export type Decision = "like" | "pass";
export type MeaningReference = { url: string; label: string; note?: string };
export const meaningStatusLabels = {
  documented: "פירוש מתועד", possible: "פירוש אפשרי", disputed: "פירוש שנוי במחלוקת",
} as const;

/** Shared by backup import and publication; source links are untrusted input. */
export function validMeaningEvidence(value: {
  meaningStatus?: unknown; meaningNote?: unknown; meaningReferences?: unknown;
}): boolean {
  return (value.meaningStatus === undefined ||
    (typeof value.meaningStatus === "string" && Object.prototype.hasOwnProperty.call(meaningStatusLabels, value.meaningStatus))) &&
    (value.meaningNote === undefined || typeof value.meaningNote === "string") &&
    (value.meaningReferences === undefined || (Array.isArray(value.meaningReferences) &&
      value.meaningReferences.length <= 30 && value.meaningReferences.every((ref: unknown) => {
        if (!ref || typeof ref !== "object") return false;
        const r = ref as Partial<MeaningReference>;
        return typeof r.url === "string" && isSafeHttpsUrl(r.url) &&
          typeof r.label === "string" && Boolean(r.label.trim()) &&
          (r.note === undefined || typeof r.note === "string");
      })));
}

/** Count distinct pages, not duplicate links, fragments, or revision URLs. */
export function meaningReferences(name: NameRecord): MeaningReference[] {
  const references = [...(name.meaningReferences ?? [])];
  if (name.meaningSource) references.push({ url: name.meaningSource, label: "מקור לפירוש השם" });
  const seen = new Set<string>();
  return references.filter((ref) => {
    if (!isSafeHttpsUrl(ref.url)) return false;
    const url = new URL(ref.url);
    let path: string;
    try { path = decodeURI(url.pathname).normalize("NFC").replace(/\/$/, ""); }
    catch { path = url.pathname; }
    if (url.hostname.endsWith(".wiktionary.org") && path === "/w/index.php" && url.searchParams.has("title"))
      path = `/wiki/${url.searchParams.get("title")!.replaceAll(" ", "_")}`;
    const key = `${url.hostname}${path}${url.hostname.endsWith(".wiktionary.org") ? "" : url.search}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export type Search = {
  id: string;
  gender: Gender;
  nameType: "first" | "middle";
  firstName: string;
  surname: string;
  inspirations: string[];
  numbers: number[];
  categories?: string[];
  excludedCategories?: string[];
  excludedPopulationGroups?: string[];
  lengthFilter?: "short" | "medium" | "long";
  firstLetter?: string;
  decisions: Record<string, Decision>;
  history: { id: string; previous?: Decision; browseUndo?: BrowseUndo }[];
  browsing?: { round: number; seen: string[] };
  customNames: NameRecord[];
  createdAt: number;
  tournament?: Tournament;
};
export type BrowseUndo =
  | { kind: "initialize" }
  | { kind: "advance" }
  | { kind: "restart"; round: number; seen: string[] };
export type Tournament = {
  entrants: string[];
  round: string[];
  next: string[];
  index: number;
  wins: string[];
  champion?: string;
  roundNumber: number;
};
export type Settings = {
  showStatistics: boolean;
  sort: "popular" | "mixed" | "alphabetical";
  limitTournament: number;
  weights: { variety: number; popularity: number; similarity: number };
};
export type AppState = {
  version: 1;
  searches: Search[];
  activeId: string | null;
  family: string[];
  overrides: Record<string, Partial<NameRecord>>;
  extraCatalog: NameRecord[];
  settings: Settings;
  siteRevision?: number;
};

export let catalog = source.names as NameRecord[];
export let catalogSource = source.source;
export let defaultSettings: Settings = settings as Settings;
export let publishedRevision = 0;
export function installPublishedContent(
  names: NameRecord[],
  sourceUrl: string,
  nextSettings: Settings,
  revision: number,
) {
  catalog = names;
  catalogSource = sourceUrl;
  defaultSettings = nextSettings;
  publishedRevision = revision;
}
export const initialState = (): AppState => ({
  version: 1,
  searches: [],
  activeId: null,
  family: [],
  overrides: {},
  extraCatalog: [],
  settings: defaultSettings,
  siteRevision: publishedRevision,
});
export const makeId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0591-\u05c7]/g, "")
    .trim()
    .replace(/\s+/g, " ");
export const nameLetters = (value: string) =>
  Array.from(normalize(value)).filter((letter) => /\p{L}/u.test(letter));
export function isSafeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Return local spellings shared by both lists, without exposing unrelated data. */
export function compareShortlists(mine: string[], theirs: string[]): string[] {
  const other = new Set(theirs.map(normalize).filter(Boolean));
  const seen = new Set<string>();
  return mine.filter((name) => {
    const key = normalize(name);
    if (!key || seen.has(key) || !other.has(key)) return false;
    seen.add(key);
    return true;
  });
}
const letters: Record<string, number> = Object.fromEntries(
  Array.from("אבגדהוזחטיכלמנסעפצקרשת").map((letter, index) => [
    letter,
    [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200,
      300, 400,
    ][index],
  ]),
);
Object.assign(letters, { ך: 20, ם: 40, ן: 50, ף: 80, ץ: 90 });
export function numerology(name: string): number | null {
  let total = 0;
  for (const letter of normalize(name)) total += letters[letter] ?? 0;
  return total ? 1 + ((total - 1) % 9) : null;
}
export function allNames(state: AppState): NameRecord[] {
  const byId = new Map(
    [...catalog, ...state.extraCatalog].map((name) => [name.id, name]),
  );
  return [...byId.values()].map((name) => {
    const override = state.overrides[name.id];
    // Older local edits must not inherit evidence for a different meaning.
    const resetEvidence = override && ["name", "meaning", "origin", "meaningSource"].some(key => Object.prototype.hasOwnProperty.call(override, key));
    const emptyEvidence = { meaningReferences: [], meaningStatus: "possible" as const, meaningNote: "", meaningSource: "" };
    const catalogHasMeaning = ["meaning", "origin", "meaningSource"].some(key => Object.prototype.hasOwnProperty.call(name, key));
    return {
      ...(editorial as Record<string, Partial<NameRecord>>)[name.id],
      tags: [...new Set([...initialCategories(name.name), ...((editorial as Record<string, Partial<NameRecord>>)[name.id]?.tags ?? [])])],
      ...(catalogHasMeaning ? emptyEvidence : {}),
      ...name,
      ...(resetEvidence ? emptyEvidence : {}),
      ...override,
      id: name.id,
    };
  });
}
export function namesForSearch(state: AppState, search: Search): NameRecord[] {
  const names = [...allNames(state), ...search.customNames.map(name => ({ tags: initialCategories(name.name), ...name }))];
  const byGender = names.filter(
    (name) =>
      !name.hidden &&
      (search.gender === "unisex"
        ? name.genders.includes("boy") && name.genders.includes("girl")
        : name.genders.includes(search.gender)),
  );
  return byGender.filter((name) => {
    const letters = search.lengthFilter || search.firstLetter ? nameLetters(name.name) : [];
    const lengthMatch = !search.lengthFilter ||
      (search.lengthFilter === "short" ? letters.length > 0 && letters.length <= 3
        : search.lengthFilter === "medium" ? letters.length === 4 : letters.length >= 5);
    const letterMatch = !search.firstLetter || letters[0] === search.firstLetter;
    const numericMatch = !search.numbers.length || search.numbers.includes(numerology(name.name) ?? -1);
    const selected = search.categories ?? [];
    const published = name.observations.filter(o => o.year >= 2020 && o.year <= 2024);
    const reportedTotal = published.reduce((sum, o) => sum + o.count, 0);
    const matchesCategory = (category: string) =>
      category === 'reported-low'
        ? published.length > 0 && reportedTotal <= 100
        : (name.tags ?? []).includes(category);
    const categoryMatch = !selected.length || selected.some(matchesCategory);
    const excludedCategory = (search.excludedCategories ?? []).some(matchesCategory);
    const excludedPopulation = published.some(observation =>
      (search.excludedPopulationGroups ?? []).includes(populationGroups[observation.group] ?? observation.group),
    );
    return numericMatch && categoryMatch && !excludedCategory && !excludedPopulation && lengthMatch && letterMatch;
  });
}

export type SimilarityOptions = { length: boolean; topics: boolean; letters: boolean };
/** Rank matches by transparent, selected traits and retain the matching reasons. */
export function similarNames(state: AppState, search: Search, reference: NameRecord, options: SimilarityOptions) {
  const referenceLetters = new Set(nameLetters(reference.name));
  const referenceLength = nameLetters(reference.name).length;
  const referenceTopics = new Set((reference.tags ?? []).filter(tag => tag !== "unclassified" && categories.some(category => category.id === tag)));
  return namesForSearch(state, search)
    .filter(name => name.id !== reference.id && !search.decisions[name.id])
    .map(name => {
      const letters = nameLetters(name.name);
      const sharedLetters = [...new Set(letters)].filter(letter => referenceLetters.has(letter));
      const topics = (name.tags ?? []).filter(tag => referenceTopics.has(tag));
      const sameLength = referenceLength > 0 && letters.length === referenceLength;
      const matchedTopics = options.topics ? topics : [];
      const matchedLength = options.length && sameLength;
      const matchedLetters = options.letters && sharedLetters.length >= 2 ? sharedLetters : [];
      const score = matchedTopics.length * 3 + (matchedLetters.length ? 2 : 0) + (matchedLength ? 1 : 0);
      return { name, topics: matchedTopics, sameLength: matchedLength, letters: matchedLetters, score };
    })
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score || a.name.name.localeCompare(b.name.name, "he"));
}
export function availableNames(state: AppState, search: Search): NameRecord[] {
  const eligible = namesForSearch(state, search);
  const seen = new Set(search.browsing?.seen ?? Object.keys(search.decisions));
  const remaining = eligible.filter(name => !seen.has(name.id));
  // A completed round immediately shows the beginning again. Decisions are
  // independent of this cursor, so saved names survive every new round.
  const names = remaining.length ? remaining : eligible;
  const score = (name: NameRecord) =>
    name.observations.filter(o => o.year === 2024).reduce((sum, o) => sum + o.count, 0);
  if (state.settings.sort === "alphabetical")
    return names.sort((a, b) => a.name.localeCompare(b.name, "he"));
  if (state.settings.sort === "popular")
    return names.sort((a, b) => score(b) - score(a));
  // A stable mix of popularity, stated inspirations, liked names and exploration.
  const hash = (s: string) => {
    let n = 2166136261;
    for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return n >>> 0;
  };
  const examples = [
    ...search.inspirations,
    ...Object.entries(search.decisions)
      .filter(([, d]) => d === "like")
      .map(
        ([id]) =>
          [...catalog, ...state.extraCatalog, ...search.customNames].find(
            (n) => n.id === id,
          )?.name ?? "",
      ),
  ]
    .map(normalize)
    .filter(Boolean)
    .slice(-20);
  const similarity = (name: string) => {
    const candidate = normalize(name);
    if (!examples.length || !candidate) return 0;
    return Math.max(
      ...examples.map((example) => {
        const a = new Set(Array.from(candidate));
        const b = new Set(Array.from(example));
        const shared = [...a].filter((letter) => b.has(letter)).length;
        return shared / Math.max(a.size, b.size);
      }),
    );
  };
  const scores = new Map(
    names.map((name) => [
      name.id,
      (hash(name.id + search.id) / 4294967296) *
        state.settings.weights.variety +
        (Math.min(score(name), 1500) / 1500) *
          state.settings.weights.popularity +
        similarity(name.name) * state.settings.weights.similarity,
    ]),
  );
  return names.sort((a, b) => scores.get(b.id)! - scores.get(a.id)!);
}
export function discoveryProgress(state: AppState, search: Search) {
  const eligible = namesForSearch(state, search);
  const seen = new Set(search.browsing?.seen ?? Object.keys(search.decisions));
  const remaining = eligible.filter(name => !seen.has(name.id)).length;
  const restarting = eligible.length > 0 && remaining === 0;
  return {
    round: (search.browsing?.round ?? 1) + (restarting ? 1 : 0),
    remaining: restarting ? eligible.length : remaining,
    total: eligible.length,
    restarting,
  };
}

/** Advance only discovery. Changes made in the shortlist do not move its cursor. */
export function applyDiscoveryDecision(state: AppState, search: Search, id: string, decision: Decision): Search {
  if (availableNames(state, search)[0]?.id !== id) return search;
  const progress = discoveryProgress(state, search);
  const previous = search.browsing;
  const seen = progress.restarting ? [] : previous?.seen ?? Object.keys(search.decisions);
  const browseUndo: BrowseUndo = !previous ? { kind: "initialize" }
    : progress.restarting ? { kind: "restart", round: previous.round, seen: previous.seen }
    : { kind: "advance" };
  const next = applyDecision(search, id, decision);
  next.history[next.history.length - 1] = { ...next.history.at(-1)!, browseUndo };
  return { ...next, browsing: { round: progress.round, seen: [...new Set([...seen, id])] } };
}
export function newSearch(gender: Gender = "boy"): Search {
  return {
    id: makeId(),
    gender,
    nameType: "first",
    firstName: "",
    surname: "",
    inspirations: [],
    numbers: [],
    decisions: {},
    history: [],
    customNames: [],
    createdAt: Date.now(),
  };
}
export function applyDecision(
  search: Search,
  id: string,
  decision: Decision,
): Search {
  return {
    ...search,
    decisions: { ...search.decisions, [id]: decision },
    history: [...search.history, { id, previous: search.decisions[id] }].slice(
      -200,
    ),
  };
}
export function undo(search: Search): Search {
  const item = search.history.at(-1);
  if (!item) return search;
  const decisions = { ...search.decisions };
  if (item.previous) decisions[item.id] = item.previous;
  else delete decisions[item.id];
  const restored = { ...search, decisions, history: search.history.slice(0, -1) };
  if (item.browseUndo?.kind === "initialize") delete restored.browsing;
  else if (item.browseUndo?.kind === "restart")
    restored.browsing = { round: item.browseUndo.round, seen: item.browseUndo.seen };
  else if (item.browseUndo?.kind === "advance" && search.browsing)
    restored.browsing = { ...search.browsing, seen: search.browsing.seen.filter(id => id !== item.id) };
  return restored;
}
export function startTournament(entrants: string[]): Tournament {
  if (entrants.length < 2) throw new Error("At least two names are required");
  return {
    entrants: [...entrants],
    round: [...entrants],
    next: [],
    index: 0,
    wins: [],
    roundNumber: 1,
  };
}
export function chooseTournament(t: Tournament, winner: string): Tournament {
  if (
    t.champion ||
    !t.round.slice(t.index, t.index + 2).includes(winner) ||
    t.index + 1 >= t.round.length
  )
    return t;
  let next = [...t.next, winner];
  const index = t.index + 2;
  if (index < t.round.length - 1)
    return { ...t, next, index, wins: [...t.wins, winner] };
  if (index === t.round.length - 1) next = [...next, t.round[index]];
  if (next.length === 1)
    return { ...t, next, index, wins: [...t.wins, winner], champion: next[0] };
  return {
    ...t,
    round: next,
    next: [],
    index: 0,
    wins: [...t.wins, winner],
    roundNumber: t.roundNumber + 1,
  };
}
