// 学期とモジュール、モジュールの期間の定義。
// 期間は年度ごとに変わる。新しい年度の学年暦が出たら、PERIODS_BY_YEAR に年度を足す。

export type Term = "春" | "秋";
export type Mod = "A" | "B" | "C";
export type ModuleKey = `${Term}${Mod}`;

export const TERMS: readonly Term[] = ["春", "秋"];
export const MODS: readonly Mod[] = ["A", "B", "C"];
export const MODULE_KEYS: readonly ModuleKey[] = ["春A", "春B", "春C", "秋A", "秋B", "秋C"];

/** モジュールの期間。日付は「MM-DD」。1〜3月の日付は、その年度の翌年の日付として扱う。 */
export type Period = { start: string; end: string };
export type ModulePeriods = Record<ModuleKey, Period>;

/** PERIODS_BY_YEAR にない年度で使う、目安の期間。 */
export const DEFAULT_PERIODS: ModulePeriods = {
  春A: { start: "04-08", end: "05-20" },
  春B: { start: "05-21", end: "06-30" },
  春C: { start: "07-01", end: "08-10" },
  秋A: { start: "10-01", end: "11-10" },
  秋B: { start: "11-11", end: "12-26" },
  秋C: { start: "01-05", end: "02-15" },
};

/**
 * 大学の学年暦から写した、年度ごとの期間。キーは年度（4月始まり）。
 * 書いたモジュールだけが DEFAULT_PERIODS を上書きする。
 * 例：
 *   2027: {
 *     春A: { start: "04-12", end: "05-21" },
 *     秋C: { start: "01-06", end: "02-14" }, // 2028年1月6日〜2月14日
 *   },
 */
export const PERIODS_BY_YEAR: Readonly<Record<number, Partial<ModulePeriods>>> = {
  // 2026年度は学年暦をまだ写していないため、目安の期間を使う
};

/** 拡張機能に入っている、その年度の期間（学年暦がなければ目安の期間）。 */
export function builtinPeriods(year: number, table: Readonly<Record<number, Partial<ModulePeriods>>> = PERIODS_BY_YEAR): ModulePeriods {
  return { ...DEFAULT_PERIODS, ...(table[year] ?? {}) };
}

/** その年度の学年暦が PERIODS_BY_YEAR に入っているか。 */
export function hasBuiltinCalendar(year: number, table: Readonly<Record<number, Partial<ModulePeriods>>> = PERIODS_BY_YEAR): boolean {
  return table[year] !== undefined;
}

/** 年度と「MM-DD」から「YYYY-MM-DD」を作る。1〜3月は翌年の日付にする。 */
export function dateInYear(year: number, mmdd: string): string {
  const month = Number(mmdd.slice(0, 2));
  return `${month >= 4 ? year : year + 1}-${mmdd}`;
}

/** 「YYYY-MM-DD」を、大小を比べられる数（YYYYMMDD）にする。 */
export function dayNumber(isoDate: string): number {
  return Number(isoDate.replaceAll("-", ""));
}

/** モジュールの期間の誤り。誤りがなければ空文字。 */
export function validatePeriods(year: number, periods: ModulePeriods): string {
  let prevEnd = 0;
  for (const key of MODULE_KEYS) {
    const start = dayNumber(dateInYear(year, periods[key].start));
    const end = dayNumber(dateInYear(year, periods[key].end));
    if (start > end) return `${year}年度の${key}は、終了日を開始日以降にしてください`;
    if (start <= prevEnd) return `${year}年度の${key}は、前のモジュールの終了日より後に始まるようにしてください`;
    prevEnd = end;
  }
  return "";
}
