import { defaultSettings, initialState, type AppState } from "./domain";

const KEY = "shem-hamis-hak-v1";
export function load(): AppState {
  let text: string | null = null;
  try {
    text = localStorage.getItem(KEY);
    if (!text) return initialState();
    return parseBackup(text);
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
        Array.isArray(s.numbers) &&
        s.decisions &&
        typeof s.decisions === "object" &&
        Array.isArray(s.history) &&
        Array.isArray(s.customNames),
    )
  )
    throw new Error("Invalid searches");
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
      Array.isArray((n as { genders?: unknown }).genders) &&
      Array.isArray((n as { observations?: unknown }).observations),
    );
  if (
    !state.extraCatalog.every(validName) ||
    !state.searches.every((s) => s.customNames.every(validName))
  )
    throw new Error("Invalid catalog");
  return state;
}
export function save(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}
export function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
