// 拡張機能を dist/ に組み立てる。--watch で変更を監視する。
import { build, context } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const watch = process.argv.includes("--watch");
const out = "dist";

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

function copyStatic() {
  cpSync("manifest.json", `${out}/manifest.json`);
  cpSync("icons", `${out}/icons`, { recursive: true });
  cpSync("src/options/options.html", `${out}/options.html`);
  // content script の CSS は、トークンと各機能の CSS を 1 つにまとめる
  const css = ["src/content/tokens.css", "src/content/common.css", "src/content/timetable/style.css", "src/content/assignments/style.css"]
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  writeFileSync(`${out}/content.css`, css);
  cpSync("src/content/tokens.css", `${out}/tokens.css`);
  cpSync("src/options/options.css", `${out}/options.css`);
}

const options = {
  entryPoints: { content: "src/content/main.ts", options: "src/options/options.ts" },
  outdir: out,
  bundle: true,
  format: "iife",
  target: "chrome120",
  logLevel: "info",
  plugins: [{ name: "static", setup: (b) => b.onEnd(copyStatic) }],
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
