// F2・F3：未提出課題一覧の締切の色分けと、課題ごとの非表示。
// 状態と保存をここで持ち、描画は render.ts に任せる。
import { warn } from "../../lib/log";
import { getHiddenAll, getLocal, getSettings, KEYS, removeHidden, setHidden, setLocal, type HiddenEntry } from "../../lib/storage";
import { isExpiredHidden } from "./deadline";
import { findAssignmentTable, type Assignment } from "./parser";
import { AssignmentsView, type ViewState } from "./render";

/** 締切から30日以上過ぎた非表示の記録を消す（storage.sync の容量を空けるため）。 */
function dropExpired(hidden: Map<string, HiddenEntry>, now: Date): void {
  const expired = [...hidden].filter(([, e]) => isExpiredHidden(e, now)).map(([k]) => k);
  if (expired.length === 0) return;
  removeHidden(expired).catch((e) => warn("古い非表示の記録を消せませんでした", e));
  for (const k of expired) hidden.delete(k);
}

export async function initAssignments(doc: Document): Promise<void> {
  const table = findAssignmentTable(doc);
  if (!table) {
    warn("未提出課題の表（table.stdlist）が見つからないため、色分けをしません");
    return;
  }
  if (doc.querySelector(".mp-as-toolbar")) return;

  const [settings, hidden, sortOn, showHidden] = await Promise.all([
    getSettings(),
    getHiddenAll(),
    getLocal<boolean>(KEYS.sortByDeadline),
    getLocal<boolean>(KEYS.showHidden),
  ]);
  dropExpired(hidden, new Date());

  let state: Omit<ViewState, "now" | "hidden"> = {
    thresholds: settings.thresholds,
    sortByDeadline: sortOn ?? false,
    showHidden: showHidden ?? false,
  };
  const render = (focusFrom?: Assignment) => view.render({ ...state, hidden: new Set(hidden.keys()), now: new Date() }, focusFrom);

  async function unhide(items: Assignment[]): Promise<boolean> {
    try {
      await removeHidden(items.map((i) => i.key));
    } catch (e) {
      warn("再表示を保存できませんでした", e);
      view.setStatus("再表示できませんでした。時間をおいて、もう一度お試しください。");
      return false;
    }
    for (const i of items) hidden.delete(i.key);
    render();
    return true;
  }

  async function hide(item: Assignment): Promise<void> {
    const entry: HiddenEntry = { hiddenAt: Date.now(), title: item.title, course: item.course, deadline: item.deadline?.toISOString() ?? null };
    try {
      await setHidden(item.key, entry);
    } catch (e) {
      warn("非表示を保存できませんでした", e);
      view.setStatus("非表示にできませんでした。時間をおいて、もう一度お試しください。");
      return;
    }
    hidden.set(item.key, entry);
    render(item);
    view.setStatus(`「${item.title}」を非表示にしました`, () => {
      void unhide([item]).then((ok) => {
        if (!ok) return;
        view.setStatus(`「${item.title}」を元に戻しました`);
        view.focusButton(item);
      });
    });
  }

  const view = new AssignmentsView(table, state, {
    onToggleHidden(item) {
      if (!hidden.has(item.key)) {
        void hide(item);
        return;
      }
      void unhide([item]).then((ok) => ok && view.setStatus(`「${item.title}」を再表示しました`));
    },
    onRestoreAll(items) {
      void unhide(items).then((ok) => ok && view.setStatus(`${items.length}件の課題を再表示しました`));
    },
    onSortChange(on) {
      state = { ...state, sortByDeadline: on };
      setLocal(KEYS.sortByDeadline, on).catch((e) => warn("並べ替えの設定を保存できませんでした", e));
      render();
    },
    onShowHiddenChange(on) {
      state = { ...state, showHidden: on };
      setLocal(KEYS.showHidden, on).catch((e) => warn("表示の設定を保存できませんでした", e));
      render();
    },
  });
  render();

  // 残り時間を1分ごとに更新する。タブに戻ったときもすぐ更新する
  setInterval(() => render(), 60 * 1000);
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "visible") render();
  });

  // 他のタブや端末で非表示にした課題、オプション画面での閾値の変更を反映する
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (Object.keys(changes).some((k) => k.startsWith(KEYS.hiddenPrefix))) {
      getHiddenAll()
        .then((m) => {
          hidden.clear();
          for (const [k, v] of m) hidden.set(k, v);
          render();
        })
        .catch((e) => warn("非表示の記録を読み込めませんでした", e));
    }
    if (changes[KEYS.settings]) {
      getSettings()
        .then((s) => {
          state = { ...state, thresholds: s.thresholds };
          render();
        })
        .catch((e) => warn("設定を読み込めませんでした", e));
    }
  });
}
