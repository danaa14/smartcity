import { answerQuestion } from "./pipeline";
import { validateClaims } from "./validate";
import { PASSAGE_BY_ID } from "../corpus/passages";
import { DOC_BY_ID } from "../corpus/docs";
import { normalize } from "../text";
import type { Answer, Claim } from "./types";
import type { Lang } from "../corpus/types";

type Office = {
  id: string;
  aliases: string[];
  title: string;
  address: string;
  passageId: string;
  quote: string;
};

const OFFICES: Office[] = [
  { id: "centru", aliases: ["centru", "центру", "центр", "telecentru", "телецентру"], title: "Pretura sectorului Centru", address: "str. Bulgară 43, Chișinău", passageId: "ax-chisinaucentru-md-contact#f1", quote: "Adresa str. Bulgară 43, Chișinău, Moldova" },
  { id: "ciocana", aliases: ["ciocana", "чокана"], title: "Pretura sectorului Ciocana", address: "bd. Mircea cel Bătrân, 4/3, Chișinău", passageId: "ax-ciocana-md-contact#f1", quote: "Adresa: bd. Mircea cel Bătrân, 4/3" },
  { id: "botanica", aliases: ["botanica", "ботаника"], title: "Pretura sectorului Botanica", address: "str. Teilor 10, Chișinău", passageId: "ax-botanica-md#f1", quote: "Pretura sectorului Botanica, str. Teilor nr.10" },
  { id: "rascani", aliases: ["rascani", "riscani", "рышкань", "рыскань", "рискань"], title: "Pretura sectorului Rîșcani", address: "str. Kiev 3, Chișinău", passageId: "ax-rascani-md#f1", quote: "Adresa: str. Kiev 3" },
  { id: "buiucani", aliases: ["buiucani", "буйуканы", "буюканы"], title: "Pretura sectorului Buiucani", address: "str. Mihai Viteazul 2, Chișinău", passageId: "ax-preturabuiucani-md#f11", quote: "Pretura sectorului Buiucani MD-2004, Republica Moldova, mun. Chișinău, str. Mihai Viteazul, 2" },
];

function hasAlias(q: string, alias: string): boolean {
  return new RegExp(`(?:^|\\s)${normalize(alias)}(?:$|\\s)`, "u").test(q);
}

/** Answer common civic office address questions using exact, indexed official passages. */
export function fastContactAnswer(question: string, lang: Lang): Answer | null {
  const q = normalize(question);
  if (!/(?:unde|adresa|sediu|locatie|gasesc|где|адрес|находится|расположен)/u.test(q)) return null;
  const isPretura = /(?:pretur|претур)/u.test(q);
  const isCityHall = /(?:primari|примэр|мэрия)/u.test(q) &&
    !/(?:orhei|balti|cahul|ungheni|soroca|bucuresti|iasi|бельц|оргеев)/u.test(q);
  const offices = isPretura ? OFFICES.filter((office) => office.aliases.some((alias) => hasAlias(q, alias))) : [];
  const cityHall = !isPretura && isCityHall;
  if (!offices.length && !cityHall) return null;

  const claims: Claim[] = [];
  const passages: Answer["passages"] = {};
  const docs: Answer["docs"] = {};
  const steps: Answer["steps"] = [];
  const sources: Answer["sources"] = [];
  let sourceNumber = 1;

  function addEvidence(claimId: string, text: Claim["text"], passageId: string, quote: string, stepText: string) {
    const passage = PASSAGE_BY_ID.get(passageId);
    const doc = passage && DOC_BY_ID.get(passage.docId);
    if (!passage || !doc?.url) return false;
    const claim: Claim = { id: claimId, text, citations: [{ n: sourceNumber, passageId, quote }], aspect: ["contact"], demo: false };
    claims.push(claim);
    sources.push({ n: sourceNumber++, passageId });
    passages[passage.id] = passage;
    docs[doc.id] = doc;
    steps.push({ text: { ro: stepText, ru: "Проверьте адрес на официальной странице перед визитом." }, claimIds: [claimId], action: { url: doc.url, label: { ro: "Deschide pagina oficială", ru: "Открыть официальную страницу" } } });
    return true;
  }

  if (cityHall) {
    if (!addEvidence("city-hall-address", { ro: "Primăria municipiului Chișinău se află pe bd. Ștefan cel Mare și Sfânt, 83, Chișinău (MD-2012).", ru: "Примэрия муниципия Кишинэу находится по адресу: бул. Штефан чел Маре ши Сфынт, 83, Кишинэу (MD-2012)." }, "pmc-home#p-adresa", "Adresa MD-2012 mun. Chişinău, Bulevardul Ştefan cel Mare şi Sfânt, 83", "Primăria municipiului Chișinău: bd. Ștefan cel Mare și Sfânt 83. Verifică pagina oficială înainte de vizită.")) return null;
  }
  for (const office of offices) {
    if (office.id === "centru" && /(?:telecentru|телецентру)/u.test(q)) {
      if (!addEvidence("telecentru-sector", { ro: "Cartierul Telecentru se află în sectorul Centru; instituția de sector este Pretura Centru.", ru: "Телецентр находится в секторе Центр; районная администрация — претура сектора Центр." }, "official-telecentru-sector-centru#location", "Proiectul municipal a fost realizat în sectorul Centru pe 17 adrese, cele mai multe lucrări fiind realizate în cartierul Telecentru.", "Telecentru ține de sectorul Centru. Pentru pretură, folosește pagina oficială a sectorului Centru.")) return null;
    }
    if (!addEvidence(`${office.id}-address`, { ro: `${office.title} se află pe ${office.address}.`, ru: `${office.title}: ${office.address}.` }, office.passageId, office.quote, `${office.title}: ${office.address}. Verifică pagina oficială înainte de vizită.`)) return null;
  }
  const { valid, report } = validateClaims(claims);
  if (valid.length !== claims.length) return null;
  const mainOffice = offices[0];
  const mainClaim = valid.find((claim) => claim.id.endsWith("-address"));
  const mainDoc = mainClaim && docs[passages[mainClaim.citations[0].passageId]?.docId];
  const base = answerQuestion(question, lang, { includeDemo: false, forceMissing: true });
  return {
    ...base,
    status: "supported",
    topicId: cityHall ? "city-hall-contact" : `pretura-${mainOffice.id}-contact`,
    topicTitle: cityHall ? { ro: "Primăria municipiului Chișinău", ru: "Примэрия муниципия Кишинэу" } : { ro: mainOffice.title, ru: mainOffice.title },
    summary: { ro: "Adresă confirmată în sursele oficiale indexate.", ru: "Адрес подтверждён индексированными официальными источниками." },
    claims: valid,
    claimIndex: Object.fromEntries(valid.map((claim) => [claim.id, claim])),
    sources, missing: [], contacts: [], steps,
    servicePage: mainDoc && mainClaim ? { url: mainDoc.url!, label: { ro: "Pagina oficială de contact", ru: "Официальная страница контактов" }, claimId: mainClaim.id } : undefined,
    passages, docs, validation: report,
    engine: { ...base.engine, label: { ro: "Răspuns extras din pasaje oficiale indexate și verificat prin citate exacte.", ru: "Ответ взят из индексированных официальных фрагментов и проверен точными цитатами." } },
  };
}
