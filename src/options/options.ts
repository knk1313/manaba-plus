// F4：オプション画面。
import { academicYear } from "../content/timetable/module";
import { DEFAULT_PERIODS, MODULE_KEYS, normalizeSettings, periodsForYear, type ModuleKey, type ModulePeriods, type Settings } from "../lib/settings";
import { clearTimetableCache, getHiddenAll, getSettings, KEYS, saveSettings } from "../lib/storage";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let settings: Settings;
/** 年度ごとに編集中の期間（保存するまでここに持つ） */
const editing = new Map<number, ModulePeriods>();
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

// ---- モジュールの期間 ----

/** 「MM-DD」を、その年度の yyyy-mm-dd にする（1〜3月は翌年）。 */
function toDate(year: number, mmdd: string): string {
  const m = Number(mmdd.slice(0, 2));
  return `${m >= 4 ? year : year + 1}-${mmdd}`;
}

function periodsOf(year: number): ModulePeriods {
  return editing.get(year) ?? periodsForYear(settings, year);
}

function renderModuleRows(): void {
  const tbody = $("mod-rows");
  tbody.replaceChildren();
  const periods = periodsOf(currentYear);
  for (const key of MODULE_KEYS) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = key;
    tr.append(th);
    for (const edge of ["start", "end"] as const) {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "date";
      input.className = "op-input op-input--date";
      input.value = toDate(currentYear, periods[key][edge]);
      input.min = `${currentYear}-04-01`;
      input.max = `${currentYear + 1}-03-31`;
      input.setAttribute("aria-label", `${key}の${edge === "start" ? "開始日" : "終了日"}`);
      input.dataset.key = key;
      input.dataset.edge = edge;
      input.addEventListener("change", onModuleInput);
      td.append(input);
      tr.append(td);
    }
    tbody.append(tr);
  }
  const overridden = settings.modulePeriodsByYear[String(currentYear)] !== undefined || editing.has(currentYear);
  $("mod-note").textContent = overridden ? `${currentYear}年度は、変更した期間を使っています。` : `${currentYear}年度は、既定の期間を使っています。`;
  setError(null, $("mod-error"), "");
}

function onModuleInput(e: Event): void {
  const input = e.target as HTMLInputElement;
  const key = input.dataset.key as ModuleKey;
  const edge = input.dataset.edge as "start" | "end";
  const periods = structuredClone(periodsOf(currentYear));
  if (/^\d{4}-\d{2}-\d{2}$/.test(input.value)) periods[key][edge] = input.value.slice(5);
  editing.set(currentYear, periods);
}

/** 期間の誤りを返す。なければ空文字。 */
function validatePeriods(year: number, periods: ModulePeriods): string {
  const n = (mmdd: string) => Number(toDate(year, mmdd).replaceAll("-", ""));
  let prevEnd = 0;
  for (const key of MODULE_KEYS) {
    const s = n(periods[key].start);
    const e = n(periods[key].end);
    if (s > e) return `${year}年度の${key}は、終了日を開始日以降にしてください`;
    if (s <= prevEnd) return `${year}年度の${key}は、前のモジュールの終了日より後に始まるようにしてください`;
    prevEnd = e;
  }
  return "";
}

function renderYearOptions(): void {
  const select = $<HTMLSelectElement>("mod-year");
  const base = academicYear(new Date());
  const years = new Set<number>([base - 1, base, base + 1, ...Object.keys(settings.modulePeriodsByYear).map(Number)]);
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

function readThresholds(): Settings["thresholds"] | null {
  const ids = ["th-urgent", "th-soon", "th-week"] as const;
  const labels = ["緊急", "近い", "今週"];
  const values: number[] = [];
  let ok = true;
  ids.forEach((id, i) => {
    const input = $<HTMLInputElement>(id);
    const v = Number(input.value);
    let msg = "";
    if (input.value.trim() === "" || !Number.isInteger(v) || v < 1) msg = `${labels[i]}の時間は、1以上の整数で入力してください`;
    else if (i > 0 && values[i - 1] !== undefined && v <= values[i - 1]!) msg = `${labels[i]}の時間は、${labels[i - 1]}の時間（${values[i - 1]}）より大きくしてください`;
    setError(input, $(`${id}-error`), msg);
    if (msg) ok = false;
    values.push(v);
  });
  return ok ? { urgentHours: values[0]!, soonHours: values[1]!, weekHours: values[2]! } : null;
}

async function onSubmit(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  const thresholds = readThresholds();
  let periodError = "";
  for (const [year, periods] of editing) {
    periodError = validatePeriods(year, periods);
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
  const byYear = { ...settings.modulePeriodsByYear };
  for (const [year, periods] of editing) {
    const diff: Partial<ModulePeriods> = {};
    for (const key of MODULE_KEYS) {
      if (periods[key].start !== DEFAULT_PERIODS[key].start || periods[key].end !== DEFAULT_PERIODS[key].end) diff[key] = periods[key];
    }
    if (Object.keys(diff).length > 0) byYear[String(year)] = diff;
    else delete byYear[String(year)];
  }
  const next: Settings = {
    thresholds,
    modulePeriodsByYear: byYear,
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
    editing.set(currentYear, structuredClone(DEFAULT_PERIODS));
    renderModuleRows();
    $("mod-note").textContent = `${currentYear}年度を既定の期間に戻しました。「保存する」を押すと確定します。`;
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
      const all = await getHiddenAll();
      await chrome.storage.sync.remove([...all.keys()].map((k) => KEYS.hiddenPrefix + k));
      showBanner(`非表示にした課題の記録を${all.size}件削除しました`, "success");
    } catch {
      showBanner("記録を削除できませんでした。時間をおいて、もう一度お試しください。", "error");
    }
    void refreshHiddenCount();
  });
}

void main();
