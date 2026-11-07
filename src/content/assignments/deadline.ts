// 締切までの残り時間の区分と、バッジの文言。
import type { Thresholds } from "../../lib/settings";

export type Level = "overdue" | "urgent" | "soon" | "week" | "later" | "none";

export const LEVELS: readonly Level[] = ["overdue", "urgent", "soon", "week", "later", "none"];

export const LEVEL_LABEL: Record<Level, string> = {
  overdue: "超過",
  urgent: "緊急",
  soon: "近い",
  week: "今週",
  later: "余裕",
  none: "締切なし",
};

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

export function classify(deadline: Date | null, now: Date, th: Thresholds): Level {
  if (!deadline) return "none";
  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) return "overdue";
  if (diff <= th.urgentHours * HOUR) return "urgent";
  if (diff <= th.soonHours * HOUR) return "soon";
  if (diff <= th.weekHours * HOUR) return "week";
  return "later";
}

/** バッジの文言（例：残り2日3時間、残り5時間20分、あと45分、超過、締切なし）。 */
export function formatRemaining(deadline: Date | null, now: Date): string {
  if (!deadline) return "締切なし";
  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) return "超過";
  // 分は切り上げる（残り 30 秒を「あと0分」にしない）
  const totalMinutes = Math.ceil(diff / MINUTE);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return hours > 0 ? `残り${days}日${hours}時間` : `残り${days}日`;
  if (hours > 0) return minutes > 0 ? `残り${hours}時間${minutes}分` : `残り${hours}時間`;
  return `あと${minutes}分`;
}

/** 締切順に並べる。締切なしは末尾、同じ締切は元の順。 */
export function compareByDeadline(
  a: { deadline: Date | null; index: number },
  b: { deadline: Date | null; index: number },
): number {
  const ta = a.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
  const tb = b.deadline?.getTime() ?? Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.index - b.index;
}

/** 締切から 30 日以上過ぎた非表示の記録か。締切なしの記録は自動では消さない。 */
export function isExpiredHidden(entry: { deadline: string | null }, now: Date): boolean {
  if (!entry.deadline) return false;
  return now.getTime() - new Date(entry.deadline).getTime() >= 30 * 24 * HOUR;
}
