// F1：ホームの時間割。コース一覧と課題の列の上に、全幅のパネルを出す。
import { warn } from "../../lib/log";
import { periodsForYear, type Settings } from "../../lib/settings";
import { getLocal, getSettings, KEYS, setLocal } from "../../lib/storage";
import { academicYear, detectSelection, type Selection } from "./module";
import { parseCoursePage, parseYearOptions, type Course } from "./parser";
import { buildTimetable, TimetablePanel } from "./render";

const CACHE_TTL = 6 * 60 * 60 * 1000;
const CACHE_VERSION = 1;

type CacheEntry = { v: number; fetchedAt: number; courses: Course[] };
type SavedSelection = { date: string; selection: Selection };

type LoadResult = { kind: "ok"; courses: Course[]; fetchedAt: number } | { kind: "login" } | { kind: "unknown" } | { kind: "error" };

function todayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function formatFetchedAt(t: number): string {
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}時点`;
}

async function loadCourses(year: number, force: boolean): Promise<LoadResult> {
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

export async function initTimetable(doc: Document): Promise<void> {
  const left = doc.querySelector("div.contentbody-left");
  if (!left || !left.querySelector("div.my-infolist-mycourses")) {
    warn("ホームのコース一覧（div.contentbody-left）が見つからないため、時間割を出しません");
    return;
  }
  if (doc.querySelector(".mp-tt")) return; // 二重に出さない

  const settings: Settings = await getSettings();
  const now = new Date();
  const current = detectSelection(now, (y) => periodsForYear(settings, y));

  let years = parseYearOptions(doc);
  if (years.length === 0) {
    warn("年度の選択肢が見つからないため、今年度だけを選べるようにします");
    years = [academicYear(now)];
  }

  const saved = await getLocal<SavedSelection>(KEYS.selection);
  let selection: Selection = saved && saved.date === todayKey(now) ? saved.selection : current;
  if (!years.includes(selection.year)) {
    // 3月に次の年度を選んだが、まだ manaba に次の年度がないときなど
    selection = { ...selection, year: years[0]! };
  }

  const open = (await getLocal<boolean>(KEYS.panelOpen)) ?? settings.panelDefaultOpen;
  let loadedOnce = false;
  let requestId = 0;

  const render = async (force: boolean) => {
    loadedOnce = true;
    const id = ++requestId;
    const sel = selection;
    panel.showLoading();
    panel.setStatus(force ? "読み込んでいます" : "");
    const result = await loadCourses(sel.year, force);
    if (id !== requestId) return; // 古い要求の結果は捨てる
    switch (result.kind) {
      case "ok": {
        const isCurrent = sel.year === current.year && sel.term === current.term && sel.module === current.module;
        panel.showTable(
          buildTimetable({ courses: result.courses, selection: sel, alwaysShowSaturday: settings.alwaysShowSaturday, now: isCurrent ? new Date() : null }),
        );
        panel.setStatus(formatFetchedAt(result.fetchedAt));
        break;
      }
      case "login":
        panel.showMessage("時間割を読み込めませんでした", "ログインの期限が切れています。manabaに再ログインしてください。", { href: "/ct/home", label: "manabaのホームを開き直す" });
        panel.setStatus("");
        break;
      case "unknown":
        panel.showMessage("時間割を読み込めませんでした", "コース一覧の形式を読み取れませんでした。");
        panel.setStatus("");
        break;
      case "error":
        panel.showMessage("時間割を読み込めませんでした", "通信に失敗しました。時間をおいて、もう一度お試しください。");
        panel.setStatus("");
        break;
    }
  };

  const panel = new TimetablePanel(years, selection, open, {
    onToggle(isOpen) {
      setLocal(KEYS.panelOpen, isOpen).catch((e) => warn("開閉の状態を保存できませんでした", e));
      if (isOpen && !loadedOnce) void render(false);
    },
    onChange(next) {
      selection = next;
      setLocal(KEYS.selection, { date: todayKey(new Date()), selection } satisfies SavedSelection).catch((e) =>
        warn("選んだモジュールを保存できませんでした", e),
      );
      void render(false);
    },
    onReload() {
      void render(true);
    },
  });

  // 左右の列（コース一覧と課題）の上に、全幅で出す
  left.before(panel.root);
  if (open) await render(false);
}
