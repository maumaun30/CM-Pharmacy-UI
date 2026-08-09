import { describe, it, expect } from "vitest";
import { parseCSVLine, parseCSVFile, parseCSVDate, toCSV } from "@/lib/csv";

describe("parseCSVLine", () => {
  it("splits plain fields and trims them", () => {
    expect(parseCSVLine("a, b ,c")).toEqual(["a", "b", "c"]);
  });

  it("keeps commas that are inside quotes", () => {
    expect(parseCSVLine('"Ibuprofen, 200mg",IBU1')).toEqual([
      "Ibuprofen, 200mg",
      "IBU1",
    ]);
  });

  // Regression: products/page.tsx used to strip quotes a second time after
  // this function had already unescaped them, mangling names like 5" Syringe.
  it("unescapes RFC4180 doubled quotes exactly once", () => {
    expect(parseCSVLine('"5"" Syringe",SYR5')).toEqual(['5" Syringe', "SYR5"]);
  });

  it("returns an empty trailing field", () => {
    expect(parseCSVLine("a,b,")).toEqual(["a", "b", ""]);
  });

  // Regression: a `"` mid-field (not at the start of the field) must be
  // treated as a literal character, not a quote-state toggle — otherwise the
  // comma right after it gets swallowed into the field and the SKU is lost.
  it("treats an unquoted mid-field quote as a literal character", () => {
    expect(parseCSVLine('5" Syringe,SYR5')).toEqual(['5" Syringe', "SYR5"]);
  });
});

describe("parseCSVFile", () => {
  it("separates headers from rows and drops blank lines", () => {
    const result = parseCSVFile("SKU,Name\r\nA1,Biogesic\r\n\r\nA2,Neozep\n");
    expect(result.headers).toEqual(["SKU", "Name"]);
    expect(result.rows).toEqual([
      ["A1", "Biogesic"],
      ["A2", "Neozep"],
    ]);
  });

  it("returns empty headers and rows for empty input", () => {
    expect(parseCSVFile("")).toEqual({ headers: [], rows: [] });
  });
});

describe("parseCSVDate", () => {
  it("passes through YYYY-MM-DD", () => {
    expect(parseCSVDate("2027-01-31")).toBe("2027-01-31");
  });

  it("accepts what Excel writes", () => {
    expect(parseCSVDate("1/31/2027")).toBe("2027-01-31");
  });

  it("returns null for blank or junk rather than throwing", () => {
    expect(parseCSVDate("")).toBeNull();
    expect(parseCSVDate("not a date")).toBeNull();
  });

  it("resolves an ambiguous date as M/D, not D/M", () => {
    expect(parseCSVDate("3/4/2027")).toBe("2027-03-04");
  });

  it("falls back to D/M/YYYY when the month can't be M/D", () => {
    expect(parseCSVDate("25/12/2027")).toBe("2027-12-25");
  });
});

describe("toCSV", () => {
  it("writes a header row derived from the first object", () => {
    expect(toCSV([{ SKU: "A1", Qty: 5 }])).toBe('"SKU","Qty"\n"A1","5"');
  });

  it("escapes embedded quotes so the output round-trips", () => {
    const csv = toCSV([{ Name: '5" Syringe' }]);
    const parsed = parseCSVFile(csv);
    expect(parsed.rows[0]).toEqual(['5" Syringe']);
  });

  it("returns an empty string for no rows", () => {
    expect(toCSV([])).toBe("");
  });
});
