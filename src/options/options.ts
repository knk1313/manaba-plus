// F4：オプション画面。
import { academicYear } from "../content/timetable/module";
import { builtinStarts, dateInYear, hasBuiltinCalendar, MODULE_KEYS, validateStarts, type ModuleKey, type ModuleStarts } from "../lib/modulePeriods";
import { normalizeSettings, startsForYear, validateThresholds, type Settings, type Thresholds } from "../lib/settings";
import { clearHiddenAll, clearTimetableCache, getHiddenAll, getSettings, saveSettings } from "../lib/storage";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let settings: Settings;
/** 年度ごとに編集中の開始日（保存するまでここに持つ） */
const editing = new Map<number, ModuleStarts>();
let currentYear = academicYear(new Date());

function showBanner(message: string, kind: "success" | "error"): void {
  const b = $("banner");
  b.textContent = message;
  b.className = `op-banner op-banner--${kind}`;
  b.setAttribute("role", kind === "error" ? "alert" : "status");
  b.hidden = false;
}

function setError(input: HTMLElement | null, errorEl: HTMLElement, message: string): void {
  errorEl.textContent = message;
  errorEl.hidden = message === "";
  if (input) {
    if (message) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", errorEl.id);
    } else {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
  }
}

// ---- モジュールの開始日 ----

function startsOf(year: number): ModuleStarts {
  return editing.get(year) ?? startsForYear(settings, year);
}

function renderModuleRows(): void {
  const tbody = $("mod-rows");
  tbody.replaceChildren();
  const starts = startsOf(currentYear);
  for (const key of MODULE_KEYS) {
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = key;
    const input = document.createElement("input");
    input.type = "date";
    input.className = "op-input op-input--date";
    input.value = dateInYear(currentYear, starts[key]);
    input.min = `${currentYear}-04-01`;
    input.max = `${currentYear + 1}-03-31`;
    input.setAttribute("aria-label", `${key}の開始日`);
    input.dataset.key = key;
    input.addEventListener("change", onModuleInput);
    const td = document.createElement("td");
    td.append(input);
    const tr = document.createElement("tr");
    tr.append(th, td);
    tbody.append(tr);
  }
  $("mod-note").textContent = startsNote(currentYear);
  setError(null, $("mod-error"), "");
}

/** その年度に、どの開始日を使っているかの説明。 */
function startsNote(year: number): string {
  const overridden = settings.moduleStartsByYear[String(year)] !== undefined || editing.has(year);
  if (overridden) return `${year}年度は、ここで変更した開始日を使っています。`;
  return hasBuiltinCalendar(year)
    ? `${year}年度は、拡張機能に入っている学年暦の開始日を使っています。`
    : `${year}年度は、目安の開始日を使っています。大学の学年暦と違うときは直してください。`;
}

function onModuleInput(e: Event): void {
  const input = e.target as HTMLInputElement;
  const key = input.dataset.key as ModuleKey;
  const starts = { ...startsOf(currentYear) };
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.value)) starts[key] = input.value.slice(5);
  editing.set(currentYear, starts);
}

function renderYearOptions(): void {
  const select = $<HTMLSelectElement>("mod-year");
  const base = academicYear(new Date());
  const years = new Set<number>([base - 1, base, base + 1, ...Object.keys(settings.moduleStartsByYear).map(Number)]);
  select.replaceChildren(
    ...[...years]
      .sort((a, b) => b - a)
      .map((y) => {
        const o = document.createElement("option");
        o.value = String(y);
        o.textContent = `${y}年度`;
        return o;
      }),
  );
  select.value = String(currentYear);
}

// ---- 読み込みと保存 ----

function fillForm(): void {
  $<HTMLInputElement>("th-urgent").value = String(settings.thresholds.urgentHours);
  $<HTMLInputElement>("th-soon").value = String(settings.thresholds.soonHours);
  $<HTMLInputElement>("th-week").value = String(settings.thresholds.weekHours);
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="panel-default"]')) {
    r.checked = r.value === (settings.panelDefaultOpen ? "open" : "closed");
  }
  $<HTMLInputElement>("always-sat").checked = settings.alwaysShowSaturday;
  renderYearOptions();
  renderModuleRows();
}

const THRESHOLD_INPUTS: Record<keyof Thresholds, string> = { urgentHours: "th-urgent", soonHours: "th-soon", weekHours: "th-week" };

