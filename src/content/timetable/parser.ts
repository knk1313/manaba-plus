// ホームのコース一覧（HTML）から、コースと時限を読み取る。DOM は読むだけで変えない。
import type { Mod, Term } from "../../lib/settings";

export const DAYS = ["月", "火", "水", "木", "金", "土", "日"] as const;
export type Day = (typeof DAYS)[number];

export type Slot = { day: Day; period: number };

export type Schedule = {
  /** 元の文字列（表示用） */
  raw: string;
  /** 学期。読み取れなければ null */
  term: Term | null;
  modules: Mod[];
  /** 曜日と時限。読み取れたものだけ */
  slots: Slot[];
};

export type Course = {
  href: string;
  name: string;
  code: string;
  year: string;
  teachers: string;
  schedule: Schedule;
};

export type CoursePageResult =
  | { kind: "ok"; courses: Course[] }
  /** コース一覧がない（ログインが切れた） */
  | { kind: "login" }
  /** コース一覧はあるが、形式を読み取れない */
  | { kind: "unknown" };

const TERM_RE = /^(春|秋)([ABC]+)(?:\s+(.*))?$/;
const SLOT_RE = /^([月火水木金土日]+)([\d,\-~〜]+)$/;
const COURSE_HREF_RE = /^course_\d+$/;

/** 「1,2」「1-3」「1,3-4」を時限の配列にする。読めなければ null。 */
export function parsePeriods(text: string): number[] | null {
  const out: number[] = [];
  for (const part of text.split(",")) {
    if (part === "") continue;
    const range = /^(\d+)[-~〜](\d+)$/.exec(part);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (a > b || b - a > 10) return null;
      for (let p = a; p <= b; p++) out.push(p);
    } else if (/^\d+$/.test(part)) {
      out.push(Number(part));
    } else {
      return null;
    }
  }
  return out.length > 0 ? out : null;
}

/** 「秋C 月5,6、木1,2」のような時限の文字列を読む。想定外の表記でも例外は投げない。 */
export function parseSchedule(raw: string): Schedule {
  const display = raw.replace(/\s+/g, " ").trim();
  // 全角の英数字やカンマを半角にそろえる（「、」はそのまま残る）
  const text = display.normalize("NFKC");
  const result: Schedule = { raw: display, term: null, modules: [], slots: [] };

  const m = TERM_RE.exec(text);
  if (!m) return result;
  result.term = m[1] as Term;
  result.modules = [...new Set(m[2]!.split(""))] as Mod[];

  const rest = m[3] ?? "";
  for (const piece of rest.split(/[、\s]+/)) {
    const sm = SLOT_RE.exec(piece);
    if (!sm) continue; // 「他0」「集中」など
    const periods = parsePeriods(sm[2]!);
    if (!periods) continue;
    for (const day of sm[1]!.split("") as Day[]) {
      for (const period of periods) {
        if (period < 1) continue;
        if (!result.slots.some((s) => s.day === day && s.period === period)) result.slots.push({ day, period });
      }
    }
  }
  return result;
}

function text(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** サムネイル表示の div.coursecard を読む。 */
function parseCard(card: Element): Course | null {
  const link = [...card.querySelectorAll<HTMLAnchorElement>(".course-card-title a[href]")].find((a) =>
    COURSE_HREF_RE.test(a.getAttribute("href") ?? ""),
  );
  if (!link) return null;
  const dateDd = card.querySelector(".courseitemdetail-date");
  let year = "";
  if (dateDd) {
    year = [...dateDd.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? "")
      .join("")
      .trim();
  }
  const scheduleText = text(dateDd?.querySelector("span"));
  // 「担当」の dd は、日付の dd 以外の courseitemdetail
  const teachers = text(card.querySelector("dd.courseitemdetail:not(.courseitemdetail-date)"));
  return {
    href: link.getAttribute("href")!,
    name: text(link),
    code: text(card.querySelector(".coursecode")),
    year,
    teachers,
    schedule: parseSchedule(scheduleText),
  };
}

/**
 * リスト表示の一覧を読む。実ページの構造は未確認のため（表示の形式を切り替えると利用者の設定が変わるため）、
 * 「コースへのリンクがある行」から、時限らしい文字列と科目番号らしい文字列を探す緩い読み方にしている。
 */
function parseListRows(box: Element): Course[] {
  const courses: Course[] = [];
  for (const row of box.querySelectorAll("tr")) {
    const link = [...row.querySelectorAll<HTMLAnchorElement>("a[href]")].find((a) =>
      COURSE_HREF_RE.test(a.getAttribute("href") ?? ""),
    );
    if (!link) continue;
    const cells = [...row.querySelectorAll("td")].map((c) => text(c));
    const schedCell = cells.find((c) => /(春|秋)[ABC]+/.test(c)) ?? "";
    const schedule = parseSchedule(schedCell.replace(/^\d{4}\s*/, ""));
    courses.push({
      href: link.getAttribute("href")!,
      name: text(link),
      code: cells.find((c) => /^[0-9A-Z]{7}$/.test(c)) ?? "",
      year: /^(\d{4})/.exec(schedCell)?.[1] ?? "",
      teachers: "",
      schedule,
    });
  }
  return courses;
}

/** home__all_y{YYYY} を DOMParser で読んだ Document から、コースを取り出す。 */
export function parseCoursePage(doc: Document): CoursePageResult {
  const box = doc.querySelector("div.my-infolist-mycourses:not(.my-infolist-deactivecourse)");
  if (!box) return { kind: "login" };

  const cards = box.querySelectorAll("div.coursecard");
  if (cards.length > 0) {
    const courses = [...cards].map(parseCard).filter((c): c is Course => c !== null);
    return courses.length > 0 ? { kind: "ok", courses } : { kind: "unknown" };
  }

  const listed = parseListRows(box);
  if (listed.length > 0) return { kind: "ok", courses: listed };

  // コースへのリンクが一つもなければ、その年度のコースが 0 件
  const anyCourseLink = [...box.querySelectorAll("a[href]")].some((a) =>
    COURSE_HREF_RE.test(a.getAttribute("href") ?? ""),
  );
  return anyCourseLink ? { kind: "unknown" } : { kind: "ok", courses: [] };
}

/** ホームの年度の select（home___yYYYY）から、選べる年度を新しい順に取り出す。 */
export function parseYearOptions(doc: Document): number[] {
  const years = new Set<number>();
  for (const opt of doc.querySelectorAll<HTMLOptionElement>(".my-infolist-mycourses .showmore select option")) {
    const m = /^home___y(\d{4})(?:\?|$)/.exec(opt.value);
    if (m) years.add(Number(m[1]));
  }
  return [...years].sort((a, b) => b - a);
}
