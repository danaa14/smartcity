import type { Topic } from "./types";

export const TOPICS: Topic[] = [
  {
    id: "water-contract",
    kind: "real",
    title: { ro: "Contract de apă și canalizare (apartament)", ru: "Договор на воду и канализацию (квартира)" },
    keywords: [
      "contract", "contractul", "incheia", "inchei", "apa", "canal", "canalizare", "apartament", "proprietar", "cumparat",
      "procurat", "imobil", "acte", "documente", "договор", "вода", "воду", "водоснабжен", "канализац", "квартир", "купил",
      "документ", "собственник", "apa-canal", "acc",
    ],
    steps: [
      { text: { ro: "Verificați termenul: dacă ați cumpărat locuința, aveți 15 zile de la înregistrarea proprietății.", ru: "Проверьте срок: если вы купили жильё, у вас 15 дней с регистрации собственности." }, factIds: ["w-15zile"] },
      { text: { ro: "Achitați datoriile existente pentru apă și canalizare.", ru: "Погасите существующие долги за воду и канализацию." }, factIds: ["w-datorii"] },
      { text: { ro: "Pregătiți copiile actelor: identitate, proprietate, declarația de coproprietar (dacă e cazul).", ru: "Подготовьте копии документов: удостоверение, право собственности, декларация совладельца (если нужно)." }, factIds: ["w-docs"] },
      { text: { ro: "Completați cererea tip și depuneți-o împreună cu copiile.", ru: "Заполните типовое заявление и подайте его вместе с копиями." }, factIds: ["w-cerere"] },
      { text: { ro: "Mergeți la Apă-Canal în programul de lucru sau sunați la centrul multifuncțional.", ru: "Обратитесь в Apă-Canal в часы работы или позвоните в многофункциональный центр." }, factIds: ["w-contact-program", "w-contact-centru"] },
    ],
    contactFactIds: ["w-contact-program", "w-contact-centru"],
    servicePage: {
      url: "https://www.acc.md/contraction/1-contractare-proprietari-apartamente",
      label: { ro: "Pagina oficială: Contractare cu proprietari de apartamente", ru: "Официальная страница: договор для владельцев квартир" },
      factId: "w-cerere",
    },
    gaps: {
      cost: { ro: "Corpusul nu spune dacă încheierea contractului are o taxă.", ru: "В корпусе не сказано, взимается ли плата за заключение договора." },
      time: { ro: "Corpusul nu indică în cât timp Apă-Canal încheie contractul după depunere.", ru: "В корпусе не указано, за какой срок Apă-Canal заключает договор после подачи." },
      channel: { ro: "Corpusul nu confirmă dacă cererea poate fi depusă integral online.", ru: "В корпусе не подтверждено, можно ли подать заявление полностью онлайн." },
    },
  },
  {
    id: "water-tariff",
    kind: "real",
    title: { ro: "Tariful la apă și plata facturii", ru: "Тариф на воду и оплата счёта" },
    keywords: [
      "tarif", "tariful", "potabila", "apa potabila", "metru cub", "pret", "costa", "cost", "lei", "m3", "metru cub", "factura", "plati", "platesc", "achit", "anre",
      "contor", "indici", "тариф", "питьев", "цена", "стоит", "стоимость", "лей", "кубометр", "счет", "оплат", "плат", "счетчик", "показан", "нарэ",
    ],
    steps: [
      { text: { ro: "Verificați tariful în vigoare: apă potabilă 14,03 lei/m³, canalizare 6,63 lei/m³ (casnic).", ru: "Проверьте действующий тариф: питьевая вода 14,03 лей/м³, канализация 6,63 лей/м³ (быт)." }, factIds: ["t-potabila", "t-canal", "t-vigoare"] },
      { text: { ro: "Transmiteți indicii contorului prin mesagerie, telefon sau e-mail.", ru: "Передайте показания счётчика через мессенджер, телефон или e-mail." }, factIds: ["t-indicii"] },
      { text: { ro: "Plătiți factura prin web-banking, poștă/bancă sau la casieria Apă-Canal.", ru: "Оплатите счёт через веб-банкинг, почту/банк или в кассе Apă-Canal." }, factIds: ["t-plata"] },
      { text: { ro: "Pentru întrebări despre factură, sunați la consultanța de facturare.", ru: "По вопросам счёта звоните в консультацию по счетам." }, factIds: ["t-contact-facturare"] },
    ],
    contactFactIds: ["t-contact-facturare"],
    servicePage: {
      url: "https://www.acc.md/tarif-serviciu-apa",
      label: { ro: "Pagina oficială: Tarifele Apă-Canal", ru: "Официальная страница: тарифы Apă-Canal" },
      factId: "t-potabila",
    },
    gaps: {
      documents: { ro: "Corpusul nu conține o listă de acte pentru această întrebare.", ru: "В корпусе нет списка документов для этого вопроса." },
      obligation: { ro: "Corpusul nu conține penalitățile pentru plata întârziată.", ru: "В корпусе нет сведений о штрафах за просрочку оплаты." },
    },
  },
  {
    id: "petition",
    kind: "real",
    title: { ro: "Petiție sau sesizare către Primărie", ru: "Петиция или обращение в Примэрию" },
    keywords: [
      "petitie", "petitia", "sesizare", "plangere", "reclamatie", "primarie", "primaria", "msign", "semnatura", "semna",
      "петиц", "жалоб", "обращен", "примэри", "мэри", "подпис", "msign",
    ],
    steps: [
      { text: { ro: "Deschideți formularul online de petiții al Primăriei.", ru: "Откройте онлайн-форму петиций Примэрии." }, factIds: ["p-online"] },
      { text: { ro: "Scrieți petiția doar ca text și salvați-o în PDF (max. 10 MB pentru MSIGN).", ru: "Напишите петицию только текстом и сохраните в PDF (не более 10 МБ для MSIGN)." }, factIds: ["p-pdf"] },
      { text: { ro: "Semnați PDF-ul electronic prin MSIGN — fără semnătură nu va fi examinată.", ru: "Подпишите PDF электронно через MSIGN — без подписи её не рассмотрят." }, factIds: ["p-msign"] },
      { text: { ro: "Încărcați petiția; alte materiale — ca atașamente.", ru: "Загрузите петицию; прочие материалы — как вложения." }, factIds: ["p-atasamente"] },
      { text: { ro: "Alegeți cum primiți răspunsul: e-mail sau poștă.", ru: "Выберите способ получения ответа: e-mail или почта." }, factIds: ["p-raspuns"] },
    ],
    contactFactIds: ["p-ghiseu", "p-adresa"],
    servicePage: {
      url: "https://www.chisinau.md/ro/petitions",
      label: { ro: "Pagina oficială: Transmite o petiție", ru: "Официальная страница: подать петицию" },
      factId: "p-online",
    },
    gaps: {
      time: { ro: "Corpusul nu conține termenul în care Primăria răspunde la petiție.", ru: "В корпусе нет срока, в который Примэрия отвечает на петицию." },
      cost: { ro: "Corpusul nu spune dacă depunerea petiției sau semnarea MSIGN costă ceva.", ru: "В корпусе не сказано, платны ли подача петиции или подпись MSIGN." },
    },
  },
  {
    id: "waste",
    kind: "real",
    title: { ro: "Contract pentru evacuarea deșeurilor", ru: "Договор на вывоз отходов" },
    keywords: [
      "deseuri", "gunoi", "salubritate", "autosalubritate", "evacuare", "colectare", "tomberon", "casa", "sector particular",
      "мусор", "отход", "вывоз", "автосалубритате", "частный дом", "дом",
    ],
    steps: [
      { text: { ro: "Serviciul este prestat de Regia „Autosalubritate”.", ru: "Услугу оказывает Régie «Autosalubritate»." }, factIds: ["d-exclusiv"] },
      { text: { ro: "Pregătiți actele: buletin, act de proprietate, acte despre persoanele cu viză de reședință.", ru: "Подготовьте документы: удостоверение, документ о собственности, сведения о прописанных." }, factIds: ["d-acte"] },
      { text: { ro: "Verificați tariful: 17,50 lei/persoană la bloc, 35,00 lei în sectorul particular.", ru: "Проверьте тариф: 17,50 лей/чел. в доме, 35,00 лей в частном секторе." }, factIds: ["d-tarif"] },
      { text: { ro: "Sunați la secția contracte și reclamații sau mergeți la sediu.", ru: "Позвоните в отдел договоров и жалоб или обратитесь в офис." }, factIds: ["d-contact", "d-adresa"] },
    ],
    contactFactIds: ["d-contact", "d-adresa"],
    servicePage: {
      url: "https://autosalubritate.md/servicii/servicii-persoane-fizice/",
      label: { ro: "Pagina oficială: Servicii persoane fizice", ru: "Официальная страница: услуги для физлиц" },
      factId: "d-acte",
    },
    gaps: {
      time: { ro: "Corpusul nu indică termenul de încheiere a contractului sau graficul de colectare.", ru: "В корпусе нет срока заключения договора или графика вывоза." },
      channel: { ro: "Corpusul nu confirmă un canal online de încheiere a contractului.", ru: "В корпусе не подтверждён онлайн-канал заключения договора." },
    },
  },
  {
    id: "trees",
    kind: "real",
    title: { ro: "Examinarea arborilor (curățare, defrișare)", ru: "Обследование деревьев (обрезка, вырубка)" },
    keywords: [
      "arbore", "arbori", "copac", "copaci", "defrisare", "taiere", "curatare", "fitosanitar", "spatii verzi", "agsv", "craca",
      "дерев", "вырубк", "обрезк", "спил", "зелен", "ветк",
    ],
    steps: [
      { text: { ro: "Cererea o depune asociația blocului sau locatarii blocului.", ru: "Заявление подаёт ассоциация дома или жильцы." }, factIds: ["a-cine"] },
      { text: { ro: "Descărcați formularul și strângeți acordul locatarilor (anexa formularului).", ru: "Скачайте форму и соберите согласие жильцов (приложение к форме)." }, factIds: ["a-acord"] },
      { text: { ro: "Depuneți cererea la AGSV; pentru întrebări, contactați anticamera.", ru: "Подайте заявление в AGSV; с вопросами обращайтесь в приёмную." }, factIds: ["a-contact"] },
    ],
    contactFactIds: ["a-contact"],
    servicePage: {
      url: "https://agsv.md/petitii-on-line-2/",
      label: { ro: "Pagina oficială AGSV: Model cerere", ru: "Официальная страница AGSV: образец заявления" },
      factId: "a-cine",
    },
    gaps: {
      time: { ro: "Corpusul nu conține termenul de examinare a cererii.", ru: "В корпусе нет срока рассмотрения заявления." },
      cost: { ro: "Corpusul nu spune dacă examinarea sau tăierea arborilor este cu plată.", ru: "В корпусе не сказано, платное ли обследование или вырубка." },
    },
  },
  {
    id: "demo-terrace",
    kind: "demo",
    title: { ro: "[DEMO] Terasă sezonieră — corpus fictiv", ru: "[DEMO] Сезонная терраса — вымышленный корпус" },
    keywords: ["terasa", "terase", "terasei", "sezoniera", "sezoniere", "терраса", "террасы", "террасу", "летн", "сезонн"],
    steps: [
      { text: { ro: "[DEMO] Pregătiți schița de amplasare.", ru: "[DEMO] Подготовьте схему размещения." }, factIds: ["demo-schita"] },
      { text: { ro: "[DEMO] Termenul de depunere nu poate fi stabilit: sursele se contrazic. Cereți confirmare oficială înainte de a planifica.", ru: "[DEMO] Срок подачи установить нельзя: источники противоречат друг другу. Запросите официальное подтверждение." }, factIds: ["demo-termen-30", "demo-termen-15"] },
    ],
    contactFactIds: ["p-ghiseu"],
    gaps: {
      cost: { ro: "[DEMO] Corpusul fictiv nu conține taxa pentru terasă.", ru: "[DEMO] В вымышленном корпусе нет платы за террасу." },
    },
  },
];

export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

/** Questions we know the corpus cannot answer; used as honest examples of the "missing" state. */
export const OUT_OF_CORPUS_HINTS: { keywords: string[]; contactFactIds: string[] }[] = [
  { keywords: ["gradinita", "gradinite", "садик", "детский сад", "e-gradinita"], contactFactIds: ["p-ghiseu"] },
  { keywords: ["parcare", "abonament parcare", "парковк"], contactFactIds: ["p-ghiseu"] },
];
