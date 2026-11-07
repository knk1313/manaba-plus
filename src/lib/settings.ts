// 利用者が変えられる設定と既定値。オプション画面と content script の両方が使う。

export type Term = "春" | "秋";
export type Mod = "A" | "B" | "C";
export type ModuleKey = `${Term}${Mod}`;

export const TERMS: readonly Term[] = ["春", "秋"];
export const MODS: readonly Mod[] = ["A", "B", "C"];
export const MODULE_KEYS: readonly ModuleKey[] = ["春A", "春B", "春C", "秋A", "秋B", "秋C"];

/** モジュールの期間。日付は「MM-DD」。1〜3月の日付は、その年度の翌年の日付として扱う。 */
export type Period = { start: string; end: string };
export type ModulePeriods = Record<ModuleKey, Period>;

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

export const DEFAULT_PERIODS: ModulePeriods = {
  春A: { start: "04-08", end: "05-20" },
  春B: { start: "05-21", end: "06-30" },
  春C: { start: "07-01", end: "08-10" },
  秋A: { start: "10-01", end: "11-10" },
  秋B: { start: "11-11", end: "12-26" },
  秋C: { start: "01-05", end: "02-15" },
};

export const DEFAULT_SETTINGS: Settings = {
  thresholds: { urgentHours: 24, soonHours: 72, weekHours: 168 },
  modulePeriodsByYear: {},
  panelDefaultOpen: true,
  alwaysShowSaturday: false,
};

/** 年度の期間（既定値に、その年度の上書きを重ねたもの）。 */
export function periodsForYear(settings: Settings, year: number): ModulePeriods {
  return { ...DEFAULT_PERIODS, ...(settings.modulePeriodsByYear[String(year)] ?? {}) };
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
