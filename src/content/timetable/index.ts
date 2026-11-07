// F1：ホームの時間割。コース一覧と課題の列の上に、全幅のパネルを出す。
import { warn } from "../../lib/log";
import { periodsForYear, type Settings } from "../../lib/settings";
import { getLocal, getSettings, KEYS, setLocal } from "../../lib/storage";
import { academicYear, detectSelection, type Selection } from "./module";
import { parseYearOptions } from "./parser";
import { buildTimetable, TimetablePanel } from "./render";
import { loadCourses, type LoadResult } from "./source";

type SavedSelection = { date: string; selection: Selection };

function todayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function formatFetchedAt(t: number): string {
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}時点`;
}

/** 読み込めなかったときの説明。 */
const FAILURE_MESSAGES: Record<Exclude<LoadResult["kind"], "ok">, { body: string; link?: { href: string; label: string } }> = {
  login: { body: "ログインの期限が切れています。manabaに再ログインしてください。", link: { href: "/ct/home", label: "manabaのホームを開き直す" } },
  unknown: { body: "コース一覧の形式を読み取れませんでした。" },
  error: { body: "通信に失敗しました。時間をおいて、もう一度お試しください。" },
};

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
    if (result.kind !== "ok") {
      const { body, link } = FAILURE_MESSAGES[result.kind];
      panel.showMessage("時間割を読み込めませんでした", body, link);
      panel.setStatus("");
      return;
    }
    const isCurrent = sel.year === current.year && sel.term === current.term && sel.module === current.module;
    panel.showTable(
      buildTimetable({ courses: result.courses, selection: sel, alwaysShowSaturday: settings.alwaysShowSaturday, now: isCurrent ? new Date() : null }),
    );
    panel.setStatus(formatFetchedAt(result.fetchedAt));
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
