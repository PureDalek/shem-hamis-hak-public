import { afterEach, describe, expect, it, vi } from "vitest";
import { load, readRecovery } from "./storage";

afterEach(() => vi.unstubAllGlobals());

describe("damaged local data", () => {
  it("preserves the original content for recovery before starting a fresh state", () => {
    const records = new Map<string, string>([["shem-hamis-hak-v1", "{broken"]]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => records.set(key, value),
    });
    expect(load().searches).toEqual([]);
    expect(readRecovery()).toBe("{broken");
    expect(records.get("shem-hamis-hak-v1")).toBe("{broken");
  });
});
