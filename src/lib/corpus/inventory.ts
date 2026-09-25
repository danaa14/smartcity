import probe from "../../../corpus/annex-probe.json";
import { DOCS } from "./docs";
import type { L10n } from "./types";

export interface InventoryRow {
  category: string;
  startUrl: string;
  accessible: boolean;
  httpStatus: number | string;
  finalUrl?: string;
  homeTitle?: string | null;
  htmlLang?: string | null;
  jsOnly: boolean;
  probedAt: string;
  processed: {
    docId: string;
    title: string;
    url: string | null;
    publisher: string;
    lang: string;
    publishedAt?: string;
    effectiveAt?: string;
    revisedAt?: string;
    retrievedAt: string;
    passageCitable: boolean;
  }[];
  note: L10n;
}

const NOTES: Record<string, L10n> = {
  "https://chisinau.md/": {
    ro: "Procesat: pagina de petiții (RO și RU) și blocul de contacte din subsolul paginii principale. Deciziile CMC și lista de taxe locale nu au fost procesate (listări filtrabile, fără text citabil în HTML).",
    ru: "Обработано: страница петиций (RO и RU) и контакты в подвале главной. Решения МСК и местные сборы не обработаны (фильтруемые списки без цитируемого текста в HTML).",
  },
  "https://www.chisinau.md/ro/transparenta": {
    ro: "Accesibil, dar redă conținutul paginii principale; nu a fost găsit un document distinct de citat în timpul acestei rulări.",
    ru: "Доступно, но показывает содержимое главной; отдельный документ для цитирования не найден.",
  },
  "https://www.acc.md/": {
    ro: "Procesat în profunzime: contractare (apartament), întrebări frecvente, contacte, tarife (Hotărârea ANRE nr. 479 reprodusă + istoric).",
    ru: "Обработано подробно: договор (квартира), вопросы и ответы, контакты, тарифы (постановление НАРЭ № 479 + история).",
  },
  "https://autosalubritate.md/informatie-de-contact/": {
    ro: "Procesat: pagina de contact și pagina „Servicii persoane fizice” (tarife, acte). Pagina nu indică data tarifelor.",
    ru: "Обработано: контакты и «Услуги для физлиц» (тарифы, документы). Дата тарифов не указана.",
  },
  "https://agsv.md/diagrama-defrisare-curatare-a-arborilor-2/": {
    ro: "URL-ul din anexă afișează pagina „Contacte”, nu o diagramă. Prin linkul „Model Cerere” au fost găsite pagina de formulare și PDF-ul cererii de examinare fitosanitară (procesate).",
    ru: "URL из приложения показывает «Контакты», а не диаграмму. По ссылке «Model Cerere» найдены страница форм и PDF заявления (обработаны).",
  },
  "https://egradinita.md/": {
    ro: "Aplicație JavaScript: HTML-ul nu conține text citabil fără execuție în browser. Neprocesat.",
    ru: "JavaScript-приложение: без выполнения в браузере HTML не содержит цитируемого текста. Не обработано.",
  },
  "https://escoala.chisinau.md/": {
    ro: "Aplicație JavaScript: HTML-ul nu conține text citabil. Neprocesat.",
    ru: "JavaScript-приложение: HTML не содержит цитируемого текста. Не обработано.",
  },
  "https://detsciocana.educ.md/": {
    ro: "Pagina afișează doar „Loading”; conținutul se încarcă dinamic. Neprocesat.",
    ru: "Страница показывает только «Loading»; содержимое загружается динамически. Не обработано.",
  },
  "https://help.chisinau.md/": {
    ro: "Accesibil (conține un contact DGAMS), dar conținutul este în principal despre răspunsul la criza refugiaților; neinclus în corpus.",
    ru: "Доступно (есть контакт DGAMS), но содержание в основном о кризисе беженцев; в корпус не включено.",
  },
  "https://amt-ciocana.md/": {
    ro: "Titlul paginii principale este un articol de știri, nu numele instituției. Neprocesat.",
    ru: "Заголовок главной — новостная статья, а не название учреждения. Не обработано.",
  },
};

const DEFAULT_NOTE: L10n = {
  ro: "Accesibil la verificare (HTTP 200). Nu a fost procesat în această rulare — prioritate a avut o procedură completă și demonstrabilă.",
  ru: "Доступно при проверке (HTTP 200). В этом прогоне не обработано — приоритет у полной демонстрируемой процедуры.",
};

type ProbeRow = { category: string; startUrl: string; probedAt: string; status: number | string; finalUrl?: string; title?: string | null; lang?: string | null; looksJsOnly?: boolean };

export const INVENTORY: InventoryRow[] = (probe as ProbeRow[]).map((r) => {
  const processed = DOCS.filter((d) => d.kind === "real" && d.annexStartUrl === r.startUrl).map((d) => ({
    docId: d.id,
    title: d.title,
    url: d.url,
    publisher: d.publisher,
    lang: d.lang,
    publishedAt: d.publishedAt,
    effectiveAt: d.effectiveAt,
    revisedAt: d.revisedAt,
    retrievedAt: d.retrievedAt,
    passageCitable: true,
  }));
  return {
    category: r.category,
    startUrl: r.startUrl,
    accessible: r.status === 200,
    httpStatus: r.status,
    finalUrl: r.finalUrl,
    homeTitle: r.title?.replace(/&#8211;/g, "–").replace(/&#x2d;/g, "-"),
    htmlLang: r.lang,
    jsOnly: !!r.looksJsOnly || r.title === "Loading",
    probedAt: r.probedAt.slice(0, 10),
    processed,
    note: NOTES[r.startUrl] ?? DEFAULT_NOTE,
  };
});

export const INVENTORY_STATS = {
  total: INVENTORY.length,
  accessible: INVENTORY.filter((r) => r.accessible).length,
  processedStartUrls: INVENTORY.filter((r) => r.processed.length).length,
  processedDocs: INVENTORY.reduce((s, r) => s + r.processed.length, 0),
};
