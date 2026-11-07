// 時間割パネルの描画。データの取得と保存は index.ts が受け持つ。
import { MODS, TERMS, type Mod, type Term } from "../../lib/settings";
import { chevronIcon, h, uniqueId } from "../dom";
import { matchesSelection, type Selection } from "./module";
import { DAYS, type Course, type Day } from "./parser";

/** 筑波大学の時限の時刻（75分授業）。 */
export const PERIOD_TIMES: Record<number, [string, string]> = {
  1: ["8:40", "9:55"],
  2: ["10:10", "11:25"],
  3: ["12:15", "13:30"],
  4: ["13:45", "15:00"],
  5: ["15:15", "16:30"],
  6: ["16:45", "18:00"],
  7: ["18:20", "19:35"],
  8: ["19:45", "21:00"],
};

const JS_DAY_TO_DAY: Record<number, Day> = { 0: "日", 1: "月", 2: "火", 3: "水", 4: "木", 5: "金", 6: "土" };

function minutes(hm: string): number {
  const [hh, mm] = hm.split(":").map(Number) as [number, number];
  return hh * 60 + mm;
}

/** 今の時限。授業の時間外なら null。 */
export function currentPeriod(now: Date): number | null {
  const m = now.getHours() * 60 + now.getMinutes();
  for (const [p, [s, e]] of Object.entries(PERIOD_TIMES)) {
    if (m >= minutes(s) && m <= minutes(e)) return Number(p);
  }
  return null;
}

export type TableOptions = {
  courses: Course[];
  selection: Selection;
  alwaysShowSaturday: boolean;
  /** 今日の列と今の時限を強調するときの「今」。強調しないなら null */
  now: Date | null;
};

function courseTooltip(c: Course): string {
  return [c.code && `科目番号：${c.code}`, c.teachers && `担当：${c.teachers}`, c.schedule.raw && `時限：${c.schedule.raw}`]
    .filter(Boolean)
    .join("\n");
}

function courseLink(c: Course, className: string): HTMLAnchorElement {
  return h("a", { class: className, href: c.href, title: courseTooltip(c) || null }, c.name || c.href);
}

/** 曜日×時限の表と「その他」を組み立てる。 */
export function buildTimetable({ courses, selection, alwaysShowSaturday, now }: TableOptions): HTMLElement {
  const { term, module } = selection;
  const inTable: Course[] = [];
  const others: Course[] = [];
  for (const c of courses) {
    if (c.schedule.term === null) others.push(c); // 学期の情報がないコースは、どのモジュールでも「その他」
    else if (!matchesSelection(c.schedule, term, module)) continue;
    else if (c.schedule.slots.length === 0) others.push(c);
    else inTable.push(c);
  }

  const usedDays = new Set(inTable.flatMap((c) => c.schedule.slots.map((s) => s.day)));
  const days: Day[] = DAYS.filter(
    (d) => ["月", "火", "水", "木", "金"].includes(d) || (d === "土" && (alwaysShowSaturday || usedDays.has("土"))) || (d === "日" && usedDays.has("日")),
  );
  const maxPeriod = Math.max(6, ...inTable.flatMap((c) => c.schedule.slots.map((s) => s.period)));

  const today = now ? JS_DAY_TO_DAY[now.getDay()] : null;
  const nowPeriod = now ? currentPeriod(now) : null;

  const caption = h("caption", { class: "mp-visually-hidden" }, `${selection.year}年度 ${term}${module}の時間割`);
  const headRow = h(
    "tr",
    {},
    h("th", { scope: "col", class: "mp-tt__corner" }, h("span", { class: "mp-visually-hidden" }, "時限")),
    ...days.map((d) =>
      h("th", { scope: "col", class: d === today ? "mp-tt__day mp-is-today" : "mp-tt__day" }, d, d === today ? h("span", { class: "mp-visually-hidden" }, "（今日）") : null),
    ),
  );

  const body = h("tbody");
  for (let p = 1; p <= maxPeriod; p++) {
    const times = PERIOD_TIMES[p];
    const row = h(
      "tr",
      {},
      h(
        "th",
        { scope: "row", class: "mp-tt__period" },
        h("span", { class: "mp-tt__period-num" }, `${p}`),
        times ? h("span", { class: "mp-tt__period-time" }, `${times[0]}〜${times[1]}`) : null,
      ),
    );
    for (const d of days) {
      const here = inTable.filter((c) => c.schedule.slots.some((s) => s.day === d && s.period === p));
      const classes = ["mp-tt__cell"];
      if (d === today) classes.push("mp-is-today");
      if (d === today && p === nowPeriod) classes.push("mp-is-now");
      if (here.length === 0) classes.push("mp-is-empty");
      row.append(
        h(
          "td",
          { class: classes.join(" ") },
          here.length > 0 ? h("ul", { class: "mp-tt__courses" }, ...here.map((c) => h("li", {}, courseLink(c, "mp-tt__course")))) : null,
        ),
      );
    }
    body.append(row);
  }

  const wrap = h("div", { class: "mp-tt__result" });
  if (inTable.length === 0) {
    wrap.append(h("p", { class: "mp-tt__empty" }, `${term}${module}の時間割に入る授業はありません`));
  }
  wrap.append(
    h("div", { class: "mp-tt__scroll" }, h("table", { class: "mp-tt__table" }, caption, h("thead", {}, headRow), body)),
  );

  if (others.length > 0) {
    const headingId = uniqueId("tt-others");
    wrap.append(
      h(
        "section",
        { class: "mp-tt__others", "aria-labelledby": headingId },
        h("h3", { id: headingId, class: "mp-tt__others-title" }, "時間外・集中・その他"),
        h(
          "ul",
          { class: "mp-tt__chips" },
          ...others.map((c) =>
            h(
              "li",
              {},
              h("a", { class: "mp-tt__chip", href: c.href, title: courseTooltip(c) || null }, h("span", {}, c.name || c.href), c.schedule.raw ? h("span", { class: "mp-tt__chip-note" }, c.schedule.raw) : null),
            ),
          ),
        ),
      ),
    );
  }
  return wrap;
}

