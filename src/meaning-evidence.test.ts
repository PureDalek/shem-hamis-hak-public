import { describe, expect, it } from "vitest";
import { allNames, initialState, meaningReferences, type NameRecord } from "./domain";
import { parseBackup } from "./storage";
import { validatePublished } from "./cloud";
import editorial from "./data/editorial.json";

const name: NameRecord = {
  id: "test:evidence", name: "אסתי", genders: ["girl"], observations: [],
  meaning: "פירוש אפשרי", meaningStatus: "disputed", meaningNote: "כמה הצעות",
  meaningSource: "https://en.wiktionary.org/wiki/Esther",
  meaningReferences: [{ url: "https://en.wiktionary.org/wiki/Esther#English", label: "מילון" }],
};

describe("meaning evidence", () => {
  it("counts distinct pages, deduplicating legacy, fragments and Wikimedia revision URLs", () => {
    expect(meaningReferences({ ...name, meaningReferences: [
      ...name.meaningReferences!,
      { url: "https://en.wiktionary.org/w/index.php?title=Esther&oldid=123", label: "גרסה" },
      { url: "https://en.wiktionary.org/wiki/%D7%90%D7%A1%D7%AA%D7%A8", label: "עברית" },
      { url: "https://en.wiktionary.org/wiki/אסתר", label: "כפילות" },
      { url: "https://example.org/dictionary?q=Esther", label: "מקור נוסף" },
      { url: "javascript:alert(1)", label: "מסוכן" },
    ] })).toHaveLength(3);
  });

  it("preserves evidence through backups and validates every place a name can be stored", () => {
    const state = initialState();
    state.extraCatalog = [name];
    state.overrides[name.id] = { meaningStatus: name.meaningStatus, meaningReferences: name.meaningReferences, meaningNote: name.meaningNote };
    expect(parseBackup(JSON.stringify(state))).toEqual(state);
    for (const patch of [
      { meaningStatus: "certain" },
      { meaningReferences: [{ url: "javascript:alert(1)", label: "מקור" }] },
      { meaningReferences: [{ url: "https://example.org", label: 123 }] },
      { meaningReferences: [null] },
      { meaningReferences: "not an array" },
    ]) {
      expect(() => parseBackup(JSON.stringify({ ...state, overrides: { [name.id]: patch } }))).toThrow();
      expect(() => parseBackup(JSON.stringify({ ...state, extraCatalog: [{ ...name, ...patch }] }))).toThrow();
      expect(() => validatePublished({ revision: 1, catalog: { names: [{ ...name, ...patch }] }, settings: state.settings })).toThrow();
    }
    expect(validatePublished({ revision: 1, catalog: { names: [name] }, settings: state.settings }).catalog.names[0]).toEqual(name);
  });

  it("does not attach bundled evidence to an older local meaning edit", () => {
    const state = initialState();
    state.overrides["cbs:אסתי"] = { meaning: "נוסח מקומי אחר" };
    const edited = allNames(state).find(n => n.id === "cbs:אסתי")!;
    expect(edited.meaning).toBe("נוסח מקומי אחר");
    expect(meaningReferences(edited)).toEqual([]);
    expect(edited.meaningStatus).toBe("possible");
    state.overrides["cbs:אסתי"].meaningReferences = name.meaningReferences;
    expect(meaningReferences(allNames(state).find(n => n.id === "cbs:אסתי")!)).toHaveLength(1);
  });

  it("keeps catalog identities and all editorial evidence valid", () => {
    const entries = allNames(initialState());
    expect(entries).toHaveLength(2431);
    expect(entries.filter(n => n.meaning).length).toBeGreaterThanOrEqual(2028);
    expect(validatePublished({ revision: 1, catalog: { names: entries }, settings: initialState().settings }).catalog.names).toHaveLength(2431);
    for (const [id, entry] of Object.entries(editorial)) {
      expect(entries.some(n => n.id === id)).toBe(true);
      if (entry.meaning) expect(meaningReferences(entries.find(n => n.id === id)! ).length).toBeGreaterThan(0);
    }
  });

  it("does not inherit bundled sources when a replacement catalog provides its own text", () => {
    const state = initialState();
    state.extraCatalog = [{ ...name, id: "cbs:אסתי", meaningSource: "", meaningReferences: undefined, meaningStatus: undefined, meaningNote: undefined }];
    expect(meaningReferences(allNames(state).find(n => n.id === "cbs:אסתי")!)).toEqual([]);
  });
});
