// 日付から年度・学期・モジュールを決める。表示するコースの絞り込みもここに置く。
import { MODULE_KEYS, type Mod, type ModuleKey, type ModulePeriods, type Term } from "../../lib/settings";
import type { Schedule } from "./parser";

export type Selection = { year: number; term: Term; module: Mod };

/** 4月始まりの年度。 */
export function academicYear(date: Date): number {
  return date.getMonth() + 1 >= 4 ? date.getFullYear() : date.getFullYear() - 1;
}

/** 年度と「MM-DD」から、比べるための数（YYYYMMDD）を作る。1〜3月は翌年の日付にする。 */
function dayNumber(year: number, mmdd: string): number {
  const [m, d] = mmdd.split("-").map(Number) as [number, number];
  const y = m >= 4 ? year : year + 1;
  return y * 10000 + m * 100 + d;
}

function toDayNumber(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function split(key: ModuleKey): { term: Term; module: Mod } {
  return { term: key[0] as Term, module: key[1] as Mod };
}

/**
 * 今日がどのモジュールかを決める。どの期間にも入らない日（休業期間）は、直後のモジュールを選ぶ。
 * periodsFor は年度ごとの期間を返す（オプション画面での上書きを反映するため）。
 */
export function detectSelection(date: Date, periodsFor: (year: number) => ModulePeriods): Selection {
  const today = toDayNumber(date);
  const ay = academicYear(date);
  for (const year of [ay, ay + 1]) {
    const periods = periodsFor(year);
    for (const key of MODULE_KEYS) {
      const p = periods[key];
      // 期間は順に並んでいるので、終わりが今日以降の最初のモジュールが「今」か「直後」になる
      const end = dayNumber(year, p.end);
      if (today <= end) return { year, ...split(key) };
    }
  }
  return { year: ay + 1, term: "春", module: "A" };
}

/** 選んだ学期とモジュールの授業か。 */
export function matchesSelection(schedule: Schedule, term: Term, module: Mod): boolean {
  return schedule.term === term && schedule.modules.includes(module);
}
