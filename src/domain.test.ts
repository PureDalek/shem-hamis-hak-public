import { describe, expect, it } from "vitest";
import {
  applyDecision,
  allNames,
  availableNames,
  catalog,
  chooseTournament,
  compareShortlists,
  initialState,
  namesForSearch,
  nameLetters,
  newSearch,
  numerology,
  startTournament,
  similarNames,
  summarizeObservations,
  undo,
} from "./domain";
import { parseBackup } from "./storage";

describe("Hebrew numerology", () => {
  it("handles final letters and vowel marks", () => {
    expect(numerology("מלך")).toBe(numerology("מלכ"));
    expect(numerology("שָׁלוֹם")).toBe(numerology("שלום"));
    expect(numerology("אור")).toBe(9);
    expect(numerology("123")).toBeNull();
  });
});

describe("CBS catalog", () => {
  it("groups boys and girls by year and population without inventing missing values", () => {
    const result = summarizeObservations([
      { group: 'יהודים', gender: 'boy', year: 2020, count: 738 },
      { group: 'יהודיות', gender: 'girl', year: 2020, count: 7 },
      { group: 'יהודים', gender: 'boy', year: 2021, count: 788 },
    ]);
    expect(result.rows).toEqual([
      { year: 2020, group: 'יהודים', boy: 738, girl: 7 },
      { year: 2021, group: 'יהודים', boy: 788 },
    ]);
    expect(result.leadingGroup).toBe('יהודים');
  });
  it("preserves comma-formatted published 2024 counts for known names", () => {
    const david = catalog.find((name) => name.name === "דוד");
    const abigail = catalog.find((name) => name.name === "אביגיל");
    expect(david?.observations).toContainEqual({
      group: "יהודים",
      gender: "boy",
      count: 1842,
      year: 2024,
    });
    expect(david?.observations).toContainEqual({ group: "יהודים", gender: "boy", count: 1707, year: 2020 });
    expect(abigail?.observations).toContainEqual({
      group: "יהודיות",
      gender: "girl",
      count: 1437,
      year: 2024,
    });
  });
  it("keeps reviewed editorial meanings separate and lets an owner override them", () => {
    const state = initialState();
    expect(
      allNames(state).find((name) => name.id === "cbs:אור")?.meaningSource,
    ).toContain("wiktionary.org");
    state.overrides["cbs:אור"] = { meaning: "פירוש מותאם" };
    expect(allNames(state).find((name) => name.id === "cbs:אור")?.meaning).toBe(
      "פירוש מותאם",
    );
  });
});

describe("partner shortlist comparison", () => {
  it("finds unique shared names while ignoring Hebrew vowel marks", () => {
    expect(
      compareShortlists(["אוֹר", "נועם", "נועם"], ["אור", "נועם", "דוד"]),
    ).toEqual(["אוֹר", "נועם"]);
    expect(compareShortlists(["אור"], ["דוד"])).toEqual([]);
  });
});