export type PanelHandlers = {
  onToggle(open: boolean): void;
  onChange(selection: Selection): void;
  onReload(): void;
};

/** パネルの外枠（見出し、開閉、切り替えの操作）。中身は setContent で入れ替える。 */
export class TimetablePanel {
  readonly root: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly summary: HTMLSpanElement;
  private readonly bodyEl: HTMLDivElement;
  private readonly yearSelect: HTMLSelectElement;
  private readonly termInputs: HTMLInputElement[];
  private readonly modInputs: HTMLInputElement[];
  private readonly reloadButton: HTMLButtonElement;
  private readonly status: HTMLParagraphElement;
  private readonly content: HTMLDivElement;
  private selection: Selection;

  constructor(years: number[], selection: Selection, open: boolean, private readonly handlers: PanelHandlers) {
    this.selection = selection;
    const bodyId = uniqueId("tt-body");
    const titleId = uniqueId("tt-title");
    const yearId = uniqueId("tt-year");

    this.summary = h("span", { class: "mp-tt__summary" });
    this.toggle = h(
      "button",
      { type: "button", class: "mp-tt__toggle", "aria-expanded": String(open), "aria-controls": bodyId },
      chevronIcon(),
      // 大きさの違う見出しと年度・モジュールは、ベースラインでそろえる
      h("span", { class: "mp-tt__toggle-text" }, h("span", { id: titleId, class: "mp-tt__title" }, "時間割"), this.summary),
    );
    this.toggle.addEventListener("click", () => this.setOpen(this.toggle.getAttribute("aria-expanded") !== "true", true));

    this.yearSelect = h("select", { id: yearId, class: "mp-select" }, ...years.map((y) => h("option", { value: String(y) }, `${y}年度`)));
    this.yearSelect.addEventListener("change", () => this.emit({ year: Number(this.yearSelect.value) }));

    const radioGroup = <T extends string>(legend: string, values: readonly T[], label: (v: T) => string, key: "term" | "module") => {
      const name = uniqueId(`tt-${key}`);
      const inputs: HTMLInputElement[] = [];
      const fieldset = h(
        "fieldset",
        { class: "mp-segmented" },
        h("legend", { class: "mp-field-label" }, legend),
        h(
          "div",
          { class: "mp-segmented__items" },
          ...values.map((v) => {
            const input = h("input", { type: "radio", name, value: v, class: "mp-segmented__input" });
            input.addEventListener("change", () => input.checked && this.emit({ [key]: v } as Partial<Selection>));
            inputs.push(input);
            return h("label", { class: "mp-segmented__item" }, input, h("span", {}, label(v)));
          }),
        ),
      );
      return { fieldset, inputs };
    };
    const terms = radioGroup<Term>("学期", TERMS, (t) => t, "term");
    const mods = radioGroup<Mod>("モジュール", MODS, (m) => m, "module");
    this.termInputs = terms.inputs;
    this.modInputs = mods.inputs;

    this.reloadButton = h("button", { type: "button", class: "mp-button mp-button--outline" }, "再読み込み");
    this.reloadButton.addEventListener("click", () => this.handlers.onReload());

    this.status = h("p", { class: "mp-tt__status", role: "status" });
    this.content = h("div", { class: "mp-tt__content", "aria-live": "polite", "aria-busy": "false" });

    this.bodyEl = h(
      "div",
      { id: bodyId, class: "mp-tt__body", hidden: !open },
      h(
        "div",
        { class: "mp-tt__controls" },
        h("div", { class: "mp-field" }, h("label", { for: yearId, class: "mp-field-label" }, "年度"), h("div", { class: "mp-select-wrap" }, this.yearSelect, chevronIcon())),
        terms.fieldset,
        mods.fieldset,
        h("div", { class: "mp-tt__reload" }, this.reloadButton, this.status),
      ),
      this.content,
    );

    this.root = h("section", { class: "mp-root mp-tt", "aria-labelledby": titleId }, h("h2", { class: "mp-tt__heading" }, this.toggle), this.bodyEl);
    this.syncControls();
  }

