// 時間割のデータ：home__all_y{YYYY} を読み込んでコースを取り出し、年度ごとにキャッシュする。
import { warn } from "../../lib/log";
import { getLocal, KEYS, setLocal } from "../../lib/storage";
import { parseCoursePage, type Course } from "./parser";

const CACHE_TTL = 6 * 60 * 60 * 1000;
const CACHE_VERSION = 1;

type CacheEntry = { v: number; fetchedAt: number; courses: Course[] };

export type LoadResult =
  | { kind: "ok"; courses: Course[]; fetchedAt: number }
  /** ログインが切れている */
  | { kind: "login" }
  /** コース一覧の形式を読み取れない */
  | { kind: "unknown" }
  /** 通信に失敗した */
  | { kind: "error" };

/** 年度のコースを返す。force でなければ、6時間以内のキャッシュを使う。 */
export async function loadCourses(year: number, force: boolean): Promise<LoadResult> {
  const cacheKey = KEYS.cachePrefix + year;
  if (!force) {
    const cached = await getLocal<CacheEntry>(cacheKey);
    if (cached && cached.v === CACHE_VERSION && Date.now() - cached.fetchedAt < CACHE_TTL) {
      return { kind: "ok", courses: cached.courses, fetchedAt: cached.fetchedAt };
    }
  }
  let html: string;
  try {
    // この URL は表示の設定（現在のコース、一覧の形式）を変えない
    const res = await fetch(`home__all_y${year}`, { credentials: "include" });
    if (!res.ok) {
      warn(`コース一覧の取得に失敗しました（HTTP ${res.status}）`);
      return { kind: "error" };
    }
    html = await res.text();
  } catch (e) {
    warn("コース一覧の取得に失敗しました", e);
    return { kind: "error" };
  }
  const result = parseCoursePage(new DOMParser().parseFromString(html, "text/html"));
  if (result.kind !== "ok") {
    warn(result.kind === "login" ? "取得した HTML にコース一覧がありません（ログイン切れ）" : "コース一覧の形式を読み取れませんでした");
    return result;
  }
  const entry: CacheEntry = { v: CACHE_VERSION, fetchedAt: Date.now(), courses: result.courses };
  await setLocal(cacheKey, entry).catch((e) => warn("時間割のキャッシュを保存できませんでした", e));
  return { kind: "ok", courses: result.courses, fetchedAt: entry.fetchedAt };
}
