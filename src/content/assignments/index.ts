// F2・F3：未提出課題一覧の締切の色分けと、課題ごとの非表示。
import { warn } from "../../lib/log";
import type { Thresholds } from "../../lib/settings";
import { getHiddenAll, getLocal, getSettings, KEYS, removeHidden, setHidden, setLocal, type HiddenEntry } from "../../lib/storage";
import { h, icon, uniqueId, type IconName } from "../dom";
import { classify, compareByDeadline, formatRemaining, isExpiredHidden, LEVEL_LABEL, LEVELS, type Level } from "./deadline";
import { findAssignmentTable, type Assignment, type AssignmentTable } from "./parser";

const LEVEL_CLASSES = LEVELS.map((l) => `mp-lv-${l}`);

type RowUi = {
  item: Assignment;
  badge: HTMLSpanElement;
  button: HTMLButtonElement;
  buttonLabel: HTMLSpanElement;
};

/** スイッチ（DADS にはないため、チェックボックスを role="switch" にして作る）。 */
function switchControl(label: string, checked: boolean, onChange: (v: boolean) => void): { root: HTMLLabelElement; input: HTMLInputElement; text: HTMLSpanElement } {
  const input = h("input", { type: "checkbox", role: "switch", class: "mp-switch__input" });
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  const text = h("span", { class: "mp-switch__label" }, label);
  return { root: h("label", { class: "mp-switch" }, input, h("span", { class: "mp-switch__track", "aria-hidden": "true" }), text), input, text };
}

