import type { Fact } from "./types";

/**
 * Atomic claims. Each claim is only a restatement of its cited quotes; `quote` must be a
 * substring of the cited passage (checked at build by verify-corpus and at runtime by the validator).
 */
export const FACTS: Fact[] = [
  // ---------------- Water contract (real: Apă-Canal) ----------------
  {
    id: "w-cerere",
    topic: "water-contract",
    aspects: ["procedure"],
    core: true,
    text: {
      ro: "Pentru contract completați o cerere tip (la sediul Apă-Canal sau pe site) și anexați copiile actelor din lista „Documente”.",
      ru: "Для договора заполните типовое заявление (в офисе Apă-Canal или на сайте) и приложите копии документов из списка «Documente».",
    },
    cites: [{ passageId: "acc-contract-apart#p-cerere", quote: "consumatorul completează o cerere tip (disponibilă la sediul Operatorului sau pe site) cu anexarea copiilor de pe actele menționate în blocul „Documente”" }],
  },
  {
    id: "w-docs",
    topic: "water-contract",
    aspects: ["documents"],
    core: true,
    text: {
      ro: "Pentru un apartament, lista include: cererea, copia actului de identitate al proprietarului, copia actului de proprietate (sau alt drept real) și declarația de coproprietar, dacă există coproprietar.",
      ru: "Для квартиры в список входят: заявление, копия удостоверения личности владельца, копия документа о собственности (или ином вещном праве) и декларация совладельца, если он есть.",
    },
    cites: [{ passageId: "acc-contract-apart#p-docs", quote: "Copia xerox după actul de identitate a proprietarului Copia xerox după actul ce confirmă dreptul de proprietate şi/sau documentul care confirmă alt drept real asupra imobilului Declarația de coproprietar, în cazul existenței coproprietarului" }],
  },
  {
    id: "w-contor-optional",
    topic: "water-contract",
    aspects: ["documents"],
    text: {
      ro: "Copia buletinului de verificare metrologică a contorului este marcată pe pagină ca opțională.",
      ru: "Копия свидетельства о метрологической поверке счётчика отмечена на странице как необязательная.",
    },
    cites: [{ passageId: "acc-contract-apart#p-docs", quote: "Copia xerox după buletinul de verificare metrologică de stat a contorului de apă (opțional)" }],
  },
  {
    id: "w-factura",
    topic: "water-contract",
    aspects: ["documents"],
    text: {
      ro: "Lista mai menționează ultima factură achitată (sau confirmarea gestionarului blocului despre datorii) și acordul proprietarului privind sigilarea contorului.",
      ru: "В списке также указаны последний оплаченный счёт (или подтверждение управляющего домом о долгах) и согласие владельца на опломбирование счётчика.",
    },
    cites: [{ passageId: "acc-contract-apart#p-factura", quote: "Ultima factură de plată pentru serviciul public de alimentare cu apă și de canalizare, achitată, sau confirmare de la gestionarul blocului locativ despre existența datoriilor" }],
    uncertainty: {
      ro: "Pagina listează aceste acte în același bloc cu formulare și modele; nu precizează explicit dacă sunt obligatorii pentru fiecare caz.",
      ru: "Страница перечисляет эти документы в одном блоке с формами и образцами; не уточняется, обязательны ли они в каждом случае.",
    },
  },
  {
    id: "w-datorii",
    topic: "water-contract",
    aspects: ["obligation", "procedure"],
    core: true,
    text: {
      ro: "Pentru încheierea contractului direct trebuie achitate toate datoriile la zi pentru apă și canalizare.",
      ru: "Для заключения прямого договора нужно погасить все текущие долги за воду и канализацию.",
    },
    cites: [{ passageId: "acc-contract-apart#p-datorii", quote: "pentru încheierea contractului direct este necesară achitarea tuturor datoriilor la zi" }],
  },
  {
    id: "w-15zile",
    topic: "water-contract",
    aspects: ["time", "obligation"],
    core: true,
    text: {
      ro: "Dacă ați dobândit în proprietate un imobil care nu a fost deconectat, trebuie să cereți contractul în 15 zile de la înregistrarea dreptului de proprietate.",
      ru: "Если вы получили в собственность неотключённое жильё, нужно обратиться за договором в течение 15 дней с даты регистрации права собственности.",
    },
    cites: [{ passageId: "acc-contraction#p-15zile", quote: "în termen de 15 zile de la data înregistrării dreptului de proprietate" }],
  },
  {
    id: "w-deconectare",
    topic: "water-contract",
    aspects: ["obligation"],
    text: {
      ro: "Dacă termenul nu este respectat, operatorul are dreptul să deconecteze locul de consum.",
      ru: "При несоблюдении срока оператор вправе отключить место потребления.",
    },
    cites: [{ passageId: "acc-contraction#p-deconect", quote: "Operatorul este în drept să deconecteze locul de consum" }],
  },
  {
    id: "w-chirias",
    topic: "water-contract",
    aspects: ["procedure"],
    keywords: ["chirias", "chirie", "arenda", "locatar", "аренд", "арендатор", "съемщик", "квартирант"],
    text: {
      ro: "Contractul poate fi încheiat și de cineva care nu este proprietar, cu condiția unei plăți preventive egale cu consumul mediu din ultimele trei perioade de facturare.",
      ru: "Договор может заключить и не владелец — при условии предоплаты, равной среднему потреблению за три последних расчётных периода.",
    },
    cites: [{ passageId: "acc-contract-apart#p-altdrept", quote: "cu condiția de plată preventivă (echivalentul unui consum mediu calculat pe ultimele trei perioade de facturare)" }],
  },
  {
    id: "w-baza-legala",
    topic: "water-contract",
    aspects: ["validity"],
    text: {
      ro: "Pagina indică drept bază Legea nr. 303/2013 și Regulamentul aprobat prin decizia CMC 14/11 din 11.08.2020.",
      ru: "Страница ссылается на Закон № 303/2013 и Регламент, утверждённый решением МСК 14/11 от 11.08.2020.",
    },
    cites: [{ passageId: "acc-contraction#p-baza", quote: "Legea nr. 303/2013 privind serviciul public de alimentare cu apă şi de canalizare, Regulamentul de organizare şi funcționare a serviciului public de alimentare cu apă şi de canalizare din mun. Chișinău, aprobat prin decizia CMC 14/11 din 11.08.2020" }],
  },
  {
    id: "w-contact-program",
    topic: "water-contract",
    aspects: ["contact"],
    text: {
      ro: "Sediul Apă-Canal: str. Albişoara 38; program luni–joi 08:00–17:00, vineri 08:00–15:45.",
      ru: "Офис Apă-Canal: ул. Албишоара 38; пн–чт 08:00–17:00, пт 08:00–15:45.",
    },
    cites: [{ passageId: "acc-contacts#p-program", quote: "Strada Albişoara 38, Chișinău, MD-2005 Program de lucru: Luni – Joi : 08:00 – 17:00 Vineri : 08:00 – 15:45" }],
  },
  {
    id: "w-contact-centru",
    topic: "water-contract",
    aspects: ["contact"],
    text: {
      ro: "Centrul multifuncțional Apă-Canal: 0 (22) 256-828.",
      ru: "Многофункциональный центр Apă-Canal: 0 (22) 256-828.",
    },
    cites: [{ passageId: "acc-contacts#p-multifunctional", quote: "Centru multifuncţional: 0 (22) 256 – 828" }],
  },
  // ---------------- Water tariffs & billing (real) ----------------
  {
    id: "t-potabila",
    topic: "water-tariff",
    aspects: ["cost"],
    core: true,
    text: {
      ro: "Tariful pentru apă potabilă (Apă-Canal Chișinău) este 14,03 lei/m³, conform Hotărârii ANRE nr. 479.",
      ru: "Тариф на питьевую воду (Apă-Canal Chișinău) — 14,03 лей/м³, согласно постановлению НАРЭ № 479.",
    },
    cites: [{ passageId: "acc-tarif#p-potabila", quote: "în mărime de 14,03 lei/m 3" }],
  },
  {
    id: "t-canal",
    topic: "water-tariff",
    aspects: ["cost"],
    core: true,
    text: {
      ro: "Canalizarea și epurarea costă 6,63 lei/m³ pentru consumatorii casnici și 10,16 lei/m³ pentru cei noncasnici.",
      ru: "Канализация и очистка — 6,63 лей/м³ для бытовых и 10,16 лей/м³ для небытовых потребителей.",
    },
    cites: [{ passageId: "acc-tarif#p-canal", quote: "pentru consumatorii casnici, în mărime de 6,63 lei/m 3 ; - pentru consumatorii noncasnici, în mărime de 10,16 lei/m 3" }],
  },
  {
    id: "t-vigoare",
    topic: "water-tariff",
    aspects: ["validity", "time"],
    core: true,
    text: {
      ro: "Pagina declară că aceste tarife sunt în vigoare din 06.08.2026.",
      ru: "Страница заявляет, что тарифы действуют с 06.08.2026.",
    },
    cites: [{ passageId: "acc-tarif#p-vigoare", quote: "în vigoare cu începere din 06.08.2026" }],
  },
  {
    id: "t-abrog",
    topic: "water-tariff",
    aspects: ["validity"],
    core: true,
    text: {
      ro: "Hotărârea nr. 479 abrogă hotărârea anterioară ANRE nr. 120 din 18.03.2025 (tariful anterior la apă potabilă era 12,99 lei/m³).",
      ru: "Постановление № 479 отменяет предыдущее постановление НАРЭ № 120 от 18.03.2025 (прежний тариф на питьевую воду — 12,99 лей/м³).",
    },
    cites: [
      { passageId: "acc-tarif#p-abrog", quote: "Se abrogă Hotărârea Consiliului de administrație al ANRE nr. 120 din 18.03.2025" },
      { passageId: "acc-tarif#p-hist-2025", quote: "21.03.25 12,99" },
    ],
  },
  {
    id: "t-tva",
    topic: "water-tariff",
    aspects: ["cost"],
    text: {
      ro: "În tabelul de istoric tarifele sunt indicate fără TVA.",
      ru: "В таблице истории тарифы указаны без НДС.",
    },
    cites: [{ passageId: "acc-tarif#p-fara-tva", quote: "fără TVA, lei/m3" }],
    uncertainty: {
      ro: "Pagina nu indică suma finală cu TVA pe care o vedeți în factură.",
      ru: "На странице не указана итоговая сумма с НДС, которую вы видите в счёте.",
    },
  },
  {
    id: "t-contest",
    topic: "water-tariff",
    aspects: ["procedure", "time"],
    text: {
      ro: "Hotărârea poate fi contestată la ANRE în 30 de zile de la publicarea în Monitorul Oficial.",
      ru: "Постановление можно обжаловать в НАРЭ в течение 30 дней с публикации в Monitorul Oficial.",
    },
    cites: [{ passageId: "acc-tarif#p-contest", quote: "poate fi contestată la autoritatea emitentă, în termen de 30 de zile de la data publicării în Monitorul Oficial" }],
  },
  {
    id: "t-plata",
    topic: "water-tariff",
    aspects: ["procedure", "channel"],
    keywords: ["plati", "platesc", "achit", "factura", "оплат", "плат", "счет"],
    text: {
      ro: "Factura se poate plăti prin web-banking, la oficiile Poșta Moldovei și sucursalele băncilor sau la casieria Apă-Canal din str. Albișoara 38.",
      ru: "Счёт можно оплатить через веб-банкинг, в отделениях Poșta Moldovei и банков или в кассе Apă-Canal на ул. Албишоара 38.",
    },
    cites: [
      { passageId: "acc-consumer#p-plata", quote: "1. Web-banking," },
      { passageId: "acc-consumer#p-plata-casierie", quote: "3.Oficiile „Poşta Moldovei” şi la sucursalele Băncilor comerciale. 4. Casieria S.A. „Apă-Canal Chişinău” din str. Albişoara, 38" },
    ],
  },
  {
    id: "t-indicii",
    topic: "water-tariff",
    aspects: ["procedure", "channel"],
    keywords: ["indici", "indicatii", "contor", "показан", "счетчик"],
    text: {
      ro: "Indicii contorului pot fi transmiși prin Viber, WhatsApp, Telegram sau apel la numerele din factură, ori pe e-mail la drc@acc.md.",
      ru: "Показания счётчика можно передать через Viber, WhatsApp, Telegram или звонком по номерам из счёта, либо на drc@acc.md.",
    },
    cites: [{ passageId: "acc-consumer#p-indicii", quote: "prin intermediul aplicațiilor Viber, WhatsApp, Telegram; - prin apel telefonic; - prin intermediul unui e-mail transmis pe adresa drc@acc.md" }],
  },
  {
    id: "t-contact-facturare",
    topic: "water-tariff",
    aspects: ["contact"],
    text: {
      ro: "Consultanță facturare și achitări Apă-Canal: 0 (22) 256-955 sau 0 (22) 857-555.",
      ru: "Консультации по счетам и оплате Apă-Canal: 0 (22) 256-955 или 0 (22) 857-555.",
    },
    cites: [{ passageId: "acc-contacts#p-facturare", quote: "Consultanță facturare și achitări: 0 (22) 256 - 955; 0 (22) 857 - 555" }],
  },
  // ---------------- Petition to City Hall (real) ----------------
  {
    id: "p-online",
    topic: "petition",
    aspects: ["procedure", "channel"],
    core: true,
    text: {
      ro: "Primăria are un formular online pentru transmiterea unei petiții sau sesizări.",
      ru: "У Примэрии есть онлайн-форма для подачи петиции или обращения.",
    },
    cites: [
      { passageId: "pmc-petitions#p-intro", quote: "transmitere către primărie a unei petiții sau sesizări, utilizând formularul online disponibil de mai jos" },
      { passageId: "pmc-petitions-ru#p-intro", quote: "подачи петиции или жалобы в мэрию с помощью онлайн-формы" },
    ],
  },
  {
    id: "p-msign",
    topic: "petition",
    aspects: ["procedure", "obligation"],
    core: true,
    text: {
      ro: "Petiția trebuie semnată electronic prin MSIGN; altfel, conform paginii, nu va fi examinată.",
      ru: "Петицию нужно подписать электронно через MSIGN; иначе, согласно странице, её не рассмотрят.",
    },
    cites: [
      { passageId: "pmc-petitions#p-msign", quote: "Petiția sau sesizarea nesemnată ELECTRONIC prin serviciul MSIGN nu va fi examinată" },
      { passageId: "pmc-petitions-ru#p-msign", quote: "не подписанные ЭЛЕКТРОННО через сервис MSIGN, рассматриваться не будут" },
    ],
  },
  {
    id: "p-pdf",
    topic: "petition",
    aspects: ["documents", "procedure"],
    core: true,
    text: {
      ro: "Formularul se salvează ca PDF, conține doar text, iar MSIGN semnează fișiere PDF de cel mult 10 MB.",
      ru: "Форма сохраняется в PDF, содержит только текст, а MSIGN подписывает PDF-файлы не более 10 МБ.",
    },
    cites: [
      { passageId: "pmc-petitions#p-pdf", quote: "Acest formular trebuie salvat în PDF și semnat folosind serviciu MSIGN În acest formular includeți doar informații textuale. Serviciu MSIGN permite semnarea fișierilor PDF nu mai mari de 10 MB." },
      { passageId: "pmc-petitions-ru#p-pdf", quote: "PDF-файлы размером не более 10 МБ" },
    ],
  },
  {
    id: "p-atasamente",
    topic: "petition",
    aspects: ["documents"],
    text: {
      ro: "Alte materiale se anexează ca atașamente (arhive); petiția se încarcă în format .docx, .pdf sau .jpg.",
      ru: "Прочие материалы прикладываются как вложения (архивы); сама петиция загружается в формате .docx, .pdf или .jpg.",
    },
    cites: [{ passageId: "pmc-petitions#p-atasamente", quote: "Alte materiale le puteți anexa la atașamente în arhive. Petiție ca fișier * : (.docx, .pdf, .jpg)" }],
  },
  {
    id: "p-raspuns",
    topic: "petition",
    aspects: ["channel"],
    text: {
      ro: "Puteți alege să primiți răspunsul prin e-mail sau pe hârtie, prin poștă.",
      ru: "Можно выбрать получение ответа по e-mail или на бумаге по почте.",
    },
    cites: [{ passageId: "pmc-petitions#p-raspuns", quote: "pe suport electronic, prin e-mail pe suport de hârtie, prin poştă" }],
  },
  {
    id: "p-ghiseu",
    topic: "petition",
    aspects: ["contact"],
    text: {
      ro: "Ghișeul Unic al Primăriei: +373 22 20 15 05 / 20 16 97 / 20 15 13, primaria@pmc.md, L–V 09:00–16:00.",
      ru: "Единое окно Примэрии: +373 22 20 15 05 / 20 16 97 / 20 15 13, primaria@pmc.md, пн–пт 09:00–16:00.",
    },
    cites: [{ passageId: "pmc-home#p-ghiseu", quote: "GHIȘEUL UNIC Tel.: +373 22 20 15 05 / 20 16 97 / 20 15 13 Email: primaria@pmc.md Program de lucru: L-V 09:00-16:00" }],
  },
  {
    id: "p-adresa",
    topic: "petition",
    aspects: ["contact"],
    text: {
      ro: "Adresa Primăriei: bd. Ștefan cel Mare și Sfânt 83, MD-2012.",
      ru: "Адрес Примэрии: бул. Штефан чел Маре ши Сфынт 83, MD-2012.",
    },
    cites: [{ passageId: "pmc-home#p-adresa", quote: "MD-2012 mun. Chişinău, Bulevardul Ştefan cel Mare şi Sfânt, 83" }],
  },
  // ---------------- Waste collection contract (real) ----------------
  {
    id: "d-exclusiv",
    topic: "waste",
    aspects: ["procedure"],
    core: true,
    text: {
      ro: "Colectarea și transportarea deșeurilor în municipiul Chișinău este prestată de Regia „Autosalubritate”, care declară că are drept exclusiv.",
      ru: "Сбор и вывоз отходов в муниципии Кишинэу осуществляет Régie «Autosalubritate», заявляющая об исключительном праве.",
    },
    cites: [{ passageId: "autosal-pf#p-exclusiv", quote: "are dreptul exclusiv de a presta servicii de colectare şi transportare a deșeurilor pe teritoriul municipiului Chișinău" }],
  },
  {
    id: "d-tarif",
    topic: "waste",
    aspects: ["cost"],
    core: true,
    text: {
      ro: "Tariful lunar pentru o persoană fizică: 17,50 lei la bloc și 35,00 lei în sectorul particular.",
      ru: "Месячный тариф для физлица: 17,50 лей в многоквартирном доме и 35,00 лей в частном секторе.",
    },
    cites: [{ passageId: "autosal-pf#p-tarif", quote: "la bloc – 17,50 lei; sector particular – 35,00 lei" }],
    uncertainty: {
      ro: "Pagina nu indică de când se aplică tariful sau actul prin care a fost aprobat.",
      ru: "На странице не указано, с какой даты действует тариф и каким актом он утверждён.",
    },
  },
  {
    id: "d-acte",
    topic: "waste",
    aspects: ["documents"],
    core: true,
    text: {
      ro: "Pentru o casă în sectorul particular dată în exploatare: copia buletinului, extrasul din Registrul bunurilor imobile sau contractul de vânzare-cumpărare, actele despre persoanele cu viză de reședință și certificatul despre componența familiei.",
      ru: "Для дома в частном секторе, введённого в эксплуатацию: копия удостоверения личности, выписка из Реестра недвижимости или договор купли-продажи, документы о прописанных лицах и справка о составе семьи.",
    },
    cites: [{ passageId: "autosal-pf#p-acte", quote: "Buletinul de identitate ( copia); Extrasul din Registrul bunurilor imobile sau Contractul de vânzare – cumpărare a bunului imobil; Actele ce atestă numărul de persoane care au viza de reședință în imobilul respectiv și certificatul despre componența familiei (copia)" }],
  },
  {
    id: "d-contact",
    topic: "waste",
    aspects: ["contact"],
    text: {
      ro: "Autosalubritate — contracte și reclamații: (022) 74-06-72; dispecerat: (022) 74-75-20.",
      ru: "Autosalubritate — договоры и жалобы: (022) 74-06-72; диспетчерская: (022) 74-75-20.",
    },
    cites: [{ passageId: "autosal-contact#p-telefoane", quote: "Dispecerat: (022) 74-75-20 Contabilitate: (022) 74-06-50 Contracte și reclamații: (022) 74-06-72" }],
  },
  {
    id: "d-adresa",
    topic: "waste",
    aspects: ["contact"],
    text: {
      ro: "Sediul Autosalubritate: str. 27 Martie 1918, nr. 14.",
      ru: "Офис Autosalubritate: ул. 27 Марта 1918, д. 14.",
    },
    cites: [{ passageId: "autosal-contact#p-adresa", quote: "Adresa: str. 27 martie 1918, nr. 14" }],
  },
  // ---------------- Tree inspection (real: AGSV) ----------------
  {
    id: "a-cine",
    topic: "trees",
    aspects: ["procedure", "obligation"],
    core: true,
    text: {
      ro: "Cererea pentru examinarea stării fitosanitare a arborilor (curățare, defrișare) se depune de asociația blocului sau de locatarii blocului.",
      ru: "Заявление на обследование фитосанитарного состояния деревьев (обрезка, вырубка) подаёт ассоциация дома или жильцы дома.",
    },
    cites: [{ passageId: "agsv-petitii#p-cine", quote: "se depune de către Asociația blocului locativ sau de locatarii blocului" }],
  },
  {
    id: "a-acord",
    topic: "trees",
    aspects: ["documents", "obligation"],
    core: true,
    text: {
      ro: "La cerere se anexează acordul locatarilor; fără el, conform paginii, cererea nu va fi acceptată.",
      ru: "К заявлению прилагается согласие жильцов; без него, согласно странице, заявление не примут.",
    },
    cites: [
      { passageId: "agsv-petitii#p-cine", quote: "în ambele cazuri se anexează acordul locatarilor, conform formularelor de mai jos. În caz contrar cererea nu va fi acceptată." },
      { passageId: "agsv-form#p-anexe", quote: "Anexe: Acordul locatarilor" },
    ],
  },
  {
    id: "a-temei",
    topic: "trees",
    aspects: ["validity"],
    text: {
      ro: "Formularul invocă pct. 32–33 din Regulamentul privind spațiile verzi, aprobat prin decizia CMC nr. 6/10 „din 18.07” (anul nu apare în formular).",
      ru: "Форма ссылается на пп. 32–33 Регламента о зелёных насаждениях, утверждённого решением МСК № 6/10 «от 18.07» (год в форме не указан).",
    },
    cites: [{ passageId: "agsv-form#p-temei", quote: "pct. 32, pct. 33 a Regulamentului privind delimitarea, gestionarea și protejarea spațiilor verzi din municipiul Chișinău, aprobat prin decizia Consiliului municipal Chișinău nr. 6/10 din 18.07" }],
    uncertainty: {
      ro: "Textul regulamentului nu face parte din corpus; nu am verificat conținutul pct. 32–33.",
      ru: "Текст регламента не входит в корпус; содержание пп. 32–33 не проверялось.",
    },
  },
  {
    id: "a-contact",
    topic: "trees",
    aspects: ["contact"],
    text: {
      ro: "AGSV — anticamera: 022 24 27 25 / 067 880 701, anticamera@agsv.md; str. Alexandr Pușkin 62.",
      ru: "AGSV — приёмная: 022 24 27 25 / 067 880 701, anticamera@agsv.md; ул. Александр Пушкин 62.",
    },
    cites: [
      { passageId: "agsv-contacte#p-anticamera", quote: "Anticamera : 022 24 27 25 / 067 880 701 / anticamera@agsv.md" },
      { passageId: "agsv-contacte#p-adresa", quote: "str. Alexandr Pușkin, 62" },
    ],
  },
  // ---------------- DEMO: seasonal terrace (fictional, contradictory) ----------------
  {
    id: "demo-termen-30",
    topic: "demo-terrace",
    aspects: ["time"],
    core: true,
    conflictGroup: "terrace-deadline",
    conflictValue: "30 zile calendaristice",
    text: {
      ro: "[DEMO] Regulamentul fictiv cere depunerea cu cel puțin 30 de zile calendaristice înainte de deschidere.",
      ru: "[DEMO] Вымышленный регламент требует подачи не менее чем за 30 календарных дней до открытия.",
    },
    cites: [{ passageId: "demo-terasa-regulament#p-termen", quote: "cu cel puțin 30 de zile calendaristice înainte de data solicitată pentru deschidere" }],
  },
  {
    id: "demo-termen-15",
    topic: "demo-terrace",
    aspects: ["time"],
    core: true,
    conflictGroup: "terrace-deadline",
    conflictValue: "15 zile lucrătoare",
    text: {
      ro: "[DEMO] Pagina fictivă de ghișeu indică cel puțin 15 zile lucrătoare înainte de deschidere.",
      ru: "[DEMO] Вымышленная страница окна обслуживания указывает не менее 15 рабочих дней до открытия.",
    },
    cites: [{ passageId: "demo-terasa-ghiseu#p-termen", quote: "cu cel puțin 15 zile lucrătoare înainte de deschidere" }],
  },
  {
    id: "demo-schita",
    topic: "demo-terrace",
    aspects: ["documents"],
    core: true,
    text: {
      ro: "[DEMO] Regulamentul fictiv cere anexarea schiței de amplasare.",
      ru: "[DEMO] Вымышленный регламент требует приложить схему размещения.",
    },
    cites: [{ passageId: "demo-terasa-regulament#p-schita", quote: "La cerere se anexează schița de amplasare a terasei." }],
  },
];

export const FACT_BY_ID = new Map(FACTS.map((f) => [f.id, f]));
