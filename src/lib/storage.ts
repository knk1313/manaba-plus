// chrome.storage のラッパー。キーの名前はここにまとめる。
import { normalizeSettings, type Settings } from "./settings";

export const KEYS = {
  settings: "settings", // sync
  panelOpen: "timetable:panelOpen", // local
  selection: "timetable:selection", // local
  cachePrefix: "timetable:cache:", // local + 年度
  sortByDeadline: "assignments:sortByDeadline", // local
  showHidden: "assignments:showHidden", // local
  hiddenPrefix: "hidden:", // sync + 課題の href
} as const;

export async function getLocal<T>(key: string): Promise<T | undefined> {
  const r = await chrome.storage.local.get(key);
  return r[key] as T | undefined;
}

export async function setLocal(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getSettings(): Promise<Settings> {
  const r = await chrome.storage.sync.get(KEYS.settings);
  return normalizeSettings(r[KEYS.settings]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [KEYS.settings]: settings });
}

/** 非表示にした課題の記録。 */
export type HiddenEntry = {
  hiddenAt: number;
  title: string;
  course: string;
  /** 受付終了日時（ISO 8601）。締切がなければ null */
  deadline: string | null;
};

export async function getHiddenAll(): Promise<Map<string, HiddenEntry>> {
  const all = await chrome.storage.sync.get(null);
  const map = new Map<string, HiddenEntry>();
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith(KEYS.hiddenPrefix)) map.set(k.slice(KEYS.hiddenPrefix.length), v as HiddenEntry);
  }
  return map;
}

export async function setHidden(href: string, entry: HiddenEntry): Promise<void> {
  await chrome.storage.sync.set({ [KEYS.hiddenPrefix + href]: entry });
}

export async function removeHidden(hrefs: string[]): Promise<void> {
  if (hrefs.length === 0) return;
  await chrome.storage.sync.remove(hrefs.map((h) => KEYS.hiddenPrefix + h));
}

/** 時間割のキャッシュをすべて消す。 */
export async function clearTimetableCache(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith(KEYS.cachePrefix)));
}
