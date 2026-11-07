import { describe, expect, it } from "vitest";
import { dateInYear, DEFAULT_PERIODS, DEFAULT_SETTINGS, normalizeSettings, validatePeriods, validateThresholds } from "../src/lib/settings";

describe("dateInYear", () => {
  it("4〜12月はその年、1〜3月は翌年", () => {
    expect(dateInYear(2026, "10-01")).toBe("2026-10-01");
    expect(dateInYear(2026, "02-15")).toBe("2027-02-15");
  });
});

describe("validateThresholds", () => {
  it("既定値は誤りなし", () => {
    expect(validateThresholds(DEFAULT_SETTINGS.thresholds)).toEqual({});
  });

  it("1未満や整数でない値は誤り", () => {
    expect(validateThresholds({ urgentHours: 0, soonHours: 72, weekHours: 1.5 })).toEqual({
      urgentHours: "緊急の時間は、1以上の整数で入力してください",
      weekHours: "今週の時間は、1以上の整数で入力してください",
    });
    expect(validateThresholds({ urgentHours: Number.NaN, soonHours: 72, weekHours: 168 }).urgentHours).toBeDefined();
  });

  it("前の項目以下の値は誤り", () => {
    expect(validateThresholds({ urgentHours: 24, soonHours: 24, weekHours: 168 })).toEqual({
      soonHours: "近いの時間は、緊急の時間（24）より大きくしてください",
    });
  });

  it("前の項目が誤りなら、大小は比べない", () => {
    expect(Object.keys(validateThresholds({ urgentHours: -1, soonHours: 10, weekHours: 168 }))).toEqual(["urgentHours"]);
  });
});

describe("validatePeriods", () => {
  it("既定の期間は誤りなし", () => {
    expect(validatePeriods(2026, DEFAULT_PERIODS)).toBe("");
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

describe("normalizeSettings", () => {
  it("欠けた項目を既定値で補う", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ thresholds: { urgentHours: 12 } }).thresholds).toEqual({ urgentHours: 12, soonHours: 72, weekHours: 168 });
  });
});
