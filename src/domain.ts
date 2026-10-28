import source from "./data/catalog.json";
import settings from "./data/settings.json";
import editorial from "./data/editorial.json";

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
export type NameRecord = {
  id: string;
  name: string;
  genders: string[];
  observations: Observation[];
  meaning?: string;
  origin?: string;
  meaningSource?: string;
  tags?: string[];
  custom?: boolean;
  hidden?: boolean;
};
export type Decision = "like" | "pass";
export type Search = {
  id: string;
  gender: Gender;
  nameType: "first" | "middle";
  firstName: string;
  surname: string;
  inspirations: string[];
  numbers: number[];
  decisions: Record<string, Decision>;
  history: { id: string; previous?: Decision }[];
  customNames: NameRecord[];
  createdAt: number;
  tournament?: Tournament;
};
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
  return [...byId.values()].map((name) => ({
    ...(editorial as Record<string, Partial<NameRecord>>)[name.id],
    ...name,
    ...state.overrides[name.id],
    id: name.id,
  }));
}
export function namesForSearch(state: AppState, search: Search): NameRecord[] {
  const names = [...allNames(state), ...search.customNames];
  const byGender = names.filter(
    (name) =>
      !name.hidden &&
      (search.gender === "unisex"
        ? name.genders.includes("boy") && name.genders.includes("girl")
        : name.genders.includes(search.gender)),
  );
  return byGender.filter(
    (name) =>
      !search.numbers.length ||
      search.numbers.includes(numerology(name.name) ?? -1),
  );
}
export function availableNames(state: AppState, search: Search): NameRecord[] {
  const names = namesForSearch(state, search).filter(
    (name) => !search.decisions[name.id],
  );
  const score = (name: NameRecord) =>
    name.observations.reduce((sum, o) => sum + o.count, 0);
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
  return { ...search, decisions, history: search.history.slice(0, -1) };
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
