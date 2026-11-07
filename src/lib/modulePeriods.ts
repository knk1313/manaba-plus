// 学期とモジュール、モジュールの開始日の定義。
// 各モジュールは、次のモジュールの開始日の前日まで続くものとして扱う（休業期間は直前のモジュール）。
// 終了日は持たない。学年暦で確かめられる開始日だけで決めるため。
// 開始日は年度ごとに変わる。新しい年度の学年暦が出たら、STARTS_BY_YEAR に年度を足す。

export type Term = "春" | "秋";
export type Mod = "A" | "B" | "C";
export type ModuleKey = `${Term}${Mod}`;

export const TERMS: readonly Term[] = ["春", "秋"];
export const MODS: readonly Mod[] = ["A", "B", "C"];
export const MODULE_KEYS: readonly ModuleKey[] = ["春A", "春B", "春C", "秋A", "秋B", "秋C"];

/** モジュールごとの開始日。日付は「MM-DD」。1〜3月の日付は、その年度の翌年の日付として扱う。 */
export type ModuleStarts = Record<ModuleKey, string>;

type StartsTable = Readonly<Record<number, Partial<ModuleStarts>>>;

/** STARTS_BY_YEAR にない年度で使う、目安の開始日。 */
export const DEFAULT_STARTS: ModuleStarts = {
  春A: "04-08",
  春B: "05-21",
  春C: "07-01",
  秋A: "10-01",
  秋B: "11-11",
  秋C: "01-05",
};

/**
 * 大学の学年暦から写した、年度ごとの開始日。キーは年度（4月始まり）。
 * 書いたモジュールだけが DEFAULT_STARTS を上書きする。
 */
export const STARTS_BY_YEAR: StartsTable = {
  2026: { 春A: "04-14", 春B: "05-26", 春C: "07-02", 秋A: "10-01", 秋B: "11-12", 秋C: "01-06" },
};

/** 拡張機能に入っている、その年度の開始日（学年暦がなければ目安）。 */
export function builtinStarts(year: number, table: StartsTable = STARTS_BY_YEAR): ModuleStarts {
  return { ...DEFAULT_STARTS, ...(table[year] ?? {}) };
}

/** その年度の学年暦が STARTS_BY_YEAR に入っているか。 */
export function hasBuiltinCalendar(year: number, table: StartsTable = STARTS_BY_YEAR): boolean {
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

/** 開始日の誤り（春Aから秋Cへ順に後になっていない）。誤りがなければ空文字。 */
export function validateStarts(year: number, starts: ModuleStarts): string {
  let prev = 0;
  let prevKey: ModuleKey | null = null;
  for (const key of MODULE_KEYS) {
    const day = dayNumber(dateInYear(year, starts[key]));
    if (prevKey && day <= prev) return `${year}年度の${key}の開始日は、${prevKey}の開始日より後にしてください`;
    prev = day;
    prevKey = key;
  }
  return "";
}
