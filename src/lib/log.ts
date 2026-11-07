/** 想定と違うときの警告。元のページは壊さず、コンソールにだけ出す。 */
export function warn(message: string, ...detail: unknown[]): void {
  console.warn(`[manaba-plus] ${message}`, ...detail);
}
