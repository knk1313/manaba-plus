import { describe, expect, it } from "vitest";
import { parseCoursePage, type Course } from "../src/content/timetable/parser";
import { buildTimetable, currentPeriod } from "../src/content/timetable/render";
import { loadFixture } from "./helpers";

function courses(): Course[] {
  const r = parseCoursePage(loadFixture("home_all_y2026.html"));
  if (r.kind !== "ok") throw new Error("fixture");
  return r.courses;
}

/** 曜日と時限のセルにあるコース名。 */
function cell(el: HTMLElement, day: string, period: number): string[] {
  const heads = [...el.querySelectorAll("thead th")].map((th) => th.textContent?.replace("（今日）", "") ?? "");
  const col = heads.indexOf(day);
  const row = el.querySelectorAll("tbody tr")[period - 1]!;
  return [...row.children[col]!.querySelectorAll("a")].map((a) => a.textContent ?? "");
}

function others(el: HTMLElement): string[] {
  return [...el.querySelectorAll(".mp-tt__chip > span:first-child")].map((s) => s.textContent ?? "");
}

const build = (module: "A" | "B" | "C", opts: { sat?: boolean; now?: Date | null } = {}) =>
  buildTimetable({ courses: courses(), selection: { year: 2026, term: "秋", module }, alwaysShowSaturday: opts.sat ?? false, now: opts.now ?? null });

describe("buildTimetable", () => {
  it("秋AB のコースは秋A・秋B で月1・2限に出て、秋C では出ない", () => {
    expect(cell(build("A"), "月", 1)).toEqual(["線形代数"]);
    expect(cell(build("B"), "月", 2)).toEqual(["線形代数"]);
    expect(cell(build("C"), "月", 1)).toEqual([]);
  });

  it("秋C 月5,6、木1,2 のコースは4コマに出る", () => {
    const el = build("C");
    for (const [d, p] of [["月", 5], ["月", 6], ["木", 1], ["木", 2]] as const) expect(cell(el, d, p)).toContain("量子情報科学入門");
  });

  it("他0・空・自由記述のコースは「その他」に出る", () => {
    expect(others(build("A"))).toEqual(["授業アンケート", "研究室", "専門英語"]);
  });

  it("土曜の列は、設定したときだけ出す", () => {
    const days = (el: HTMLElement) => [...el.querySelectorAll("thead th")].slice(1).map((th) => th.textContent);
    expect(days(build("A"))).toEqual(["月", "火", "水", "木", "金"]);
    expect(days(build("A", { sat: true }))).toEqual(["月", "火", "水", "木", "金", "土"]);
  });

  it("今日の列と今の時限を強調する", () => {
    const el = build("C", { now: new Date(2026, 0, 7, 9, 0) }); // 水曜 1限（木曜でない日も列は出る）
    expect(el.querySelector("thead th.mp-is-today")?.textContent).toContain("水");
    expect(el.querySelectorAll("td.mp-is-now")).toHaveLength(1);
  });

  it("コース名のツールチップに科目番号と担当を出す", () => {
    const a = build("A").querySelector<HTMLAnchorElement>("a.mp-tt__course")!;
    expect(a.title).toContain("科目番号：GB10001");
    expect(a.title).toContain("担当：教員 C");
  });
});

describe("currentPeriod", () => {
  it("授業の時間内なら時限、時間外なら null", () => {
    expect(currentPeriod(new Date(2026, 10, 9, 8, 40))).toBe(1);
    expect(currentPeriod(new Date(2026, 10, 9, 10, 0))).toBeNull();
    expect(currentPeriod(new Date(2026, 10, 9, 17, 0))).toBe(6);
  });
});
