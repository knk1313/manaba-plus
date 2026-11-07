import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAssignmentTable, parseJstDateTime, type AssignmentTable } from "../src/content/assignments/parser";
import { AssignmentsView, type ViewHandlers, type ViewState } from "../src/content/assignments/render";
import { DEFAULT_SETTINGS } from "../src/lib/settings";
import { loadFixture } from "./helpers";

let doc: Document;
let table: AssignmentTable;
let handlers: ViewHandlers;
const now = parseJstDateTime("2026-11-07 12:00")!;

const state = (patch: Partial<ViewState> = {}): ViewState => ({
  thresholds: DEFAULT_SETTINGS.thresholds,
  hidden: new Set(),
  sortByDeadline: false,
  showHidden: false,
  now,
  ...patch,
});

const titles = () => [...table.table.querySelectorAll("tr:not([hidden]) .myassignments-title a")].map((a) => a.textContent);

beforeEach(() => {
  doc = loadFixture("home_library_query.html");
  // フォーカスを確かめるため、jsdom の document に移す
  document.body.replaceChildren(document.adoptNode(doc.body.firstElementChild!));
  table = findAssignmentTable(document)!;
  handlers = { onToggleHidden: vi.fn(), onRestoreAll: vi.fn(), onSortChange: vi.fn(), onShowHiddenChange: vi.fn() };
});

describe("AssignmentsView", () => {
  it("区分の色とバッジを付ける", () => {
    const view = new AssignmentsView(table, state(), handlers);
    view.render(state());
    const rows = table.items.map((i) => i.row);
    expect(rows.map((r) => [...r.classList].find((c) => c.startsWith("mp-lv-")))).toEqual(["mp-lv-soon", "mp-lv-overdue", "mp-lv-none", "mp-lv-later"]);
    expect(rows.map((r) => r.querySelector(".mp-badge")!.textContent)).toEqual(["残り1日11時間", "超過", "締切なし", "残り23日5時間"]);
  });

  it("見出しと各行に「操作」の列を足し、タイプをアイコンにする", () => {
    new AssignmentsView(table, state(), handlers).render(state());
    expect(table.headerRow!.lastElementChild!.textContent).toBe("操作");
    const typeLink = table.items[0]!.row.cells[0]!.querySelector("a")!;
    expect(typeLink.querySelector("svg")).not.toBeNull();
    expect(typeLink.title).toBe("レポート");
    expect(typeLink.textContent).toBe("レポート"); // 読み上げ用の文字
  });

  it("件数をツールバーに出す", () => {
    const view = new AssignmentsView(table, state(), handlers);
    view.render(state());
    const count = (lv: string) => view.toolbar.querySelector(`.mp-as-count.mp-lv-${lv} .mp-as-count__num`)!.textContent;
    expect([count("overdue"), count("soon"), count("none"), count("urgent")]).toEqual(["1件", "1件", "1件", "0件"]);
  });

  it("締切順に並べ、締切なしは末尾。オフで元の順", () => {
    const view = new AssignmentsView(table, state(), handlers);
    view.render(state({ sortByDeadline: true }));
    expect(titles()).toEqual(["第5回小テスト", "課題3", "期末レポート", "授業アンケート"]);
    view.render(state());
    expect(titles()).toEqual(["課題3", "第5回小テスト", "授業アンケート", "期末レポート"]);
  });

  it("非表示の課題は隠し、件数から除く。表示に切り替えると「再表示」になる", () => {
    const key = table.items[0]!.key;
    const view = new AssignmentsView(table, state(), handlers);
    view.render(state({ hidden: new Set([key]) }));
    expect(titles()).not.toContain("課題3");
    expect(view.toolbar.textContent).toContain("非表示の課題を表示（1件）");
    view.render(state({ hidden: new Set([key]), showHidden: true }));
    expect(titles()).toContain("課題3");
    expect(table.items[0]!.row.querySelector(".mp-as-action button")!.textContent).toContain("再表示");
  });

  it("隠した行のボタンにあったフォーカスを、次の行へ移す", () => {
    const view = new AssignmentsView(table, state(), handlers);
    view.render(state());
    const [first, second] = table.items;
    first!.row.querySelector<HTMLButtonElement>(".mp-as-action button")!.focus();
    view.render(state({ hidden: new Set([first!.key]) }), first);
    expect(document.activeElement).toBe(second!.row.querySelector(".mp-as-action button"));
  });

  it("ボタンとスイッチの操作を handlers に知らせる", () => {
    const view = new AssignmentsView(table, state(), handlers);
    view.render(state());
    table.items[1]!.row.querySelector<HTMLButtonElement>(".mp-as-action button")!.click();
    expect(handlers.onToggleHidden).toHaveBeenCalledWith(table.items[1]);
    view.toolbar.querySelector<HTMLInputElement>('input[role="switch"]')!.click();
    expect(handlers.onSortChange).toHaveBeenCalledWith(true);
  });
});
