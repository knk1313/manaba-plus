import { describe, expect, it } from "vitest";
import { parseCoursePage, parsePeriods, parseSchedule, parseYearOptions } from "../src/content/timetable/parser";
import { loadFixture } from "./helpers";

describe("parseSchedule", () => {
  it("学期・モジュール・曜日時限を読む", () => {
    const s = parseSchedule("秋AB 月1,2");
    expect(s.term).toBe("秋");
    expect(s.modules).toEqual(["A", "B"]);
    expect(s.slots).toEqual([
      { day: "月", period: 1 },
      { day: "月", period: 2 },
    ]);
  });

  it("全角の読点で区切った複数の曜日を読む", () => {
    const s = parseSchedule("秋C 月5,6、木1,2");
    expect(s.modules).toEqual(["C"]);
    expect(s.slots).toEqual([
      { day: "月", period: 5 },
      { day: "月", period: 6 },
      { day: "木", period: 1 },
      { day: "木", period: 2 },
    ]);
  });

  it("範囲の表記を展開する", () => {
    expect(parseSchedule("春B 火1-3").slots.map((s) => s.period)).toEqual([1, 2, 3]);
    expect(parsePeriods("1,3-4")).toEqual([1, 3, 4]);
    expect(parsePeriods("3-1")).toBeNull();
  });

  it("全角の英数字を半角として読む", () => {
    const s = parseSchedule("秋ＡＢ 水５，６");
    expect(s.modules).toEqual(["A", "B"]);
    expect(s.slots.map((x) => x.period)).toEqual([5, 6]);
  });

  it("他0は時限なしにする", () => {
    const s = parseSchedule("春ABC 他0");
    expect(s.term).toBe("春");
    expect(s.modules).toEqual(["A", "B", "C"]);
    expect(s.slots).toEqual([]);
  });

  it.each(["", "inui group", "夏季休業中", "通年", "集中", "応談", "随時"])("想定外の表記「%s」でも例外を投げない", (raw) => {
    const s = parseSchedule(raw);
    expect(s.term).toBeNull();
    expect(s.slots).toEqual([]);
    expect(s.raw).toBe(raw);
  });

  it("学期はあるが時限が読めない部分は無視する", () => {
    const s = parseSchedule("秋A 集中、月1");
    expect(s.slots).toEqual([{ day: "月", period: 1 }]);
  });
});

describe("parseCoursePage", () => {
  it("サムネイル表示のコースを読む", () => {
    const r = parseCoursePage(loadFixture("home_all_y2026.html"));
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.courses).toHaveLength(8);
    const q = r.courses[0]!;
    expect(q).toMatchObject({ href: "course_4128001", name: "量子情報科学入門", code: "GB20601", year: "2026", teachers: "教員 A、教員 B" });
    expect(q.schedule.slots).toHaveLength(4);
    expect(r.courses.find((c) => c.href === "course_4128005")!.schedule.raw).toBe("");
  });

  it("コース一覧がなければ login を返す", () => {
    expect(parseCoursePage(loadFixture("login.html")).kind).toBe("login");
  });

  it("コースが 0 件の年度は空の一覧にする", () => {
    const doc = new DOMParser().parseFromString(
      '<div class="my-infolist my-infolist-mycourses"><div class="mycourses-body"><div class="section"></div></div></div>',
      "text/html",
    );
    expect(parseCoursePage(doc)).toEqual({ kind: "ok", courses: [] });
  });

  it("コースのリンクはあるが形式が読めなければ unknown を返す", () => {
    const doc = new DOMParser().parseFromString(
      '<div class="my-infolist my-infolist-mycourses"><div><a href="course_1">何か</a></div></div>',
      "text/html",
    );
    expect(parseCoursePage(doc).kind).toBe("unknown");
  });

  it("表の行（リスト表示を想定）からも読む", () => {
    const doc = new DOMParser().parseFromString(
      `<div class="my-infolist my-infolist-mycourses"><table><tr><th>コース名</th></tr>
       <tr><td><a href="course_10">解析学</a></td><td>GB12345</td><td>2026 秋AB 月1,2</td></tr></table></div>`,
      "text/html",
    );
    const r = parseCoursePage(doc);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.courses[0]).toMatchObject({ name: "解析学", code: "GB12345", year: "2026" });
  });
});

describe("parseYearOptions", () => {
  it("年度の select から年度を新しい順に取り出す", () => {
    expect(parseYearOptions(loadFixture("home_all_y2026.html"))).toEqual([2026, 2025, 2024]);
  });
});
