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
    ro: "Randat în browser și preluat automat. Atenție: redă în mare parte conținutul paginii principale.",
    ru: "Отрисовано в браузере и загружено автоматически. Внимание: в основном повторяет содержимое главной.",
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
    ro: "Aplicație JavaScript: HTML-ul brut nu are text, așa că pagina a fost randată în browser înainte de preluare. Conține în principal statistici și meniuri.",
    ru: "JavaScript-приложение: в сыром HTML нет текста, поэтому страница отрисована в браузере перед загрузкой. В основном статистика и меню.",
  },
  "https://escoala.chisinau.md/": {
    ro: "Aplicație JavaScript, randată în browser înainte de preluare. Conține doar adresa, telefonul și statistica cererilor.",
    ru: "JavaScript-приложение, отрисовано в браузере перед загрузкой. Содержит только адрес, телефон и статистику заявлений.",
  },
  "https://detsciocana.educ.md/": {
    ro: "Pagina afișează inițial „Loading”; conținutul a fost preluat după randare în browser.",
    ru: "Страница сначала показывает «Loading»; содержимое загружено после отрисовки в браузере.",
  },
  "https://help.chisinau.md/": {
    ro: "Preluat automat. Conținutul este în principal despre răspunsul la criza refugiaților.",
    ru: "Загружено автоматически. Содержание в основном о кризисе беженцев.",
  },
  "https://amt-ciocana.md/": {
    ro: "Preluat automat. Titlul paginii principale este un articol de știri, nu numele instituției.",
    ru: "Загружено автоматически. Заголовок главной — новостная статья, а не название учреждения.",
  },
};

const DEFAULT_NOTE: L10n = {
  ro: "Preluat automat (pagina principală și, unde există, pagina de contact), randat în browser. Pasajele sunt fragmente brute ale paginii, fără afirmații pre-extrase; asistentul le poate cita doar prin modul cu model AI sau căutarea în surse.",
  ru: "Загружено автоматически (главная и, где есть, страница контактов), с отрисовкой в браузере. Фрагменты — сырой текст страницы без заранее извлечённых утверждений; помощник может цитировать их только в режиме ИИ-модели или через поиск по источникам.",
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
