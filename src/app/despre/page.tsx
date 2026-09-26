import type { Metadata } from "next";
import Link from "next/link";
import { getLang } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { INVENTORY_STATS } from "@/lib/corpus/inventory";
import { DOCS } from "@/lib/corpus/docs";
import { PASSAGES } from "@/lib/corpus/passages";
import { FACTS } from "@/lib/corpus/facts";
import { BudgetCalculator } from "@/components/about/BudgetCalculator";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Despre, acoperire și buget" };

export default async function AboutPage() {
  const lang = await getLang();
  const t = (x: { ro: string; ru: string }) => tr(x, lang);
  const real = DOCS.filter((d) => d.kind === "real");

  const works = [
    { ro: "Răspunsuri RO/RU din corpus, cu citare exactă pentru fiecare afirmație, validată automat.", ru: "Ответы RO/RU по корпусу с точной цитатой для каждого утверждения, проверяемой автоматически." },
    { ro: "Patru stări: susținut, parțial, lipsă, posibilă contradicție (ultima doar pe documente DEMO).", ru: "Четыре состояния: подтверждено, частично, нет в корпусе, возможное противоречие (последнее — только на DEMO)." },
    { ro: "OCR local real (Tesseract ron+rus) pe imagini și PDF, cu observații și sugestii citate.", ru: "Реальный локальный OCR (Tesseract ron+rus) для изображений и PDF, с наблюдениями и подсказками с цитатами." },
    { ro: "Sesizări cu foto/video/voce, tichete DEMO locale, ștergere.", ru: "Обращения с фото/видео/голосом, локальные DEMO-заявки, удаление." },
    { ro: "Evaluări și semnalări de citări, vizibile în pagina pentru angajați.", ru: "Оценки и сообщения о цитатах, видимые на странице для сотрудников." },
  ];
  const simulated = [
    { ro: "Motorul de răspuns este determinist (fără model AI): selectează afirmații pre-extrase și verificate manual.", ru: "Движок ответов детерминированный (без ИИ): выбирает заранее извлечённые и вручную проверенные утверждения." },
    { ro: "Traducerile pasajelor sunt neoficiale și au fost scrise pentru prototip.", ru: "Переводы фрагментов неофициальные и написаны для прототипа." },
    { ro: "Telefonul: replicile apelantului sunt scrise dinainte; nu există număr, ASR, transfer sau SMS.", ru: "Телефон: реплики звонящего заготовлены; нет номера, ASR, перевода, SMS." },
    { ro: "Tichetele nu ajung la Primărie; nicio stare de procesare nu este simulată.", ru: "Заявки не попадают в Примэрию; статусы обработки не имитируются." },
    { ro: "Categoriile de sesizări și clasificarea sunt reguli pe cuvinte-cheie ale prototipului.", ru: "Категории обращений и классификация — правила по ключевым словам прототипа." },
    { ro: "Contradicția demonstrată folosește două documente fictive (terase sezoniere).", ru: "Показанное противоречие использует два вымышленных документа (сезонные террасы)." },
  ];
  const needs = [
    { ro: "Cheie API pentru un model (sau server GPU) — pentru formulare liberă, cu același validator de citări.", ru: "Ключ API модели (или GPU-сервер) — для свободных формулировок с тем же валидатором цитат." },
    { ro: "Canal oficial de sesizări (API al portalului „Sesizează” sau alt sistem) — prin MunicipalSubmissionAdapter.", ru: "Официальный канал обращений (API портала «Sesizează» или другое) — через MunicipalSubmissionAdapter." },
    { ro: "Furnizor de telefonie, ASR și TTS pentru RO/RU.", ru: "Оператор телефонии, ASR и TTS для RO/RU." },
    { ro: "Proces de ingestie periodică și confirmarea statutului juridic al documentelor de către proprietarii informației.", ru: "Процесс периодической загрузки и подтверждение правового статуса документов владельцами информации." },
    { ro: "Autentificare pentru pagina angajaților, jurnalizare și politică de retenție a datelor.", ru: "Аутентификация для страницы сотрудников, журналирование и политика хранения данных." },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t({ ro: "Despre prototip", ru: "О прототипе" })}</h1>
        <p className="max-w-3xl text-muted">{t({ ro: "„Chișinău, pe fir” arată cum un asistent municipal poate răspunde doar cu dovezi, poate recunoaște ce nu știe și poate transforma golurile din documentație în sarcini de reparare.", ru: "«Кишинэу, на связи» показывает, как муниципальный помощник может отвечать только с доказательствами, признавать, чего не знает, и превращать пробелы в документации в задачи на исправление." })}</p>
        <Notice tone="warn">{t({ ro: "Nu este un serviciu oficial, nu este gata de producție și nu este integrat cu Primăria Municipiului Chișinău.", ru: "Это не официальный сервис, он не готов к эксплуатации и не интегрирован с Примэрией муниципия Кишинэу." })}</Notice>
      </header>

      <section id="acoperire" aria-labelledby="cov-h" className="scroll-mt-4 space-y-3">
        <h2 id="cov-h" className="text-xl font-bold">{t({ ro: "Acoperirea corpusului", ru: "Охват корпуса" })}</h2>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            [t({ ro: "URL-uri din Anexa 1 verificate", ru: "URL из Приложения 1 проверено" }), `${INVENTORY_STATS.accessible}/${INVENTORY_STATS.total}`],
            [t({ ro: "URL-uri de pornire procesate", ru: "Стартовых URL обработано" }), INVENTORY_STATS.processedStartUrls],
            [t({ ro: "Pagini/documente reale", ru: "Реальных страниц/документов" }), real.length],
            [t({ ro: "Pasaje / afirmații verificate", ru: "Фрагментов / утверждений проверено" }), `${PASSAGES.length} / ${FACTS.length}`],
          ].map(([k, v]) => (
            <div key={String(k)} className="card p-3"><dt className="text-sm text-muted">{k}</dt><dd className="text-2xl font-bold">{v}</dd></div>
          ))}
        </dl>
        <p>
          {t({ ro: "Subiecte acoperite cu surse reale: contract apă-canal (apartament), tarife apă și plata facturii (Apă-Canal Chișinău); petiții online (Primăria, RO+RU); contract evacuare deșeuri (Autosalubritate); examinarea arborilor (AGSV). Toate preluate la 25–26.09.2026.", ru: "Темы с реальными источниками: договор на воду (квартира), тарифы и оплата (Apă-Canal Chișinău); онлайн-петиции (Примэрия, RO+RU); договор на вывоз отходов (Autosalubritate); обследование деревьев (AGSV). Всё получено 25–26.09.2026." })}{" "}
          <Link href="/surse" className="link">{t({ ro: "Inventarul complet", ru: "Полный инвентарь" })}</Link>
        </p>
        <p className="text-muted">{t({ ro: "Neacoperite: educație (site-urile e-grădiniță și e-școală sunt aplicații JavaScript), sănătate, transport, direcțiile de sector, taxele locale și deciziile CMC.", ru: "Не охвачены: образование (e-gradinita и e-școală — JavaScript-приложения), здравоохранение, транспорт, претуры секторов, местные сборы и решения МСК." })}</p>
      </section>

      <section aria-labelledby="st-h" className="grid gap-4 md:grid-cols-3">
        <h2 id="st-h" className="sr-only">{t({ ro: "Stadiu", ru: "Состояние" })}</h2>
        {[
          { h: { ro: "Funcționează acum", ru: "Работает сейчас" }, list: works, cls: "border-ok" },
          { h: { ro: "Simulat sau limitat", ru: "Имитируется или ограничено" }, list: simulated, cls: "border-warn" },
          { h: { ro: "Necesită integrări reale", ru: "Требует реальных интеграций" }, list: needs, cls: "border-brand" },
        ].map((b) => (
          <div key={b.h.ro} className={`card border-t-4 p-4 ${b.cls}`}>
            <h3 className="font-bold">{t(b.h)}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{b.list.map((x) => <li key={x.ro}>{t(x)}</li>)}</ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="priv-h" className="card space-y-2 p-4">
        <h2 id="priv-h" className="text-xl font-bold">{t({ ro: "Confidențialitate", ru: "Конфиденциальность" })}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>{t({ ro: "În modul demo nimic nu este trimis către servicii externe de AI, OCR sau stocare.", ru: "В демо-режиме ничего не отправляется во внешние сервисы ИИ, OCR или хранения." })}</li>
          <li>{t({ ro: "Documentele scanate sunt procesate într-un dosar temporar și șterse imediat.", ru: "Отсканированные документы обрабатываются во временной папке и сразу удаляются." })}</li>
          <li>{t({ ro: "Tichetele și fișierele lor sunt stocate în .data/ pe computerul care rulează prototipul și pot fi șterse din pagina tichetului.", ru: "Заявки и их файлы хранятся в .data/ на компьютере с прототипом и удаляются со страницы заявки." })}</li>
          <li>{t({ ro: "Întrebările salvate pentru revizuire au e-mailurile, telefoanele și IDNP-urile înlocuite automat.", ru: "В вопросах, сохранённых для проверки, e-mail, телефоны и IDNP заменяются автоматически." })}</li>
          <li>{t({ ro: "Nu cerem nume, telefon sau e-mail pentru sesizări.", ru: "Для обращений мы не спрашиваем имя, телефон или e-mail." })}</li>
          <li>{t({ ro: "Cu un API extern (varianta A de mai jos), textul întrebării și pasajele ar ajunge la furnizor — interfața ar trebui să spună asta explicit.", ru: "С внешним API (вариант A ниже) текст вопроса и фрагменты уходили бы провайдеру — интерфейс должен явно это сообщать." })}</li>
        </ul>
      </section>

      <section id="buget" aria-labelledby="bud-h" className="scroll-mt-4 space-y-3">
        <h2 id="bud-h" className="text-xl font-bold">{t({ ro: "Buget lunar de mentenanță a modelului", ru: "Месячный бюджет обслуживания модели" })}</h2>
        <p className="max-w-3xl text-muted">
          {t({ ro: "Comparație între un API extern și un model auto-găzduit. Prețurile Claude Haiku 4.5 au fost verificate pe pagina oficială de prețuri Anthropic; restul sunt ipoteze ilustrative marcate. Modificați valorile pentru a recalcula.", ru: "Сравнение внешнего API и самостоятельно размещённой модели. Цены Claude Haiku 4.5 проверены на официальной странице цен Anthropic; остальное — отмеченные иллюстративные допущения. Измените значения для пересчёта." })}
        </p>
        <BudgetCalculator />
        <div className="card overflow-x-auto p-4">
          <h3 className="font-bold">{t({ ro: "Compromisuri operaționale", ru: "Операционные компромиссы" })}</h3>
          <table className="mt-2 w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="p-2"></th>
                <th scope="col" className="p-2">A. API</th>
                <th scope="col" className="p-2">B. {t({ ro: "Auto-găzduit", ru: "Своё размещение" })}</th>
              </tr>
            </thead>
            <tbody>
              {[
                [{ ro: "Calitate RO/RU", ru: "Качество RO/RU" }, { ro: "Ridicată, fără efort propriu", ru: "Высокое, без своих усилий" }, { ro: "Depinde de model; necesită evaluare pe întrebări reale", ru: "Зависит от модели; нужна оценка на реальных вопросах" }],
                [{ ro: "Date personale", ru: "Личные данные" }, { ro: "Textul pleacă la furnizor; necesită acord de prelucrare", ru: "Текст уходит провайдеру; нужен договор обработки" }, { ro: "Rămân în infrastructura proprie", ru: "Остаются в своей инфраструктуре" }],
                [{ ro: "Cost la volum mic", ru: "Стоимость при малом объёме" }, { ro: "Mic, proporțional cu utilizarea", ru: "Низкая, пропорциональна использованию" }, { ro: "Fix, plătit și când nu e folosit", ru: "Фиксированная, платится и без использования" }],
                [{ ro: "Operare", ru: "Эксплуатация" }, { ro: "Minimă; dependență de furnizor", ru: "Минимальная; зависимость от провайдера" }, { ro: "Actualizări, monitorizare, rezervă GPU", ru: "Обновления, мониторинг, резервный GPU" }],
                [{ ro: "Validare citări", ru: "Проверка цитат" }, { ro: "Aceeași în ambele variante: nicio afirmație fără pasaj verificat", ru: "Одинаково в обоих вариантах: ни одного утверждения без проверенного фрагмента" }, { ro: "Idem", ru: "То же" }],
              ].map(([k, x, y]) => (
                <tr key={k.ro} className="border-b border-line align-top">
                  <th scope="row" className="p-2 text-left">{t(k)}</th>
                  <td className="p-2">{t(x)}</td>
                  <td className="p-2">{t(y)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">{t({ ro: "Telefonia nu este inclusă: costurile de număr, minute și ASR/TTS depind de furnizor și nu au fost verificate.", ru: "Телефония не включена: стоимость номера, минут и ASR/TTS зависит от провайдера и не проверялась." })}</p>
        </div>
      </section>
    </div>
  );
}