describe("search decisions", () => {
  it("excludes any selected themes even when another included theme matches", () => {
    const state = initialState();
    const search = { ...newSearch('boy'), categories: ['nature', 'biblical'], excludedCategories: ['nature'] };
    const results = namesForSearch(state, search);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(n => n.tags?.includes('biblical') && !n.tags?.includes('nature'))).toBe(true);
    expect(results.some(n => n.name === 'אור')).toBe(false);
    const restored = parseBackup(JSON.stringify({ ...state, searches: [search], activeId: search.id }));
    expect(restored.searches[0].excludedCategories).toEqual(['nature']);
    expect(namesForSearch(restored, restored.searches[0]).map(n => n.id)).toEqual(results.map(n => n.id));
  });
  it("excludes names with published group records without treating missing data as zero", () => {
    const state = initialState();
    const observation = (group: string, year: number) => ({group, year, gender: 'boy', count: 5});
    state.extraCatalog = [
      { id: 'test:jewish', name: 'בדיקהא', genders: ['boy'], tags: ['fixture'], observations: [observation('יהודיות', 2020), observation('מוסלמים', 2021)] },
      { id: 'test:muslim', name: 'בדיקהב', genders: ['boy'], tags: ['fixture'], observations: [observation('מוסלמים', 2021)] },
      { id: 'test:unknown', name: 'בדיקהג', genders: ['boy'], tags: ['fixture'], observations: [] },
      { id: 'test:old', name: 'בדיקהד', genders: ['boy'], tags: ['fixture'], observations: [observation('יהודים', 2019)] },
    ];
    const search = { ...newSearch('boy'), categories: ['fixture'], excludedPopulationGroups: ['יהודים'] };
    expect(namesForSearch(state, search).map(n => n.id)).toEqual(['test:muslim', 'test:unknown', 'test:old']);
    const backup = parseBackup(JSON.stringify({ ...state, searches: [search], activeId: search.id }));
    expect(backup.searches[0].excludedPopulationGroups).toEqual(['יהודים']);
    expect(namesForSearch(backup, backup.searches[0]).map(n => n.id)).toEqual(['test:muslim', 'test:unknown', 'test:old']);
    const reference = state.extraCatalog[0];
    expect(similarNames(state, search, reference, { length: true, topics: false, letters: false }).map(m => m.name.id)).not.toContain('test:jewish');
  });
  it("combines letter and length filters with categories and persists them in backups", () => {
    const state = initialState();
    const search = { ...newSearch("boy"), firstLetter: "א", lengthFilter: "short" as const, categories: ["nature"] };
    const results = namesForSearch(state, search);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(name => nameLetters(name.name)[0] === "א" && nameLetters(name.name).length <= 3 && name.tags?.includes("nature"))).toBe(true);
    const restored = parseBackup(JSON.stringify({ ...state, searches: [search], activeId: search.id }));
    expect(restored.searches[0]).toMatchObject({ firstLetter: "א", lengthFilter: "short" });
    expect(namesForSearch(restored, restored.searches[0]).map(n => n.id)).toEqual(results.map(n => n.id));
  });
  it("recommends only undecided eligible names and reports the selected matching traits", () => {
    const state = initialState();
    const search = { ...newSearch("boy"), firstLetter: "א", lengthFilter: "short" as const };
    const reference = allNames(state).find(n => n.name === "אור")!;
    const excluded = namesForSearch(state, search).find(n => n.id !== reference.id)!;
    search.decisions[excluded.id] = "pass";
    const results = similarNames(state, search, reference, { length: true, topics: false, letters: false });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(match => match.name.id !== reference.id && match.name.id !== excluded.id && match.sameLength && nameLetters(match.name.name).length === 3 && match.name.name.startsWith("א") && !match.topics.length && !match.letters.length)).toBe(true);
    const topicMatches = similarNames(state, search, reference, { length: false, topics: true, letters: false });
    expect(topicMatches.length).toBeGreaterThan(0);
    expect(topicMatches.every(match => match.topics.length > 0 && match.topics.every(topic => reference.tags?.includes(topic)) && !match.sameLength && !match.letters.length)).toBe(true);
    const letterMatches = similarNames(state, search, reference, { length: false, topics: false, letters: true });
    expect(letterMatches.length).toBeGreaterThan(0);
    expect(letterMatches.every(match => match.letters.length >= 2 && match.letters.every(letter => nameLetters(reference.name).includes(letter) && nameLetters(match.name.name).includes(letter)))).toBe(true);
    expect(similarNames(state, search, reference, { length: false, topics: false, letters: false })).toEqual([]);
  });
  it("filters by any selected category while preserving gender and editable tags", () => {
    const state = initialState();
    const nature = { ...newSearch('boy'), categories: ['nature'] };
    const names = namesForSearch(state, nature);
    expect(names.some(n => n.name === 'אור')).toBe(true);
    expect(names.every(n => n.genders.includes('boy') && n.tags?.includes('nature'))).toBe(true);
    state.overrides['cbs:אור'] = { tags: [] };
    expect(namesForSearch(state, nature).some(n => n.name === 'אור')).toBe(false);
    expect(parseBackup(JSON.stringify({ ...state, searches: [nature], activeId: nature.id })).searches[0].categories).toEqual(['nature']);
  });
  it("excludes decided names and restores the previous decision on undo", () => {
    const state = initialState();
    const search = newSearch();
    const id = availableNames(state, search)[0].id;
    const liked = applyDecision(search, id, "like");
    expect(availableNames(state, liked).some((name) => name.id === id)).toBe(
      false,
    );
    const passed = applyDecision(liked, id, "pass");
    expect(undo(passed).decisions[id]).toBe("like");
    expect(undo(undo(passed)).decisions[id]).toBeUndefined();
  });
  it("combines gender and multiple numerology choices as filters", () => {
    const state = initialState();
    const search = { ...newSearch("girl"), numbers: [2, 4] };
    const results = namesForSearch(state, search);
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (n) =>
          n.genders.includes("girl") && [2, 4].includes(numerology(n.name)!),
      ),
    ).toBe(true);
  });
});

describe("tournament brackets", () => {
  for (const size of [2, 3, 4, 5, 6, 7, 15, 16]) {
    it(`finishes a ${size}-name tournament without mutating entrants`, () => {
      const entrants = Array.from({ length: size }, (_, i) => String(i));
      let tournament = startTournament(entrants);
      let count = 0;
      while (!tournament.champion && count < 30) {
        tournament = chooseTournament(
          tournament,
          tournament.round[tournament.index],
        );
        count++;
      }
      expect(tournament.champion).toBeTruthy();
      expect(count).toBe(size - 1);
      expect(tournament.entrants).toEqual(entrants);
    });
  }
  it("ignores an invalid winner", () => {
    const t = startTournament(["a", "b"]);
    expect(chooseTournament(t, "c")).toBe(t);
  });
});

describe("backup parsing", () => {
  it("accepts a complete state and rejects malformed versions", () => {
    expect(parseBackup(JSON.stringify(initialState())).version).toBe(1);
    expect(() => parseBackup('{"version":1}')).toThrow();
    expect(() => parseBackup('{"version":2}')).toThrow();
  });
  it("loads older backups with default ranking weights", () => {
    const legacy = initialState();
    const oldSettings = { ...legacy.settings } as Partial<
      typeof legacy.settings
    >;
    delete oldSettings.weights;
    const restored = parseBackup(
      JSON.stringify({ ...legacy, settings: oldSettings }),
    );
    expect(restored.settings.weights.similarity).toBe(0.35);
  });
  it("rejects malformed catalog overrides before they can break a search", () => {
    const backup = initialState();
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...backup,
          overrides: { "cbs:test": { observations: "invalid" } },
        }),
      ),
    ).toThrow();
  });
});
