import { describe, expect, it } from "vitest";
import { builtinPeriods, dateInYear, DEFAULT_PERIODS, hasBuiltinCalendar, PERIODS_BY_YEAR, validatePeriods } from "../src/lib/modulePeriods";

describe("dateInYear", () => {
  it("4〜12月はその年、1〜3月は翌年", () => {
    expect(dateInYear(2026, "10-01")).toBe("2026-10-01");
    expect(dateInYear(2026, "02-15")).toBe("2027-02-15");
  });
});

describe("builtinPeriods", () => {
  const table = { 2027: { 春A: { start: "04-12", end: "05-21" } } };

  it("学年暦のある年度は、書いたモジュールだけを上書きする", () => {
    expect(builtinPeriods(2027, table).春A).toEqual({ start: "04-12", end: "05-21" });
    expect(builtinPeriods(2027, table).春B).toEqual(DEFAULT_PERIODS.春B);
    expect(hasBuiltinCalendar(2027, table)).toBe(true);
  });

  it("学年暦のない年度は、目安の期間", () => {
    expect(builtinPeriods(2030, table)).toEqual(DEFAULT_PERIODS);
    expect(hasBuiltinCalendar(2030, table)).toBe(false);
  });
});

describe("validatePeriods", () => {
  it("目安の期間は誤りなし", () => {
    expect(validatePeriods(2026, DEFAULT_PERIODS)).toBe("");
  });

  it("PERIODS_BY_YEAR に入れた年度は、どれも誤りなし", () => {
    for (const year of Object.keys(PERIODS_BY_YEAR).map(Number)) {
      expect(validatePeriods(year, builtinPeriods(year))).toBe("");
    }
  });

  it("終了日が開始日より前なら誤り", () => {
    expect(validatePeriods(2026, { ...DEFAULT_PERIODS, 春B: { start: "06-01", end: "05-25" } })).toBe("2026年度の春Bは、終了日を開始日以降にしてください");
  });

  it("前のモジュールと重なれば誤り", () => {
    expect(validatePeriods(2026, { ...DEFAULT_PERIODS, 秋B: { start: "11-10", end: "12-26" } })).toBe(
      "2026年度の秋Bは、前のモジュールの終了日より後に始まるようにしてください",
    );
  });
});
