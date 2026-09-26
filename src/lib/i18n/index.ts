import type { L10n, Lang } from "../corpus/types";

export type { Lang, L10n };
export const LANGS: Lang[] = ["ro", "ru"];
export const LANG_COOKIE = "pefir_lang";

export function tr(l: L10n, lang: Lang): string {
  return l[lang];
}

export function fmtDate(iso: string | undefined, lang: Lang): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso);
  return d.toLocaleDateString(lang === "ro" ? "ro-MD" : "ru-MD", { day: "2-digit", month: "long", year: "numeric" });
}

export function fmtDateTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(lang === "ro" ? "ro-MD" : "ru-MD", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export const UI = {
  appName: { ro: "Chișinău, pe fir", ru: "Кишинэу, на связи" },
  promise: {
    ro: "Fiecare indicație are o dovadă. Fiecare problemă are un traseu.",
    ru: "У каждого указания есть доказательство. У каждой проблемы есть маршрут.",
  },
  prototype: {
    ro: "Prototip independent. Nu este un serviciu oficial al Primăriei Chișinău.",
    ru: "Независимый прототип. Не является официальным сервисом Примэрии Кишинэу.",
  },
  skip: { ro: "Sari la conținut", ru: "Перейти к содержанию" },
  nav: {
    home: { ro: "Acasă", ru: "Главная" },
    ask: { ro: "Întreabă primăria", ru: "Спросить примэрию" },
    scan: { ro: "Scanează un document", ru: "Сканировать документ" },
    report: { ro: "Raportează o problemă", ru: "Сообщить о проблеме" },
    call: { ro: "Sună", ru: "Позвонить" },
    sources: { ro: "Surse", ru: "Источники" },
    staff: { ro: "Pentru angajați", ru: "Для сотрудников" },
    about: { ro: "Despre și buget", ru: "О проекте и бюджет" },
  },
  navShort: {
    ask: { ro: "Întreabă", ru: "Спросить" },
    scan: { ro: "Scanează", ru: "Скан" },
    report: { ro: "Raportează", ru: "Сообщить" },
    call: { ro: "Sună", ru: "Звонок" },
    more: { ro: "Mai mult", ru: "Ещё" },
  },
  langLabel: { ro: "Limba interfeței", ru: "Язык интерфейса" },
  mainNav: { ro: "Navigare principală", ru: "Основная навигация" },
  footerData: {
    ro: "Datele din surse reale au fost preluate la 25.09.2026. Documentele marcate DEMO sunt fictive.",
    ru: "Данные из реальных источников получены 25.09.2026. Документы с пометкой DEMO вымышлены.",
  },
  status: {
    supported: { ro: "Susținut de surse", ru: "Подтверждено источниками" },
    partial: { ro: "Susținut parțial", ru: "Подтверждено частично" },
    missing: { ro: "Lipsește din corpus", ru: "Нет в корпусе" },
    contradiction: { ro: "Posibilă contradicție", ru: "Возможное противоречие" },
  },
  demoBadge: { ro: "DEMO — fictiv", ru: "DEMO — вымысел" },
  realBadge: { ro: "Sursă reală", ru: "Реальный источник" },
  openOriginal: { ro: "Deschide pagina originală", ru: "Открыть оригинал" },
  externalNote: { ro: "(se deschide într-o filă nouă, site extern)", ru: "(откроется в новой вкладке, внешний сайт)" },
} satisfies Record<string, unknown>;