function readThresholds(): Thresholds | null {
  const raw = (id: string) => $<HTMLInputElement>(id).value.trim();
  const values = Object.fromEntries(
    Object.entries(THRESHOLD_INPUTS).map(([key, id]) => [key, raw(id) === "" ? Number.NaN : Number(raw(id))]),
  ) as Thresholds;
  const errors = validateThresholds(values);
  for (const [key, id] of Object.entries(THRESHOLD_INPUTS) as [keyof Thresholds, string][]) {
    setError($(id), $(`${id}-error`), errors[key] ?? "");
  }
  return Object.keys(errors).length === 0 ? values : null;
}

async function onSubmit(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  const thresholds = readThresholds();
  let periodError = "";
  for (const [year, starts] of editing) {
    periodError = validateStarts(year, starts);
    if (periodError) {
      if (year !== currentYear) {
        currentYear = year;
        renderYearOptions();
        renderModuleRows();
      }
      break;
    }
  }
  setError(null, $("mod-error"), periodError);
  if (!thresholds || periodError) {
    showBanner("入力内容に誤りがあります。赤い文字の項目を直してから、もう一度「保存する」を押してください。", "error");
    const firstInvalid = document.querySelector<HTMLElement>('[aria-invalid="true"]') ?? (periodError ? $("mod-error") : null);
    firstInvalid?.focus();
    return;
  }
  const byYear = { ...settings.moduleStartsByYear };
  for (const [year, starts] of editing) {
    // 拡張機能に入っている開始日と違うモジュールだけを保存する
    const base = builtinStarts(year);
    const diff: Partial<ModuleStarts> = {};
    for (const key of MODULE_KEYS) if (starts[key] !== base[key]) diff[key] = starts[key];
    if (Object.keys(diff).length > 0) byYear[String(year)] = diff;
    else delete byYear[String(year)];
  }
  const next: Settings = {
    thresholds,
    moduleStartsByYear: byYear,
    panelDefaultOpen: document.querySelector<HTMLInputElement>('input[name="panel-default"]:checked')?.value !== "closed",
    alwaysShowSaturday: $<HTMLInputElement>("always-sat").checked,
  };
  try {
    await saveSettings(next);
  } catch {
    showBanner("設定を保存できませんでした。時間をおいて、もう一度お試しください。", "error");
    return;
  }
  settings = normalizeSettings(next);
  editing.clear();
  renderModuleRows();
  showBanner("設定を保存しました。manabaのページを開き直すと反映されます。", "success");
}

async function refreshHiddenCount(): Promise<void> {
  const n = (await getHiddenAll()).size;
  $("hidden-count").textContent = `非表示にした課題は${n}件です。締切から30日たった記録は自動で削除します。`;
  $<HTMLButtonElement>("clear-hidden").disabled = n === 0;
}

async function main(): Promise<void> {
  settings = await getSettings();
  fillForm();
  void refreshHiddenCount();

  $<HTMLFormElement>("settings-form").addEventListener("submit", (e) => void onSubmit(e));
  $<HTMLSelectElement>("mod-year").addEventListener("change", (e) => {
    currentYear = Number((e.target as HTMLSelectElement).value);
    renderModuleRows();
  });
  $("mod-reset").addEventListener("click", () => {
    editing.set(currentYear, builtinStarts(currentYear));
    renderModuleRows();
    $("mod-note").textContent = `${currentYear}年度を、拡張機能に入っている開始日に戻しました。「保存する」を押すと確定します。`;
  });
  $("clear-cache").addEventListener("click", async () => {
    try {
      await clearTimetableCache();
      showBanner("時間割のキャッシュを削除しました", "success");
    } catch {
      showBanner("キャッシュを削除できませんでした。時間をおいて、もう一度お試しください。", "error");
    }
  });

  const dialog = $<HTMLDialogElement>("confirm-hidden");
  $("clear-hidden").addEventListener("click", () => dialog.showModal());
  $("confirm-cancel").addEventListener("click", () => dialog.close());
  $("confirm-ok").addEventListener("click", async () => {
    dialog.close();
    try {
      const n = await clearHiddenAll();
      showBanner(`非表示にした課題の記録を${n}件削除しました`, "success");
    } catch {
      showBanner("記録を削除できませんでした。時間をおいて、もう一度お試しください。", "error");
    }
    void refreshHiddenCount();
  });
}

void main();
