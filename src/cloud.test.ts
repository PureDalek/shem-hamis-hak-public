import { describe, expect, it } from "vitest";
import { validatePublished } from "./cloud";
import { catalogSource, defaultSettings } from "./domain";

const item = {
  id: "test-1",
  name: "אור",
  genders: ["boy", "girl"],
  observations: [],
};
const row = {
  revision: 1,
  catalog: { source: catalogSource, names: [item] },
  settings: defaultSettings,
};

describe("published content validation", () => {
  it("accepts a well formed catalog and settings", () => {
    expect(validatePublished(row).catalog.names[0].name).toBe("אור");
  });
  it("rejects duplicate IDs and malformed observations", () => {
    expect(() =>
      validatePublished({
        ...row,
        catalog: { ...row.catalog, names: [item, item] },
      }),
    ).toThrow();
    expect(() =>
      validatePublished({
        ...row,
        catalog: {
          ...row.catalog,
          names: [{ ...item, observations: [{ count: "invalid" }] }],
        },
      }),
    ).toThrow();
  });
  it("does not turn an unsafe catalog source into a link", () => {
    expect(
      validatePublished({
        ...row,
        catalog: { ...row.catalog, source: "javascript:alert(1)" },
      }).catalog.source,
    ).toBe(catalogSource);
  });
  it("rejects unsafe editorial source links", () => {
    expect(() =>
      validatePublished({
        ...row,
        catalog: {
          ...row.catalog,
          names: [{ ...item, meaningSource: "javascript:alert(1)" }],
        },
      }),
    ).toThrow();
  });
});
