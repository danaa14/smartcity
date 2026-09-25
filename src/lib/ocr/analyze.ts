import { FACT_BY_ID } from "../corpus/facts";
import { normalize } from "../text";
import type { L10n } from "../corpus/types";

export interface Observation {
  id: string;
  lineKeys: string[];
  text: L10n;
  kind: "blank_field" | "detected_heading" | "low_confidence";
}

export interface Suggestion {
  id: string;
  text: L10n;
  factId: string;
  basedOn: string[];
}

export interface Analysis {
  recognizedForm: { id: string; title: L10n } | null;
  observations: Observation[];
  suggestions: Suggestion[];
  needsReview: { reason: L10n }[];
}

interface LineIn {
  key: string;
  text: string;
  conf: number;
}

/** Field labels that, when followed mostly by underscores or nothing, suggest an unfilled field. */
const FIELD_LABELS: { label: string; name: L10n; multiline?: boolean }[] = [
  { label: "subsemnatul", name: { ro: "Numele solicitantului („Subsemnatul/a”)", ru: "Имя заявителя («Subsemnatul/a»)" } },
  { label: "telefon de contact", name: { ro: "Telefon de contact", ru: "Контактный телефон" } },
  { label: "adresa de e mail", name: { ro: "Adresa de e-mail", ru: "Адрес e-mail" } },
  { label: "strada", name: { ro: "Strada", ru: "Улица" } },
  { label: "deoarece", multiline: true, name: { ro: "Motivul cererii („deoarece…”)", ru: "Причина заявления («deoarece…»)" } },
  { label: "acordul locatarilor", name: { ro: "Numărul de file din „Acordul locatarilor”", ru: "Число листов «Acordul locatarilor»" } },
  { label: "data", name: { ro: "Data", ru: "Дата" } },
  { label: "semnatura", name: { ro: "Semnătura", ru: "Подпись" } },
];

const FILLER = new Set(["nr", "ap", "a", "file", "de", "si"]);

function hasLabel(line: string, label: string): boolean {
  return ` ${normalize(line)} `.includes(` ${label} `) || normalize(line).startsWith(`${label} `) || normalize(line) === label;
}

/** Blank if, after the label, only other labels, filler words or digits remain (OCR drops underscores). */
function looksBlankAfter(line: string, label: string): boolean {
  const n = ` ${normalize(line)} `;
  const i = n.indexOf(` ${label} `);
  if (i < 0) return false;
  let rest = n.slice(i + label.length + 2);
  for (const f of FIELD_LABELS) rest = ` ${rest} `.replace(` ${f.label} `, " ");
  const words = rest.split(" ").filter((w) => w && !FILLER.has(w) && !/^\d+$/.test(w));
  return words.join("").length <= 2;
}

