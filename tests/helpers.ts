import { readFileSync } from "node:fs";
import { join } from "node:path";

export function loadFixture(name: string): Document {
  const html = readFileSync(join(import.meta.dirname, "fixtures", name), "utf8");
  return new DOMParser().parseFromString(html, "text/html");
}