  isOpen(): boolean {
    return this.toggle.getAttribute("aria-expanded") === "true";
  }

  setOpen(open: boolean, fromUser = false): void {
    this.toggle.setAttribute("aria-expanded", String(open));
    this.bodyEl.hidden = !open;
    if (fromUser) this.handlers.onToggle(open);
  }

  private emit(patch: Partial<Selection>): void {
    this.selection = { ...this.selection, ...patch };
    this.syncControls();
    this.handlers.onChange(this.selection);
  }

  private syncControls(): void {
    const { year, term, module } = this.selection;
    if (![...this.yearSelect.options].some((o) => o.value === String(year))) {
      this.yearSelect.append(h("option", { value: String(year) }, `${year}年度`));
    }
    this.yearSelect.value = String(year);
    for (const i of this.termInputs) i.checked = i.value === term;
    for (const i of this.modInputs) i.checked = i.value === module;
    this.summary.textContent = `${year}年度 ${term}${module}`;
  }

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  setBusy(busy: boolean): void {
    this.content.setAttribute("aria-busy", String(busy));
    this.reloadButton.disabled = busy;
  }

  showLoading(): void {
    this.setBusy(true);
    const rows = Array.from({ length: 6 }, () => h("div", { class: "mp-skeleton mp-skeleton--row" }));
    this.content.replaceChildren(
      h("div", { class: "mp-tt__skeleton", "aria-hidden": "true" }, h("div", { class: "mp-skeleton mp-skeleton--head" }), ...rows),
      h("p", { class: "mp-visually-hidden" }, "時間割を読み込んでいます"),
    );
  }

  showMessage(title: string, body: string, link?: { href: string; label: string }): void {
    this.setBusy(false);
    this.content.replaceChildren(
      h(
        "div",
        { class: "mp-banner mp-banner--error", role: "alert" },
        h("p", { class: "mp-banner__title" }, title),
        h("p", { class: "mp-banner__body" }, body),
        link ? h("p", { class: "mp-banner__body" }, h("a", { href: link.href, class: "mp-link" }, link.label)) : null,
      ),
    );
  }

  showTable(el: HTMLElement): void {
    this.setBusy(false);
    this.content.replaceChildren(el);
  }
}
