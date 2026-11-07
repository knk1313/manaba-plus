import { describe, expect, it } from "vitest";
import { findAssignmentTable, parseJstDateTime } from "../src/content/assignments/parser";
import { classify, compareByDeadline, formatRemaining, isExpiredHidden } from "../src/content/assignments/deadline";
import { DEFAULT_SETTINGS } from "../src/lib/settings";
import { loadFixture } from "./helpers";

const th = DEFAULT_SETTINGS.thresholds;
const now = parseJstDateTime("2026-11-07 12:00")!;
const at = (s: string) => parseJstDateTime(s)!;

describe("parseJstDateTime", () => {
  it("日本時間として読む", () => {
    expect(parseJstDateTime("2026-11-08 23:55")!.toISOString()).toBe("2026-11-08T14:55:00.000Z");
    expect(parseJstDateTime(" ～ 2026-11-08 23:55")!.toISOString()).toBe("2026-11-08T14:55:00.000Z");
    expect(parseJstDateTime("")).toBeNull();
  });
});

describe("findAssignmentTable", () => {
  it("課題の行を読む", () => {
    const t = findAssignmentTable(loadFixture("home_library_query.html"))!;
    expect(t.headerRow?.className).toBe("title");
    expect(t.items).toHaveLength(4);
    expect(t.items[0]).toMatchObject({ key: "course_4123591_report_4378640", title: "課題3", course: "応用数学", index: 0 });
    expect(t.items[0]!.deadline!.toISOString()).toBe("2026-11-08T14:55:00.000Z");
    expect(t.items[2]!.deadline).toBeNull();
  });

  it("課題の表がなければ null", () => {
    expect(findAssignmentTable(loadFixture("login.html"))).toBeNull();
  });
});

describe("classify", () => {
  it.each([
    ["2026-11-07 11:59", "overdue"],
    ["2026-11-07 12:00", "overdue"],
    ["2026-11-08 12:00", "urgent"],
    ["2026-11-08 12:01", "soon"],
    ["2026-11-10 12:00", "soon"],
    ["2026-11-14 12:00", "week"],
    ["2026-11-14 12:01", "later"],
  ])("%s は %s", (deadline, level) => {
    expect(classify(at(deadline), now, th)).toBe(level);
  });

  it("締切がなければ none", () => {
    expect(classify(null, now, th)).toBe("none");
  });

  it("閾値の変更を反映する", () => {
    expect(classify(at("2026-11-09 12:00"), now, { ...th, urgentHours: 48 })).toBe("urgent");
  });
});

describe("formatRemaining", () => {
  it.each([
    ["2026-11-09 15:00", "残り2日3時間"],
    ["2026-11-09 12:00", "残り2日"],
    ["2026-11-07 17:20", "残り5時間20分"],
    ["2026-11-07 13:00", "残り1時間"],
    ["2026-11-07 12:45", "あと45分"],
    ["2026-11-07 11:00", "超過"],
  ])("%s は「%s」", (deadline, label) => {
    expect(formatRemaining(at(deadline), now)).toBe(label);
  });

  it("1分未満は「あと1分」", () => {
    expect(formatRemaining(new Date(now.getTime() + 30_000), now)).toBe("あと1分");
  });

  it("締切なし", () => {
    expect(formatRemaining(null, now)).toBe("締切なし");
  });
});

describe("compareByDeadline", () => {
  it("締切の昇順で、締切なしは末尾", () => {
    const items = [
      { deadline: null, index: 0 },
      { deadline: at("2026-11-10 00:00"), index: 1 },
      { deadline: at("2026-11-08 00:00"), index: 2 },
      { deadline: at("2026-11-08 00:00"), index: 3 },
    ];
    expect(items.sort(compareByDeadline).map((i) => i.index)).toEqual([2, 3, 1, 0]);
  });
});

describe("isExpiredHidden", () => {
  it("締切から30日以上過ぎたら消す", () => {
    expect(isExpiredHidden({ deadline: "2026-10-08T03:00:00.000Z" }, now)).toBe(true);
    expect(isExpiredHidden({ deadline: "2026-10-09T03:00:00.000Z" }, now)).toBe(false);
    expect(isExpiredHidden({ deadline: null }, now)).toBe(false);
  });
});
