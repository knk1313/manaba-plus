import { describe, expect, it } from "vitest";
import { builtinStarts, DEFAULT_STARTS } from "../src/lib/modulePeriods";
import { DEFAULT_SETTINGS, normalizeSettings, startsForYear, validateThresholds } from "../src/lib/settings";

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

describe("normalizeSettings", () => {
  it("欠けた項目を既定値で補う", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ thresholds: { urgentHours: 12 } }).thresholds).toEqual({ urgentHours: 12, soonHours: 72, weekHours: 168 });
  });
});

describe("startsForYear", () => {
  it("オプション画面での上書きが、拡張機能の開始日より優先される", () => {
    const settings = { ...DEFAULT_SETTINGS, moduleStartsByYear: { "2026": { 秋A: "10-02" } } };
    expect(startsForYear(settings, 2026).秋A).toBe("10-02");
    expect(startsForYear(settings, 2026).秋B).toBe(builtinStarts(2026).秋B);
    expect(startsForYear(settings, 2030).秋A).toBe(DEFAULT_STARTS.秋A);
  });
});

describe("normalizeSettings（以前の版の保存データ）", () => {
  it("開始日と終了日の形から、開始日だけを取り出す", () => {
    const old = { modulePeriodsByYear: { "2026": { 秋A: { start: "10-02", end: "11-10" } } } };
    expect(normalizeSettings(old).moduleStartsByYear).toEqual({ "2026": { 秋A: "10-02" } });
  });
});
