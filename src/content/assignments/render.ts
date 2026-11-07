// 未提出課題一覧の描画。表に列とバッジを足し、表の上にツールバーを置く。
// 保存（chrome.storage）は持たず、操作は handlers で index.ts に知らせる。
import type { Thresholds } from "../../lib/settings";
import { h, uniqueId } from "../dom";
import { icon, type IconName } from "../icons";
import { classify, compareByDeadline, formatRemaining, LEVEL_LABEL, LEVELS, type Level } from "./deadline";
import type { Assignment, AssignmentTable } from "./parser";

const LEVEL_CLASSES = LEVELS.map((l) => `mp-lv-${l}`);

export type ViewState = {
  thresholds: Thresholds;
  /** 非表示にした課題のキー（href） */
  hidden: ReadonlySet<string>;
  sortByDeadline: boolean;
  showHidden: boolean;
  now: Date;
};

export type ViewHandlers = {
  onToggleHidden(item: Assignment): void;
  onRestoreAll(items: Assignment[]): void;
  onSortChange(on: boolean): void;
  onShowHiddenChange(on: boolean): void;
};

type RowUi = {
  item: Assignment;
  badge: HTMLSpanElement;
  button: HTMLButtonElement;
  buttonLabel: HTMLSpanElement;
};

/** スイッチ（DADS にはないため、チェックボックスを role="switch" にして作る）。 */
function switchControl(label: string, checked: boolean, onChange: (v: boolean) => void): { root: HTMLLabelElement; text: HTMLSpanElement } {
  const input = h("input", { type: "checkbox", role: "switch", class: "mp-switch__input" });
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  const text = h("span", { class: "mp-switch__label" }, label);
  return { root: h("label", { class: "mp-switch" }, input, h("span", { class: "mp-switch__track", "aria-hidden": "true" }), text), text };
}

