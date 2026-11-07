// 日付から年度・学期・モジュールを決める。表示するコースの絞り込みもここに置く。
import { dateInYear, dayNumber, MODULE_KEYS, type Mod, type ModuleKey, type ModuleStarts, type Term } from "../../lib/modulePeriods";
import type { Schedule } from "./parser";

export type Selection = { year: number; term: Term; module: Mod };

/** 4月始まりの年度。 */
export function academicYear(date: Date): number {
  return date.getMonth() + 1 >= 4 ? date.getFullYear() : date.getFullYear() - 1;
}

function toDayNumber(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function split(key: ModuleKey): { term: Term; module: Mod } {
  return { term: key[0] as Term, module: key[1] as Mod };
}

/**
 * 今日がどのモジュールかを決める。開始日が今日以前のモジュールのうち、いちばん新しいものを選ぶ。
 * 休業期間は直前のモジュールになる。4月の春Aの開始日より前は、前の年度の秋Cになる。
 * startsFor は年度ごとの開始日を返す（オプション画面での上書きを反映するため）。
 */
export function detectSelection(date: Date, startsFor: (year: number) => ModuleStarts): Selection {
  const today = toDayNumber(date);
  const ay = academicYear(date);
  let found: Selection | null = null;
  for (const year of [ay - 1, ay]) {
    const starts = startsFor(year);
    for (const key of MODULE_KEYS) {
      if (dayNumber(dateInYear(year, starts[key])) <= today) found = { year, ...split(key) };
    }
  }
  return found ?? { year: ay, term: "春", module: "A" };
}

/** 選んだ学期とモジュールの授業か。 */
export function matchesSelection(schedule: Schedule, term: Term, module: Mod): boolean {
  return schedule.term === term && schedule.modules.includes(module);
}
