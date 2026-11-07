import { describe, expect, it } from "vitest";
import { DEFAULT_PERIODS } from "../src/lib/modulePeriods";
import { DEFAULT_SETTINGS, normalizeSettings, periodsForYear, validateThresholds } from "../src/lib/settings";

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

describe("periodsForYear", () => {
  it("オプション画面での上書きが、拡張機能の期間より優先される", () => {
    const settings = { ...DEFAULT_SETTINGS, modulePeriodsByYear: { "2026": { 秋A: { start: "10-02", end: "11-09" } } } };
    expect(periodsForYear(settings, 2026).秋A).toEqual({ start: "10-02", end: "11-09" });
    expect(periodsForYear(settings, 2026).秋B).toEqual(DEFAULT_PERIODS.秋B);
    expect(periodsForYear(settings, 2027).秋A).toEqual(DEFAULT_PERIODS.秋A);
  });
});
