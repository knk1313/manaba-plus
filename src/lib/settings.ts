// 利用者が変えられる設定と既定値。オプション画面と content script の両方が使う。
import { builtinPeriods, type ModulePeriods } from "./modulePeriods";

export type Thresholds = {
  /** 「緊急」とする残り時間（時間） */
  urgentHours: number;
  /** 「近い」とする残り時間（時間） */
  soonHours: number;
  /** 「今週」とする残り時間（時間） */
  weekHours: number;
};

export type Settings = {
  thresholds: Thresholds;
  /** 年度ごとに上書きしたモジュールの期間。キーは年度（"2026" など） */
  modulePeriodsByYear: Record<string, Partial<ModulePeriods>>;
  /** 時間割パネルを初めて開いたときに開いておくか */
  panelDefaultOpen: boolean;
  /** 土曜の授業がなくても土曜の列を出すか */
  alwaysShowSaturday: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  thresholds: { urgentHours: 24, soonHours: 72, weekHours: 168 },
  modulePeriodsByYear: {},
  panelDefaultOpen: true,
  alwaysShowSaturday: false,
};

/**
 * 年度の期間。目安の期間 ＜ 拡張機能に入っている学年暦 ＜ オプション画面での上書き、の順に重ねる。
 */
export function periodsForYear(settings: Settings, year: number): ModulePeriods {
  return { ...builtinPeriods(year), ...(settings.modulePeriodsByYear[String(year)] ?? {}) };
}

/** 保存されていた値を、欠けた項目を既定値で補って Settings にする。 */
export function normalizeSettings(raw: unknown): Settings {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<Settings>;
  return {
    thresholds: { ...DEFAULT_SETTINGS.thresholds, ...(s.thresholds ?? {}) },
    modulePeriodsByYear: s.modulePeriodsByYear ?? {},
    panelDefaultOpen: s.panelDefaultOpen ?? DEFAULT_SETTINGS.panelDefaultOpen,
    alwaysShowSaturday: s.alwaysShowSaturday ?? DEFAULT_SETTINGS.alwaysShowSaturday,
  };
}

const THRESHOLD_LABELS: Record<keyof Thresholds, string> = { urgentHours: "緊急", soonHours: "近い", weekHours: "今週" };
const THRESHOLD_ORDER: readonly (keyof Thresholds)[] = ["urgentHours", "soonHours", "weekHours"];

/** 閾値の入力の誤り。項目ごとに文言を返し、誤りがなければ空のオブジェクト。 */
export function validateThresholds(values: Record<keyof Thresholds, number>): Partial<Record<keyof Thresholds, string>> {
  const errors: Partial<Record<keyof Thresholds, string>> = {};
  THRESHOLD_ORDER.forEach((key, i) => {
    const v = values[key];
    const label = THRESHOLD_LABELS[key];
    if (!Number.isInteger(v) || v < 1) {
      errors[key] = `${label}の時間は、1以上の整数で入力してください`;
      return;
    }
    const prevKey = THRESHOLD_ORDER[i - 1];
    if (prevKey && !errors[prevKey] && v <= values[prevKey]) {
      errors[key] = `${label}の時間は、${THRESHOLD_LABELS[prevKey]}の時間（${values[prevKey]}）より大きくしてください`;
    }
  });
  return errors;
}
