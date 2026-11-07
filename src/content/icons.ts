// アイコン（SVG）。
// Lucide（ISC License）のアイコンの形。中身は固定の文字列だけ。
const ICONS = {
  /** chevron-down：開閉とセレクト */
  chevron: '<path d="m6 9 6 6 6-6"/>',
  /** file-text：レポート */
  report:
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  /** clipboard-list：アンケート */
  survey:
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  /** pencil-line：小テスト・ドリル・外部教材 */
  query:
    '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/><path d="m15 5 3 3"/>',
} as const;

export type IconName = keyof typeof ICONS;

/** 装飾のアイコン（aria-hidden）。名前は隣の文字や title で伝える。 */
export function icon(name: IconName, size = 24): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  for (const [k, v] of Object.entries({
    viewBox: "0 0 24 24",
    width: String(size),
    height: String(size),
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    class: `mp-icon mp-icon--${name}`,
  })) {
    svg.setAttribute(k, v);
  }
  svg.innerHTML = ICONS[name];
  return svg;
}