export function analyzeOcr(lines: LineIn[], meanConfidence: number, textOverride?: string): Analysis {
  const src: LineIn[] = textOverride
    ? textOverride.split("\n").map((t, i) => ({ key: `edit-${i}`, text: t, conf: 100 }))
    : lines;
  const full = normalize(src.map((l) => l.text).join(" "));
  const observations: Observation[] = [];
  const needsReview: Analysis["needsReview"] = [];

  const isAgsv = full.includes("examinare fitosanitara") && full.includes("arbori");
  const recognizedForm = isAgsv
    ? { id: "agsv-form", title: { ro: "Cerere pentru examinare fitosanitară a arborilor (AGSV)", ru: "Заявление на фитосанитарное обследование деревьев (AGSV)" } }
    : null;

  if (isAgsv) {
    const heading = src.find((l) => normalize(l.text).includes("examinare fitosanitara"));
    observations.push({
      id: "heading",
      kind: "detected_heading",
      lineKeys: heading ? [heading.key] : [],
      text: {
        ro: `Textul recunoscut conține titlul „${heading?.text.trim() ?? "EXAMINARE FITOSANITARĂ"}”.`,
        ru: `В распознанном тексте есть заголовок «${heading?.text.trim() ?? "EXAMINARE FITOSANITARĂ"}».`,
      },
    });
  }

  for (const f of FIELD_LABELS) {
    const idx = src.findIndex((l) => hasLabel(l.text, f.label));
    const line = idx >= 0 ? src[idx] : null;
    const next = f.multiline ? src[idx + 1] : undefined;
    const continuesBelow = !!next && !normalize(next.text).startsWith("anexe") && normalize(next.text).split(" ").length >= 3;
    if (line && looksBlankAfter(line.text, f.label) && !continuesBelow)
      observations.push({
        id: `blank-${f.label}`,
        kind: "blank_field",
        lineKeys: [line.key],
        text: {
          ro: `Câmpul „${f.name.ro}” pare necompletat în textul recunoscut.`,
          ru: `Поле «${f.name.ru}» в распознанном тексте выглядит незаполненным.`,
        },
      });
  }

  const low = src.filter((l) => l.conf < 60 && l.text.replace(/[_\W]/g, "").length > 3);
  if (low.length)
    observations.push({
      id: "low-conf",
      kind: "low_confidence",
      lineKeys: low.map((l) => l.key),
      text: {
        ro: `${low.length} rând(uri) au fost recunoscute cu încredere scăzută (sub 60%). Verificați-le manual.`,
        ru: `${low.length} строк(и) распознаны с низкой уверенностью (ниже 60%). Проверьте их вручную.`,
      },
    });

  if (!textOverride && meanConfidence < 70)
    needsReview.push({
      reason: {
        ro: `Încrederea medie OCR este ${meanConfidence}%. Textul poate conține erori — corectați-l înainte de a vă baza pe el.`,
        ru: `Средняя уверенность OCR — ${meanConfidence}%. В тексте могут быть ошибки — исправьте его, прежде чем полагаться на него.`,
      },
    });
  if (full.replace(/\s/g, "").length < 40)
    needsReview.push({
      reason: {
        ro: "S-a recunoscut foarte puțin text. Încercați o fotografie mai clară, dreaptă și bine luminată.",
        ru: "Распознано очень мало текста. Попробуйте более чёткое, ровное и хорошо освещённое фото.",
      },
    });

  const suggestions: Suggestion[] = [];
  if (isAgsv) {
    suggestions.push({
      id: "s-acord",
      factId: "a-acord",
      basedOn: ["heading"],
      text: {
        ro: "Procedura publicată de AGSV menționează că la această cerere se anexează acordul locatarilor. Verificați dacă l-ați inclus.",
        ru: "В опубликованном порядке AGSV указано, что к этому заявлению прилагается согласие жильцов. Проверьте, приложили ли вы его.",
      },
    });
    suggestions.push({
      id: "s-cine",
      factId: "a-cine",
      basedOn: ["heading"],
      text: {
        ro: "Pagina AGSV indică faptul că cererea se depune de asociația blocului sau de locatari — ar putea fi relevant cine semnează.",
        ru: "На странице AGSV указано, что заявление подаёт ассоциация дома или жильцы — это может быть важно для того, кто подписывает.",
      },
    });
    const temei = FACT_BY_ID.get("a-temei");
    if (temei && !full.includes("6 10 din 18 07 20"))
      suggestions.push({
        id: "s-temei",
        factId: "a-temei",
        basedOn: ["heading"],
        text: {
          ro: "Formularul citează decizia CMC nr. 6/10 „din 18.07” fără an. Dacă aveți nevoie de temeiul exact, cereți confirmare de la AGSV.",
          ru: "Форма ссылается на решение МСК № 6/10 «от 18.07» без года. Если нужно точное основание, уточните в AGSV.",
        },
      });
  } else {
    needsReview.push({
      reason: {
        ro: "Documentul nu corespunde niciunui formular din corpus. Putem afișa textul recunoscut, dar nu avem reguli publicate pentru sugestii.",
        ru: "Документ не соответствует ни одной форме из корпуса. Мы показываем распознанный текст, но опубликованных правил для подсказок нет.",
      },
    });
  }

  return { recognizedForm, observations, suggestions, needsReview };
}