/** タイプの列の文字（レポート、アンケートなど）をアイコンにする。文字は読み上げ用に隠して残す。 */
function iconizeType(cell: HTMLTableCellElement): void {
  const link = cell.querySelector<HTMLAnchorElement>("a[href]");
  const kind = /_(report|survey|query)(?:[?#]|$)/.exec(link?.getAttribute("href") ?? "")?.[1] as IconName | undefined;
  if (!link || !kind) return; // 知らない種類は文字のまま
  const label = (link.textContent ?? "").trim();
  cell.classList.add("mp-as-type");
  link.title = label;
  link.replaceChildren(icon(kind), h("span", { class: "mp-visually-hidden" }, label));
}

class AssignmentsController {
  private readonly rows: RowUi[] = [];
  private readonly counts = new Map<Level, HTMLElement>();
  private readonly showHiddenText: HTMLSpanElement;
  private readonly showHiddenRoot: HTMLLabelElement;
  private readonly restoreAllButton: HTMLButtonElement;
  private readonly status: HTMLDivElement;
  readonly toolbar: HTMLElement;

  constructor(
    t: AssignmentTable,
    private thresholds: Thresholds,
    private hidden: Map<string, HiddenEntry>,
    private sortOn: boolean,
    private showHidden: boolean,
  ) {
    // manaba の表の見た目は使わず、DADS の表の見た目に置き換える
    t.table.classList.add("mp-as-table");
    // 見出し行に列を足す（受付期間の列の後ろ。狭い画面用の列の表示の切り替えはそのまま）
    if (t.headerRow) {
      const cellTag = t.headerRow.cells[t.headerRow.cells.length - 1]?.tagName === "TD" ? "td" : "th";
      t.headerRow.append(h(cellTag, { class: "mp-as-col-head", scope: cellTag === "th" ? "col" : null }, "操作"));
    }
    for (const item of t.items) {
      iconizeType(item.row.cells[0]!);
      const badge = h("span", { class: "mp-badge" });
      const titleCell = item.row.cells[1]!;
      titleCell.classList.add("mp-as-title-cell");
      titleCell.append(badge);
      const buttonLabel = h("span", {}, "非表示");
      const button = h("button", { type: "button", class: "mp-button mp-button--text mp-button--xs" }, buttonLabel, h("span", { class: "mp-visually-hidden" }, `（${item.title}）`));
      button.addEventListener("click", () => void this.toggleHidden(item));
      item.row.append(h("td", { class: "mp-as-action" }, button));
      this.rows.push({ item, badge, button, buttonLabel });
    }

    const headingId = uniqueId("as-toolbar");
    const countList = h(
      "ul",
      { class: "mp-as-counts", "aria-labelledby": headingId },
      ...LEVELS.map((l) => {
        const n = h("span", { class: "mp-as-count__num" }, "0");
        this.counts.set(l, n);
        return h("li", { class: `mp-as-count mp-lv-${l}` }, h("span", { class: "mp-as-count__swatch", "aria-hidden": "true" }), h("span", {}, LEVEL_LABEL[l]), n);
      }),
    );
    const sortSwitch = switchControl("締切順に並べる", sortOn, (v) => {
      this.sortOn = v;
      setLocal(KEYS.sortByDeadline, v).catch((e) => warn("並べ替えの設定を保存できませんでした", e));
      this.update();
    });
    const hiddenSwitch = switchControl("非表示の課題を表示", showHidden, (v) => {
      this.showHidden = v;
      setLocal(KEYS.showHidden, v).catch((e) => warn("表示の設定を保存できませんでした", e));
      this.update();
    });
    this.showHiddenRoot = hiddenSwitch.root;
    this.showHiddenText = hiddenSwitch.text;
    this.restoreAllButton = h("button", { type: "button", class: "mp-button mp-button--text mp-button--sm" }, "すべて再表示");
    this.restoreAllButton.addEventListener("click", () => void this.restoreAll());
    this.status = h("div", { class: "mp-as-status", role: "status" });

    this.toolbar = h(
      "section",
      { class: "mp-root mp-as-toolbar", "aria-labelledby": headingId },
      h("h2", { id: headingId, class: "mp-visually-hidden" }, "締切までの残り時間ごとの件数"),
      countList,
      h("div", { class: "mp-as-controls" }, sortSwitch.root, this.showHiddenRoot, this.restoreAllButton),
      this.status,
    );
    t.table.before(this.toolbar);
  }

  setThresholds(th: Thresholds): void {
    this.thresholds = th;
    this.update();
  }

  setHiddenMap(map: Map<string, HiddenEntry>): void {
    this.hidden = map;
    this.update();
  }

  /** 残り時間、色、件数、表示と並び順をまとめて更新する。 */
  update(): void {
    const now = new Date();
    const counts = new Map<Level, number>(LEVELS.map((l) => [l, 0]));
    let hiddenCount = 0;

    for (const r of this.rows) {
      const level = classify(r.item.deadline, now, this.thresholds);
      const isHidden = this.hidden.has(r.item.key);
      r.item.row.classList.remove(...LEVEL_CLASSES);
      r.item.row.classList.add(`mp-lv-${level}`);
      r.badge.className = `mp-badge mp-badge--${level}`;
      r.badge.textContent = formatRemaining(r.item.deadline, now);
      r.buttonLabel.textContent = isHidden ? "再表示" : "非表示";
      r.item.row.classList.toggle("mp-is-hidden", isHidden);
      r.item.row.hidden = isHidden && !this.showHidden;
      if (isHidden) hiddenCount++;
      else counts.set(level, counts.get(level)! + 1);
    }
    for (const [l, el] of this.counts) {
      const n = counts.get(l)!;
      el.textContent = `${n}件`;
      el.parentElement!.classList.toggle("mp-is-zero", n === 0);
    }
    this.showHiddenText.textContent = `非表示の課題を表示（${hiddenCount}件）`;
    this.restoreAllButton.hidden = hiddenCount === 0;

    this.reorder();
  }

  private reorder(): void {
    const parent = this.rows[0]?.item.row.parentElement;
    if (!parent) return;
    const ordered = [...this.rows].sort((a, b) => (this.sortOn ? compareByDeadline(a.item, b.item) : a.item.index - b.item.index));
    for (const r of ordered) parent.append(r.item.row);
  }

  private setStatus(message: string, undo?: () => void): void {
    this.status.replaceChildren(h("span", {}, message));
    if (undo) {
      const b = h("button", { type: "button", class: "mp-button mp-button--text mp-button--xs" }, "元に戻す");
      b.addEventListener("click", () => {
        undo();
      });
      this.status.append(b);
    }
  }

  private async toggleHidden(item: Assignment): Promise<void> {
    const ui = this.rows.find((r) => r.item === item)!;
    if (this.hidden.has(item.key)) {
      await this.unhide([item]);
      this.setStatus(`「${item.title}」を再表示しました`);
      return;
    }
    const entry: HiddenEntry = { hiddenAt: Date.now(), title: item.title, course: item.course, deadline: item.deadline?.toISOString() ?? null };
    try {
      await setHidden(item.key, entry);
    } catch (e) {
      warn("非表示を保存できませんでした", e);
      this.setStatus("非表示にできませんでした。時間をおいて、もう一度お試しください。");
      return;
    }
    this.hidden.set(item.key, entry);
    // 行が消える前に、次の行のボタンへフォーカスを移す
    const visible = this.rows.filter((r) => !r.item.row.hidden);
    const pos = visible.indexOf(ui);
    this.update();
    if (ui.item.row.hidden) {
      const next = visible[pos + 1] ?? visible[pos - 1];
      if (next && next !== ui) next.button.focus();
    }
    this.setStatus(`「${item.title}」を非表示にしました`, () => {
      void this.unhide([item]).then(() => {
        this.setStatus(`「${item.title}」を元に戻しました`);
        ui.button.focus();
      });
    });
  }

  private async unhide(items: Assignment[]): Promise<void> {
    try {
      await removeHidden(items.map((i) => i.key));
    } catch (e) {
      warn("再表示を保存できませんでした", e);
      this.setStatus("再表示できませんでした。時間をおいて、もう一度お試しください。");
      return;
    }
    for (const i of items) this.hidden.delete(i.key);
    this.update();
  }

  private async restoreAll(): Promise<void> {
    const items = this.rows.map((r) => r.item).filter((i) => this.hidden.has(i.key));
    await this.unhide(items);
    this.setStatus(`${items.length}件の課題を再表示しました`);
  }
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

  // 締切から30日以上過ぎた非表示の記録を消す（storage.sync の容量を空けるため）
  const now = new Date();
  const expired = [...hidden].filter(([, e]) => isExpiredHidden(e, now)).map(([k]) => k);
  if (expired.length > 0) {
    removeHidden(expired).catch((e) => warn("古い非表示の記録を消せませんでした", e));
    for (const k of expired) hidden.delete(k);
  }

  const controller = new AssignmentsController(table, settings.thresholds, hidden, sortOn ?? false, showHidden ?? false);
  controller.update();

  // 残り時間を1分ごとに更新する。タブに戻ったときもすぐ更新する
  setInterval(() => controller.update(), 60 * 1000);
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "visible") controller.update();
  });

  // 他のタブや端末で非表示にした課題、オプション画面での閾値の変更を反映する
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (Object.keys(changes).some((k) => k.startsWith(KEYS.hiddenPrefix))) {
      getHiddenAll()
        .then((m) => controller.setHiddenMap(m))
        .catch((e) => warn("非表示の記録を読み込めませんでした", e));
    }
    if (changes[KEYS.settings]) {
      getSettings()
        .then((s) => controller.setThresholds(s.thresholds))
        .catch((e) => warn("設定を読み込めませんでした", e));
    }
  });
}
