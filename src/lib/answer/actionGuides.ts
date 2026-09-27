import { answerQuestion } from "./pipeline";
import { validateClaims } from "./validate";
import { PASSAGE_BY_ID } from "../corpus/passages";
import { DOC_BY_ID } from "../corpus/docs";
import { normalize } from "../text";
import type { Answer, Claim, NextStep } from "./types";
import type { Lang, Passage, SourceDoc } from "../corpus/types";

/** A narrow, source-checked route for a common question about opening a café in Chișinău. */
export function actionGuide(question: string, lang: Lang): Answer | null {
  const q = normalize(question);
  const cafe = /(?:cafene|кафе|кофейн|coffee shop)/u.test(q);
  const opening = /(?:inscri|inregistr|deschid|deschide|autoriza|pornesc|откры|зарегистр|разрешен)/u.test(q);
  const otherCity = /(?:orhei|balti|cahul|ungheni|soroca|bucuresti|iasi|бельц)/u.test(q);
  if (!cafe || !opening || otherCity) return null;

  const definitions = [
    {
      id: "cafe-business",
      passageId: "guide-asp-business#service",
      quote: "Serviciul este destinat înregistrării de stat a organizațiilor comerciale în Registrul de stat al unităților de drept (RSUD), pentru inițierea activității legale.",
      text: { ro: "ASP oferă serviciul de înregistrare a afacerii.", ru: "Агентство государственных услуг предоставляет услугу регистрации бизнеса." },
      step: { ro: "Dacă nu ai încă firmă, înregistrează afacerea la Agenția Servicii Publice. Dacă firma există deja, treci la notificarea activității de comerț.", ru: "Если у вас еще нет компании, зарегистрируйте бизнес в Агентстве государственных услуг. Если компания уже есть, переходите к уведомлению о торговой деятельности." },
      action: { url: "https://www.asp.gov.md/ro/servicii/persoane-juridice/inregistrare-afacere/211-1", label: { ro: "Înregistrează afacerea la ASP", ru: "Регистрация бизнеса в АГУ" } },
    },
    {
      id: "cafe-notification",
      passageId: "guide-chisinau-trade#online",
      quote: "Notificările privind inițierea/modificarea/încetarea activității de comerț se depun: în regim on-line , accesând : https://actpermisiv.gov.md/#/ep/permit/23",
      text: { ro: "Direcția de comerț a municipiului Chișinău primește notificări de inițiere a activității de comerț, inclusiv online.", ru: "Управление торговли Кишинэу принимает уведомления о начале торговой деятельности, в том числе онлайн." },
      step: { ro: "Pentru adresa cafenelei din Chișinău, depune notificarea de inițiere a activității de comerț online. Alternativ, pagina Direcției indică ghișeul din șos. Hâncești 53A, cu programare prealabilă.", ru: "Для адреса кафе в Кишинэу подайте уведомление о начале торговой деятельности онлайн. На странице управления также указан прием по адресу шос. Хынчешть 53A по предварительной записи." },
      action: { url: "https://actpermisiv.gov.md/#/ep/permit/23", label: { ro: "Depune notificarea online", ru: "Подать уведомление онлайн" } },
    },
    {
      id: "cafe-food-safety",
      passageId: "guide-ansa-food#apply",
      quote: "Pasul 1. Depunerea cererii Solicitantul depune cererea prin următoarele modalități: 1) apăsarea butonului Solicită și accesarea https://actpermisiv.gov.md/#/ep/permit/124",
      text: { ro: "Procedura ANSA indică formularul online pentru certificatul de înregistrare în domeniul siguranței alimentelor.", ru: "Процедура НАБПП указывает онлайн-форму для свидетельства о регистрации в области безопасности пищевых продуктов." },
      step: { ro: "Pentru partea de alimentație publică, verifică cerințele aplicabile localului și solicită certificatul de înregistrare în domeniul siguranței alimentelor prin formularul indicat de ANSA.", ru: "Для общественного питания проверьте требования к помещению и запросите свидетельство о регистрации в области безопасности пищевых продуктов через форму, указанную НАБПП." },
      action: { url: "https://actpermisiv.gov.md/#/ep/permit/124", label: { ro: "Solicită certificatul ANSA", ru: "Запросить свидетельство НАБПП" } },
    },
  ] as const;

  const claims: Claim[] = definitions.map((item) => ({
    id: item.id,
    text: item.text,
    citations: [{ n: 0, passageId: item.passageId, quote: item.quote }],
    aspect: ["procedure"],
    demo: false,
  }));
  const { valid, report } = validateClaims(claims);
  if (valid.length !== definitions.length) return null;
  const passages: Record<string, Passage> = {};
  const docs: Record<string, SourceDoc> = {};
  const steps: NextStep[] = definitions.map((item, index) => {
    const p = PASSAGE_BY_ID.get(item.passageId)!;
    const doc = DOC_BY_ID.get(p.docId)!;
    passages[p.id] = p;
    docs[doc.id] = doc;
    valid[index].citations[0].n = index + 1;
    return { text: item.step, claimIds: [item.id], action: item.action };
  });
  const base = answerQuestion(question, lang, { includeDemo: false, forceMissing: true });
  return {
    ...base,
    status: "partial",
    topicId: "cafe-opening",
    topicTitle: { ro: "Deschiderea unei cafenele în Chișinău", ru: "Открытие кафе в Кишинэу" },
    summary: { ro: "Unde mergi și ce faci pentru o cafenea: trei puncte de pornire verificate, fiecare cu formularul sau serviciul oficial.", ru: "Куда обратиться и что сделать для кафе: три проверенных отправных шага, каждый с официальной формой или услугой." },
    claims: [],
    claimIndex: Object.fromEntries(valid.map((claim) => [claim.id, claim])),
    sources: definitions.map((item, index) => ({ n: index + 1, passageId: item.passageId })),
    steps,
    missing: [{ ro: "Lista completă a actelor și eventualele cerințe pentru spațiul concret nu au fost verificate aici; confirmă-le în formularele oficiale înainte de depunere.", ru: "Полный перечень документов и требования к конкретному помещению здесь не проверены; уточните их в официальных формах перед подачей." }],
    contacts: [],
    passages,
    docs,
    validation: report,
    engine: { ...base.engine, label: { ro: "Pași selectați din pagini oficiale, cu citat verificat și link direct la acțiune.", ru: "Шаги выбраны из официальных страниц, с проверенной цитатой и прямой ссылкой для действия." } },
  };
}
