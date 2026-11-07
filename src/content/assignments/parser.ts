// 未提出課題一覧（home_library_query）の table.stdlist を読む。
// 英語表示でも動くよう、見出しの文字ではなく、列の位置と href の形で判定する。
import { textOf } from "../../lib/text";

export type Assignment = {
  row: HTMLTableRowElement;
  /** タイトルのリンクの href（例：course_4123591_report_4378640）。課題を一意に決めるキー */
  key: string;
  title: string;
  course: string;
  /** 受付終了日時。空なら null（締切なし） */
  deadline: Date | null;
  /** 元の並び順 */
  index: number;
};

export type AssignmentTable = {
  table: HTMLTableElement;
  headerRow: HTMLTableRowElement | null;
  items: Assignment[];
};

const TITLE_HREF_RE = /^course_\d+_[a-z]+_\d+/;

/** 「YYYY-MM-DD HH:mm」（日本時間）を Date にする。読めなければ null。 */
export function parseJstDateTime(text: string): Date | null {
  const m = /(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/.exec(text);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi));
}

function parseRow(row: HTMLTableRowElement, index: number): Assignment | null {
  const cells = row.cells;
  if (cells.length < 5) return null;
  const titleLink = cells[1]!.querySelector<HTMLAnchorElement>("a[href]");
  const key = titleLink?.getAttribute("href") ?? "";
  if (!titleLink || !TITLE_HREF_RE.test(key)) return null;
  // 受付終了は 2 つ目の td-period。クラスがなければ 5 列目
  const periodCells = row.querySelectorAll("td.td-period");
  const endCell = periodCells.length >= 2 ? periodCells[1] : cells[4];
  return {
    row,
    key,
    title: textOf(titleLink),
    course: textOf(cells[2]),
    deadline: parseJstDateTime(textOf(endCell)),
    index,
  };
}

/** ページから課題の表を探して読む。見つからなければ null。 */
export function findAssignmentTable(doc: Document): AssignmentTable | null {
  for (const table of doc.querySelectorAll<HTMLTableElement>("table.stdlist")) {
    const rows = [...table.rows];
    const headerRow = rows.find((r) => r.classList.contains("title") || r.querySelector("th") !== null) ?? null;
    const items: Assignment[] = [];
    let index = 0;
    for (const row of rows) {
      if (row === headerRow) continue;
      const a = parseRow(row, index);
      if (a) {
        items.push(a);
        index++;
      }
    }
    // 課題が 0 件の表もあり得るので、見出し行があれば課題の表とみなす
    if (items.length > 0 || (headerRow && headerRow.cells.length >= 5)) return { table, headerRow, items };
  }
  return null;
}
