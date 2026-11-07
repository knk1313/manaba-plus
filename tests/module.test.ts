import { describe, expect, it } from "vitest";
import { academicYear, detectSelection, matchesSelection } from "../src/content/timetable/module";
import { parseSchedule } from "../src/content/timetable/parser";
import { builtinStarts, DEFAULT_STARTS } from "../src/lib/modulePeriods";
import { DEFAULT_SETTINGS, startsForYear } from "../src/lib/settings";

const d = (s: string) => {
  const [y, m, day] = s.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, day, 12, 0);
};
const defaults = () => DEFAULT_STARTS;

describe("academicYear", () => {
  it("4月始まりで数える", () => {
    expect(academicYear(d("2026-04-01"))).toBe(2026);
    expect(academicYear(d("2026-03-31"))).toBe(2025);
    expect(academicYear(d("2027-02-10"))).toBe(2026);
  });
});

describe("detectSelection（目安の開始日）", () => {
  it.each([
    ["2026-04-08", 2026, "春", "A"],
    ["2026-05-20", 2026, "春", "A"],
    ["2026-05-21", 2026, "春", "B"],
    ["2026-07-15", 2026, "春", "C"],
    ["2026-11-10", 2026, "秋", "A"],
    ["2026-11-11", 2026, "秋", "B"],
    ["2027-01-20", 2026, "秋", "C"],
  ] as const)("%s は %i年度 %s%s", (date, year, term, module) => {
    expect(detectSelection(d(date), defaults)).toEqual({ year, term, module });
  });

  it.each([
    ["2026-08-20", 2026, "春", "C"], // 夏季休業
    ["2026-12-30", 2026, "秋", "B"], // 冬季休業
    ["2027-03-01", 2026, "秋", "C"], // 春季休業
    ["2026-04-01", 2025, "秋", "C"], // 年度の初め（春Aの前）
  ] as const)("休業期間の %s は直前の %i年度 %s%s", (date, year, term, module) => {
    expect(detectSelection(d(date), defaults)).toEqual({ year, term, module });
  });

  it("オプション画面での上書きを使う", () => {
    const settings = { ...DEFAULT_SETTINGS, moduleStartsByYear: { "2026": { 秋B: "11-05" } } };
    expect(detectSelection(d("2026-11-07"), (y) => startsForYear(settings, y))).toEqual({ year: 2026, term: "秋", module: "B" });
  });
});

describe("detectSelection（2026年度の学年暦）", () => {
  it.each([
    ["2026-04-13", 2025, "秋", "C"], // 春Aの前日は、前の年度の秋C
    ["2026-04-14", 2026, "春", "A"],
    ["2026-05-25", 2026, "春", "A"],
    ["2026-05-26", 2026, "春", "B"],
    ["2026-07-02", 2026, "春", "C"],
    ["2026-09-30", 2026, "春", "C"],
    ["2026-11-07", 2026, "秋", "A"],
    ["2026-11-11", 2026, "秋", "A"],
    ["2026-11-12", 2026, "秋", "B"],
    ["2027-01-05", 2026, "秋", "B"],
    ["2027-01-06", 2026, "秋", "C"],
  ] as const)("%s は %i年度 %s%s", (date, year, term, module) => {
    expect(detectSelection(d(date), builtinStarts)).toEqual({ year, term, module });
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
