import { describe, expect, it } from "vitest";
import { academicYear, detectSelection, matchesSelection } from "../src/content/timetable/module";
import { parseSchedule } from "../src/content/timetable/parser";
import { DEFAULT_PERIODS, DEFAULT_SETTINGS, periodsForYear } from "../src/lib/settings";

const d = (s: string) => {
  const [y, m, day] = s.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, day, 12, 0);
};
const defaults = () => DEFAULT_PERIODS;

describe("academicYear", () => {
  it("4月始まりで数える", () => {
    expect(academicYear(d("2026-04-01"))).toBe(2026);
    expect(academicYear(d("2026-03-31"))).toBe(2025);
    expect(academicYear(d("2027-02-10"))).toBe(2026);
  });
});

describe("detectSelection", () => {
  it.each([
    ["2026-11-07", 2026, "秋", "A"],
    ["2026-11-10", 2026, "秋", "A"],
    ["2026-11-11", 2026, "秋", "B"],
    ["2026-04-08", 2026, "春", "A"],
    ["2026-07-15", 2026, "春", "C"],
    ["2027-01-20", 2026, "秋", "C"],
  ] as const)("%s は %i年度 %s%s", (date, year, term, module) => {
    expect(detectSelection(d(date), defaults)).toEqual({ year, term, module });
  });

  it.each([
    ["2026-04-01", 2026, "春", "A"], // 年度の初め（春Aの前）
    ["2026-08-20", 2026, "秋", "A"], // 夏季休業
    ["2026-12-30", 2026, "秋", "C"], // 冬季休業
    ["2027-03-01", 2027, "春", "A"], // 春季休業は次の年度の春A
  ] as const)("休業期間の %s は直後の %i年度 %s%s", (date, year, term, module) => {
    expect(detectSelection(d(date), defaults)).toEqual({ year, term, module });
  });

  it("年度ごとの上書きを使う", () => {
    const settings = { ...DEFAULT_SETTINGS, modulePeriodsByYear: { "2026": { 秋A: { start: "10-01", end: "11-05" } } } };
    expect(detectSelection(d("2026-11-07"), (y) => periodsForYear(settings, y))).toEqual({ year: 2026, term: "秋", module: "B" });
  });
});

describe("matchesSelection", () => {
  it("秋B は秋AB・秋BC・秋ABC を含み、秋A・秋C を含まない", () => {
    const m = (raw: string) => matchesSelection(parseSchedule(raw), "秋", "B");
    expect(m("秋AB 月1,2")).toBe(true);
    expect(m("秋BC 金1,2")).toBe(true);
    expect(m("秋ABC 他0")).toBe(true);
    expect(m("秋A 月1")).toBe(false);
    expect(m("秋C 月5,6、木1,2")).toBe(false);
    expect(m("春B 月1")).toBe(false);
    expect(m("inui group")).toBe(false);
  });
});
