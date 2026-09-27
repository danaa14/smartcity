import { DOC_BY_ID } from "../corpus/docs";
import { PASSAGE_BY_ID } from "../corpus/passages";
import { isCitizenAnswerSource } from "../corpus/sources";
import { normalize } from "../text";
import type { Answer, NextStep } from "./types";

/** Give every substantive civic answer a concrete, official next action. */
export function withActionPlan(answer: Answer): Answer {
  if (answer.kind === "prose" && !answer.unverified) return answer;
  if (answer.steps.length) return {
    ...answer,
    steps: answer.steps.map((step) => {
      if (step.action) return step;
      for (const id of step.claimIds) {
        const citation = answer.claimIndex[id]?.citations[0];
        const passage = citation && PASSAGE_BY_ID.get(citation.passageId);
        const doc = passage && DOC_BY_ID.get(passage.docId);
        if (doc?.url && isCitizenAnswerSource(doc)) return {
          ...step,
          action: {
            url: doc.url,
            label: { ro: `Vezi acest pas la ${doc.publisher}`, ru: `Смотреть этот шаг у ${doc.publisher}` },
          },
        };
      }
      return step;
    }),
  };

  const seen = new Set<string>();
  const verified: NextStep[] = answer.claims.flatMap((claim) => {
    const citation = claim.citations.find((item) => {
      const passage = PASSAGE_BY_ID.get(item.passageId);
      const doc = passage && DOC_BY_ID.get(passage.docId);
      return doc && isCitizenAnswerSource(doc) && doc.url;
    });
    const passage = citation && PASSAGE_BY_ID.get(citation.passageId);
    const doc = passage && DOC_BY_ID.get(passage.docId);
    if (!doc?.url || seen.has(doc.url)) return [];
    seen.add(doc.url);
    return [{
      text: {
        ro: `Verifică informația din răspuns la ${doc.publisher} și urmează instrucțiunile afișate pentru cazul tău.`,
        ru: `Проверьте информацию из ответа у ${doc.publisher} и следуйте инструкциям для вашего случая.`,
      },
      claimIds: [claim.id],
      action: {
        url: doc.url,
        label: { ro: `Deschide pagina ${doc.publisher}`, ru: `Открыть страницу ${doc.publisher}` },
      },
    }];
  }).slice(0, 3);
  if (verified.length) return { ...answer, steps: verified };

  // A question without confirmed evidence still gets a usable route to the authority.
  // These are verification actions, never invented steps of the requested procedure.
  const q = normalize(answer.question);
  const legal = /(?:lege|cod|articol|amenda|contraventie|drept|uzucapiun|succesi|mostenir|закон|кодекс|штраф)/u.test(q);
  const institution = legal
    ? { name: { ro: "portalul legislației Republicii Moldova", ru: "портал законодательства Республики Молдова" }, url: "https://www.legis.md/" }
    : { name: { ro: "Primăria municipiului Chișinău", ru: "Примэрия муниципия Кишинэу" }, url: "https://chisinau.md/" };
  const steps: NextStep[] = [
    {
      text: {
        ro: `Caută serviciul sau regula pe pagina oficială a ${institution.name.ro}. Verifică acolo pașii și actele aplicabile situației tale.`,
        ru: `Найдите услугу или правило на официальной странице: ${institution.name.ru}. Уточните там шаги и документы для вашей ситуации.`,
      },
      claimIds: [],
      action: { url: institution.url, label: { ro: "Deschide pagina oficială", ru: "Открыть официальную страницу" } },
    },
  ];
  if (!legal) steps.push({
    text: {
      ro: "Dacă pagina nu lămurește cazul, trimite întrebarea către Primărie prin formularul oficial de petiții. Descrie problema și adresa relevantă, fără date sensibile în chat.",
      ru: "Если страница не проясняет ваш случай, отправьте вопрос в Примэрию через официальную форму обращений. Опишите проблему и нужный адрес, не отправляя личные данные в чат.",
    },
    claimIds: [],
    action: { url: "https://www.chisinau.md/ro/petitions", label: { ro: "Trimite o petiție online", ru: "Подать обращение онлайн" } },
  });
  return { ...answer, steps };
}
