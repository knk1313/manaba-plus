/** 要素の文字。連続する空白を 1 つにまとめ、前後の空白を除く。 */
export function textOf(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}