/** タイプの列の文字（レポート、アンケートなど）をアイコンにする。文字は読み上げ用に隠して残す。 */
export function iconizeType(cell: HTMLTableCellElement): void {
  const link = cell.querySelector<HTMLAnchorElement>("a[href]");
  const kind = /_(report|survey|query)(?:[?#]|$)/.exec(link?.getAttribute("href") ?? "")?.[1] as IconName | undefined;
  if (!link || !kind) return; // 知らない種類は文字のまま
  const label = (link.textContent ?? "").trim();
  cell.classList.add("mp-as-type");
  link.title = label;
  link.replaceChildren(icon(kind), h("span", { class: "mp-visually-hidden" }, label));
}

export class AssignmentsView {
  private readonly rows: RowUi[] = [];
  private readonly counts = new Map<Level, HTMLElement>();
  private readonly showHiddenText: HTMLSpanElement;
  private readonly restoreAllButton: HTMLButtonElement;
  private readonly status: HTMLDivElement;
  private state: ViewState | null = null;
  readonly toolbar: HTMLElement;

  constructor(t: AssignmentTable, initial: Pick<ViewState, "sortByDeadline" | "showHidden">, private readonly handlers: ViewHandlers) {
    // manaba の表の見た目は使わず、DADS の表の見た目に置き換える
    t.table.classList.add("mp-as-table");
    // 見出し行に列を足す（受付期間の列の後ろ。狭い画面用の列の表示の切り替えはそのまま）
    if (t.headerRow) {
      const cellTag = t.headerRow.cells[t.headerRow.cells.length - 1]?.tagName === "TD" ? "td" : "th";
      t.headerRow.append(h(cellTag, { class: "mp-as-col-head", scope: cellTag === "th" ? "col" : null }, "操作"));
    }
    for (const item of t.items) this.rows.push(this.decorateRow(item));

    const headingId = uniqueId("as-toolbar");
    const countList = h(
      "ul",
      { class: "mp-as-counts", "aria-labelledby": headingId },
      ...LEVELS.map((l) => {
        const n = h("span", { class: "mp-as-count__num" }, "0件");
        this.counts.set(l, n);
        return h("li", { class: `mp-as-count mp-lv-${l}` }, h("span", { class: "mp-as-count__swatch", "aria-hidden": "true" }), h("span", {}, LEVEL_LABEL[l]), n);
      }),
    );
    const sortSwitch = switchControl("締切順に並べる", initial.sortByDeadline, (v) => handlers.onSortChange(v));
    const hiddenSwitch = switchControl("非表示の課題を表示", initial.showHidden, (v) => handlers.onShowHiddenChange(v));
    this.showHiddenText = hiddenSwitch.text;
    this.restoreAllButton = h("button", { type: "button", class: "mp-button mp-button--text mp-button--sm" }, "すべて再表示");
    this.restoreAllButton.addEventListener("click", () => handlers.onRestoreAll(this.hiddenItems()));
    this.status = h("div", { class: "mp-as-status", role: "status" });

    this.toolbar = h(
      "section",
      { class: "mp-root mp-as-toolbar", "aria-labelledby": headingId },
      h("h2", { id: headingId, class: "mp-visually-hidden" }, "締切までの残り時間ごとの件数"),
      countList,
      h("div", { class: "mp-as-controls" }, sortSwitch.root, hiddenSwitch.root, this.restoreAllButton),
      this.status,
    );
    t.table.before(this.toolbar);
  }

  /** 行にタイプのアイコン、残り時間のバッジ、非表示のボタンを足す。 */
  private decorateRow(item: Assignment): RowUi {
    iconizeType(item.row.cells[0]!);
    const badge = h("span", { class: "mp-badge" });
    const titleCell = item.row.cells[1]!;
    titleCell.classList.add("mp-as-title-cell");
    titleCell.append(badge);
    const buttonLabel = h("span", {}, "非表示");
    const button = h(
      "button",
      { type: "button", class: "mp-button mp-button--text mp-button--xs" },
      buttonLabel,
      h("span", { class: "mp-visually-hidden" }, `（${item.title}）`),
    );
    button.addEventListener("click", () => this.handlers.onToggleHidden(item));
    item.row.append(h("td", { class: "mp-as-action" }, button));
    return { item, badge, button, buttonLabel };
  }

  private hiddenItems(): Assignment[] {
    return this.rows.map((r) => r.item).filter((i) => this.state?.hidden.has(i.key));
  }

  /**
   * 残り時間、色、件数、表示と並び順をまとめて描き直す。
   * focusFrom を渡すと、その行が隠れたときに隣の行のボタンへフォーカスを移す。
   */
  render(state: ViewState, focusFrom?: Assignment): void {
    const visibleBefore = this.rows.filter((r) => !r.item.row.hidden);
    this.state = state;
    const counts = new Map<Level, number>(LEVELS.map((l) => [l, 0]));
    let hiddenCount = 0;

    for (const r of this.rows) {
      const level = classify(r.item.deadline, state.now, state.thresholds);
      const isHidden = state.hidden.has(r.item.key);
      r.item.row.classList.remove(...LEVEL_CLASSES);
      r.item.row.classList.add(`mp-lv-${level}`);
      r.item.row.classList.toggle("mp-is-hidden", isHidden);
      r.item.row.hidden = isHidden && !state.showHidden;
      r.badge.className = `mp-badge mp-badge--${level}`;
      r.badge.textContent = formatRemaining(r.item.deadline, state.now);
      r.buttonLabel.textContent = isHidden ? "再表示" : "非表示";
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
    this.reorder(state.sortByDeadline);

    const from = focusFrom && this.rows.find((r) => r.item === focusFrom);
    if (from?.item.row.hidden) {
      const pos = visibleBefore.indexOf(from);
      const next = visibleBefore[pos + 1] ?? visibleBefore[pos - 1];
      if (next && next !== from) next.button.focus();
    }
  }

  private reorder(sortByDeadline: boolean): void {
    const parent = this.rows[0]?.item.row.parentElement;
    if (!parent) return;
    const ordered = [...this.rows].sort((a, b) => (sortByDeadline ? compareByDeadline(a.item, b.item) : a.item.index - b.item.index));
    for (const r of ordered) parent.append(r.item.row);
  }

  focusButton(item: Assignment): void {
    this.rows.find((r) => r.item === item)?.button.focus();
  }

  /** ツールバーに結果を出す。undo を渡すと「元に戻す」ボタンを付ける。 */
  setStatus(message: string, undo?: () => void): void {
    this.status.replaceChildren(h("span", {}, message));
    if (undo) {
      const b = h("button", { type: "button", class: "mp-button mp-button--text mp-button--xs" }, "元に戻す");
      b.addEventListener("click", undo);
      this.status.append(b);
    }
  }
}
