/**
 * Monthly model-maintenance budget. Only values marked `verified` were checked against an
 * official price page (see `source`); everything else is an illustrative assumption.
 */
export interface Param {
  key: string;
  value: number;
  unit: string;
  verified: boolean;
  source?: string;
  label: { ro: string; ru: string };
}

export const PRICES_CHECKED_AT = "2026-09-26";

export const COMMON: Param[] = [
  { key: "questions", value: 30000, unit: "/lună", verified: false, label: { ro: "Întrebări pe lună (ipoteză)", ru: "Вопросов в месяц (допущение)" } },
  { key: "inTok", value: 3000, unit: "tokeni", verified: false, label: { ro: "Tokeni de intrare / întrebare (instrucțiuni + ~6 pasaje)", ru: "Входных токенов / вопрос (инструкции + ~6 фрагментов)" } },
  { key: "outTok", value: 400, unit: "tokeni", verified: false, label: { ro: "Tokeni de ieșire / întrebare (răspuns structurat)", ru: "Выходных токенов / вопрос (структурированный ответ)" } },
  { key: "cachedShare", value: 0.5, unit: "fracție", verified: false, label: { ro: "Partea de intrare repetată, citită din cache (instrucțiuni fixe)", ru: "Доля входа из кэша (постоянные инструкции)" } },
  { key: "ocrPages", value: 2000, unit: "pagini/lună", verified: false, label: { ro: "Pagini scanate pe lună (OCR local, cost doar CPU)", ru: "Сканируемых страниц в месяц (локальный OCR, только CPU)" } },
];

export const API: Param[] = [
  { key: "inPrice", value: 1, unit: "USD / MTok", verified: true, source: "https://platform.claude.com/docs/en/about-claude/pricing", label: { ro: "Claude Haiku 4.5 — preț intrare", ru: "Claude Haiku 4.5 — цена входа" } },
  { key: "outPrice", value: 5, unit: "USD / MTok", verified: true, source: "https://platform.claude.com/docs/en/about-claude/pricing", label: { ro: "Claude Haiku 4.5 — preț ieșire", ru: "Claude Haiku 4.5 — цена выхода" } },
  { key: "cacheReadPrice", value: 0.1, unit: "USD / MTok", verified: true, source: "https://platform.claude.com/docs/en/about-claude/pricing", label: { ro: "Claude Haiku 4.5 — citire din cache", ru: "Claude Haiku 4.5 — чтение из кэша" } },
  { key: "appHosting", value: 40, unit: "USD/lună", verified: false, label: { ro: "Server aplicație + bază de date (VPS UE, 2–4 vCPU)", ru: "Сервер приложения + БД (VPS в ЕС, 2–4 vCPU)" } },
  { key: "storage", value: 10, unit: "USD/lună", verified: false, label: { ro: "Stocare fișiere + copii de rezervă (~200 GB)", ru: "Хранилище файлов + резервные копии (~200 ГБ)" } },
];

export const SELF: Param[] = [
  { key: "gpuServer", value: 250, unit: "USD/lună", verified: false, label: { ro: "Server GPU dedicat, 24 GB VRAM (model deschis 7–14B, vLLM)", ru: "Выделенный GPU-сервер, 24 ГБ VRAM (открытая модель 7–14B, vLLM)" } },
  { key: "appHosting", value: 40, unit: "USD/lună", verified: false, label: { ro: "Server aplicație + bază de date", ru: "Сервер приложения + БД" } },
  { key: "storage", value: 10, unit: "USD/lună", verified: false, label: { ro: "Stocare fișiere + copii de rezervă", ru: "Хранилище файлов + резервные копии" } },
  { key: "opsHours", value: 16, unit: "ore/lună", verified: false, label: { ro: "Ore de mentenanță (actualizări, monitorizare, evaluare)", ru: "Часы обслуживания (обновления, мониторинг, оценка)" } },
  { key: "opsRate", value: 15, unit: "USD/oră", verified: false, label: { ro: "Cost orar inginer (ipoteză locală)", ru: "Стоимость часа инженера (местное допущение)" } },
];

export function computeApi(c: Record<string, number>, a: Record<string, number>) {
  const inTotal = c.questions * c.inTok;
  const cached = inTotal * c.cachedShare;
  const uncached = inTotal - cached;
  const out = c.questions * c.outTok;
  const inference = (uncached / 1e6) * a.inPrice + (cached / 1e6) * a.cacheReadPrice + (out / 1e6) * a.outPrice;
  return { inference, total: inference + a.appHosting + a.storage, uncached, cached, out };
}

export function computeSelf(s: Record<string, number>) {
  const ops = s.opsHours * s.opsRate;
  return { inference: s.gpuServer, ops, total: s.gpuServer + s.appHosting + s.storage + ops };
}

export const toMap = (ps: Param[]) => Object.fromEntries(ps.map((p) => [p.key, p.value]));
