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
  newSearch,
  numerology,
  startTournament,
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
