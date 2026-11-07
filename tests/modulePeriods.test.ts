import { describe, expect, it } from "vitest";
import { builtinStarts, dateInYear, DEFAULT_STARTS, hasBuiltinCalendar, STARTS_BY_YEAR, validateStarts } from "../src/lib/modulePeriods";

describe("dateInYear", () => {
  it("4〜12月はその年、1〜3月は翌年", () => {
    expect(dateInYear(2026, "10-01")).toBe("2026-10-01");
    expect(dateInYear(2026, "02-15")).toBe("2027-02-15");
  });
});

describe("builtinStarts", () => {
  const table = { 2027: { 春A: "04-12" } };

  it("学年暦のある年度は、書いたモジュールだけを上書きする", () => {
    expect(builtinStarts(2027, table).春A).toBe("04-12");
    expect(builtinStarts(2027, table).春B).toBe(DEFAULT_STARTS.春B);
    expect(hasBuiltinCalendar(2027, table)).toBe(true);
  });

  it("学年暦のない年度は、目安の開始日", () => {
    expect(builtinStarts(2030, table)).toEqual(DEFAULT_STARTS);
    expect(hasBuiltinCalendar(2030, table)).toBe(false);
  });

  it("2026年度は学年暦の開始日", () => {
    expect(builtinStarts(2026)).toEqual({ 春A: "04-14", 春B: "05-26", 春C: "07-02", 秋A: "10-01", 秋B: "11-12", 秋C: "01-06" });
  });
});

describe("validateStarts", () => {
  it("目安の開始日は誤りなし", () => {
    expect(validateStarts(2026, DEFAULT_STARTS)).toBe("");
  });

  it("STARTS_BY_YEAR に入れた年度は、どれも順に並んでいる", () => {
    for (const year of Object.keys(STARTS_BY_YEAR).map(Number)) {
      expect(validateStarts(year, builtinStarts(year))).toBe("");
    }
  });

  it("前のモジュールの開始日以前なら誤り", () => {
    expect(validateStarts(2026, { ...DEFAULT_STARTS, 秋B: "10-01" })).toBe("2026年度の秋Bの開始日は、秋Aの開始日より後にしてください");
  });
});
