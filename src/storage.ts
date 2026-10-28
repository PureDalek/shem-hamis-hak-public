import {
  defaultSettings,
  initialState,
  publishedRevision,
  validMeaningEvidence,
  type AppState,
} from "./domain";

const KEY = "shem-hamis-hak-v1";
export function load(): AppState {
  let text: string | null = null;
  try {
    text = localStorage.getItem(KEY);
    if (!text) return initialState();
    return reconcilePublishedSettings(parseBackup(text));
  } catch {
    // Keep a recoverable copy instead of silently overwriting damaged state.
    try {
      if (text) localStorage.setItem(`${KEY}-recovery`, text);
    } catch {
      /* storage may be unavailable */
    }
    return initialState();
  }
}
export function reconcilePublishedSettings(state: AppState): AppState {
  if ((state.siteRevision ?? 0) >= publishedRevision) return state;
  return {
    ...state,
    settings: structuredClone(defaultSettings),
    siteRevision: publishedRevision,
  };
}
export function parseBackup(text: string): AppState {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object") throw new Error("Invalid backup");
  const state = value as AppState;
  if (
    state.version !== 1 ||
    !Array.isArray(state.searches) ||
    !Array.isArray(state.family) ||
    !state.settings ||
    !state.overrides ||
    !Array.isArray(state.extraCatalog)
  )
    throw new Error("Invalid backup");
  if (state.activeId !== null && typeof state.activeId !== "string")
    throw new Error("Invalid active search");
  // Backward-compatible default for backups saved before ranking was configurable.
  if (!state.settings.weights)
    state.settings.weights = { ...defaultSettings.weights };
  if (
    !state.searches.every(
      (s) =>
        s &&
        typeof s.id === "string" &&
        ["boy", "girl", "unisex"].includes(s.gender) &&
        ["first", "middle"].includes(s.nameType) &&
        typeof s.firstName === "string" &&
        typeof s.surname === "string" &&
        Array.isArray(s.inspirations) &&
        s.inspirations.every((name) => typeof name === "string") &&
        Array.isArray(s.numbers) &&
        s.numbers.every(
          (number) => Number.isInteger(number) && number >= 1 && number <= 9,
        ) &&
        (s.categories === undefined || (Array.isArray(s.categories) && s.categories.every((category) => typeof category === 'string'))) &&
        s.decisions &&
        typeof s.decisions === "object" &&
        !Array.isArray(s.decisions) &&
        Object.values(s.decisions).every(
          (decision) => decision === "like" || decision === "pass",
        ) &&
        Array.isArray(s.history) &&
        s.history.every(
          (item) =>
            item &&
            typeof item.id === "string" &&
            (item.previous === undefined ||
              item.previous === "like" ||
              item.previous === "pass"),
        ) &&
        Array.isArray(s.customNames) &&
        (!s.tournament ||
          (Array.isArray(s.tournament.entrants) &&
            s.tournament.entrants.every((id) => typeof id === "string") &&
            Array.isArray(s.tournament.round) &&
            s.tournament.round.every((id) => typeof id === "string") &&
            Array.isArray(s.tournament.next) &&
            s.tournament.next.every((id) => typeof id === "string") &&
            Array.isArray(s.tournament.wins) &&
            s.tournament.wins.every((id) => typeof id === "string") &&
            Number.isInteger(s.tournament.index) &&
            s.tournament.index >= 0 &&
            Number.isInteger(s.tournament.roundNumber) &&
            s.tournament.roundNumber >= 1 &&
            (s.tournament.champion === undefined ||
              typeof s.tournament.champion === "string"))),
    )
  )
    throw new Error("Invalid searches");
  if (
    !state.family.every((name) => typeof name === "string") ||
    (state.activeId !== null &&
      !state.searches.some((search) => search.id === state.activeId)) ||
    new Set(state.searches.map((search) => search.id)).size !==
      state.searches.length
  )
    throw new Error("Invalid search references");
  if (
    !["mixed", "popular", "alphabetical"].includes(state.settings.sort) ||
    typeof state.settings.showStatistics !== "boolean" ||
    !Number.isInteger(state.settings.limitTournament) ||
    state.settings.limitTournament < 2 ||
    state.settings.limitTournament > 32 ||
    ![
      state.settings.weights.variety,
      state.settings.weights.popularity,
      state.settings.weights.similarity,
    ].every(
      (weight) =>
        typeof weight === "number" &&
        Number.isFinite(weight) &&
        weight >= 0 &&
        weight <= 2,
    )
  )
    throw new Error("Invalid settings");
  const validName = (n: unknown) =>
    Boolean(
      n &&
      typeof n === "object" &&
      typeof (n as { id?: unknown }).id === "string" &&
      typeof (n as { name?: unknown }).name === "string" &&
      validMeaningEvidence(n as object) &&
      ((n as { tags?: unknown }).tags === undefined || (Array.isArray((n as { tags?: unknown }).tags) && (n as { tags: unknown[] }).tags.every(tag => typeof tag === 'string'))) &&
      Array.isArray((n as { genders?: unknown }).genders) &&
      (n as { genders: unknown[] }).genders.every(
        (gender) => gender === "boy" || gender === "girl",
      ) &&
      Array.isArray((n as { observations?: unknown }).observations) &&
      (n as { observations: unknown[] }).observations.every((observation) => {
        if (!observation || typeof observation !== "object") return false;
        const o = observation as {
          group?: unknown;
          gender?: unknown;
          count?: unknown;
          year?: unknown;
        };
        return (
          typeof o.group === "string" &&
          typeof o.gender === "string" &&
          typeof o.count === "number" &&
          Number.isFinite(o.count) &&
          typeof o.year === "number"
        );
      }),
    );
  if (
    !state.extraCatalog.every(validName) ||
    !state.searches.every((s) => s.customNames.every(validName)) ||
    Array.isArray(state.overrides) ||
    !Object.values(state.overrides).every((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry))
        return false;
      return (
        Object.keys(entry).every((key) =>
          [
            "name",
            "meaning",
            "origin",
            "meaningSource",
            "meaningStatus",
            "meaningNote",
            "meaningReferences",
            "hidden",
            "genders",
            "tags",
          ].includes(key),
        ) &&
        (entry.name === undefined ||
          (typeof entry.name === "string" && entry.name.length <= 80)) &&
        (entry.meaning === undefined || typeof entry.meaning === "string") &&
        validMeaningEvidence(entry) &&
        (entry.tags === undefined || (Array.isArray(entry.tags) && entry.tags.every(tag => typeof tag === 'string'))) &&
        (entry.origin === undefined || typeof entry.origin === "string") &&
        (entry.meaningSource === undefined ||
          typeof entry.meaningSource === "string") &&
        (entry.hidden === undefined || typeof entry.hidden === "boolean") &&
        (entry.genders === undefined ||
          (Array.isArray(entry.genders) &&
            entry.genders.every(
              (gender) => gender === "boy" || gender === "girl",
            )))
      );
    })
  )
    throw new Error("Invalid catalog");
  return state;
}
export function save(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}
export function readRecovery(): string | null {
  try {
    return localStorage.getItem(`${KEY}-recovery`);
  } catch {
    return null;
  }
}
export function clearRecovery() {
  localStorage.removeItem(`${KEY}-recovery`);
}
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadJson(filename: string, value: unknown) {
  downloadText(filename, JSON.stringify(value, null, 2));
}
