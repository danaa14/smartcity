"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLang } from "../LangProvider";
import { gpsFromExif } from "@/lib/tickets/exif";

type City = "Chișinău" | "Codru" | "Durlești" | "Cricova" | "Sîngera" | "Vadul lui Vodă";
type PublicTicket = { id: string; title?: string; city?: string; status?: "active" | "done"; location?: { text: string }; description: string; createdAt: string };
const CITIES: City[] = ["Chișinău", "Codru", "Durlești", "Cricova", "Sîngera", "Vadul lui Vodă"];
const FAQ = [
  { q: { ro: "Ce pot raporta?", ru: "О чём можно сообщить?" }, a: { ro: "Probleme observate în oraș, cum ar fi gropi, iluminat stradal, deșeuri, arbori sau scurgeri de apă.", ru: "О замеченных городских проблемах: ямах, уличном освещении, мусоре, деревьях или утечках воды." } },
  { q: { ro: "Cum se completează locația?", ru: "Как указывается место?" }, a: { ro: "Dacă fotografia JPG conține coordonate GPS, le folosim automat. Dacă nu, introdu adresa sau un reper. Poți verifica și edita locația înainte de creare.", ru: "Если JPG-фотография содержит GPS-координаты, мы используем их автоматически. Если нет — укажи адрес или ориентир. Перед созданием место можно проверить и изменить." } },
  { q: { ro: "Tichetul ajunge la Primărie?", ru: "Заявка попадёт в Примэрию?" }, a: { ro: "Nu. Acesta este un prototip: tichetele sunt salvate local și nu sunt trimise unei instituții.", ru: "Нет. Это прототип: заявки сохраняются локально и не отправляются в учреждение." } },
  { q: { ro: "Pot vedea ce s-a rezolvat?", ru: "Можно увидеть, что уже решено?" }, a: { ro: "Da. Folosește filtrele «Active» și «Rezolvate» și alege orașul din listă.", ru: "Да. Используй фильтры «Активные» и «Решённые» и выбери город." } },
];

export function ReportClient({ initialTickets, startInCreate = false }: { initialTickets: PublicTicket[]; startInCreate?: boolean }) {
  const { lang, t } = useLang();
  const router = useRouter();
  const [creating, setCreating] = useState(startInCreate);
  const [title, setTitle] = useState("");
  const [city, setCity] = useState<City>("Chișinău");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filterCity, setFilterCity] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"active" | "done">("active");

  const visible = useMemo(() => initialTickets.filter((ticket) => (ticket.status ?? "active") === filterStatus && (filterCity === "all" || (ticket.city ?? "Chișinău") === filterCity)), [initialTickets, filterCity, filterStatus]);

  const choosePhoto = async (file?: File) => {
    if (!file) { if (photoInput.current) photoInput.current.value = ""; return; }
    if (file.size > 25 * 1024 * 1024) {
      if (photoInput.current) photoInput.current.value = "";
      setError(t({ ro: "Fotografia trebuie să fie mai mică de 25 MB.", ru: "Размер фотографии должен быть меньше 25 МБ." }));
      return;
    }
    setPhoto(file); setCoords(null); setLocation(""); setError("");
    if (!file) return;
    if (file.type === "image/jpeg") {
      try { const gps = gpsFromExif(await file.arrayBuffer()); if (gps) { setCoords(gps); setLocation(`GPS ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`); } }
      catch { /* Unsupported or damaged EXIF: manual address remains available. */ }
    }
    setCreating(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!photo) { setError(t({ ro: "Adaugă o fotografie pentru a crea tichetul.", ru: "Добавь фотографию, чтобы создать заявку." })); return; }
    if (photo.size > 25 * 1024 * 1024) { setError(t({ ro: "Fotografia trebuie să fie mai mică de 25 MB.", ru: "Размер фотографии должен быть меньше 25 МБ." })); return; }
    if (!title.trim()) { setError(t({ ro: "Scrie un titlu scurt pentru tichet.", ru: "Введи короткое название заявки." })); return; }
    if (!location.trim()) { setError(t({ ro: "Locația nu a fost găsită în fotografie. Completeaz-o manual.", ru: "Место не найдено в фотографии. Укажи его вручную." })); return; }
    setBusy(true);
    const fd = new FormData();
    fd.append("title", title.trim()); fd.append("description", title.trim()); fd.append("city", city); fd.append("location", location.trim());
    fd.append("locationSource", coords ? "photo" : "manual"); fd.append("category", "other"); fd.append("lang", lang); fd.append("confirm", "yes"); fd.append("media", photo);
    if (coords) { fd.append("lat", String(coords.lat)); fd.append("lng", String(coords.lng)); }
    try {
      const r = await fetch("/api/tickets", { method: "POST", body: fd }); const j = await r.json();
      if (!r.ok) throw new Error(j.reason ?? j.error ?? "error");
      router.push(`/tichet/${j.id}?nou=1`); router.refresh();
    } catch { setError(t({ ro: "Tichetul nu a putut fi creat. Încearcă din nou.", ru: "Не удалось создать заявку. Попробуй ещё раз." })); setBusy(false); }
  };

  return (
    <div className="report-hub">
      <section className="report-create" aria-labelledby="report-title">
        <input ref={photoInput} className="sr-only" id="ticket-photo" name="media" type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden="true" onChange={(e) => void choosePhoto(e.target.files?.[0])} />
        {!creating ? <>
          <div className="report-create-copy"><h1 id="report-title">{t({ ro: "Ai observat o problemă?", ru: "Заметил проблему?" })}</h1><p>{t({ ro: "Fotografiază locul și dă-ne de veste.", ru: "Сфотографируй место и сообщи нам." })}</p></div>
          <button type="button" className="report-start" onClick={() => { setError(""); photoInput.current?.click(); }}><span aria-hidden="true">＋</span>{t({ ro: "Creează un tichet", ru: "Создать заявку" })}<span className="report-arrow" aria-hidden="true">↗</span></button>
          {error && <p role="alert" className="report-error">{error}</p>}
        </> : <>
          <div className="report-form-head"><div><span className="report-kicker">{t({ ro: "TICHET NOU", ru: "НОВАЯ ЗАЯВКА" })}</span><h1 id="report-title">{t({ ro: "Dă de veste", ru: "Сообщить о проблеме" })}</h1></div><Link href="/raporteaza" className="report-close" aria-label={t({ ro: "Închide", ru: "Закрыть" })}>×</Link></div>
          <form action="/api/tickets" method="post" encType="multipart/form-data" onSubmit={submit} className="report-form" noValidate>
            <input type="hidden" name="description" value={title} /><input type="hidden" name="category" value="other" /><input type="hidden" name="lang" value={lang} /><input type="hidden" name="confirm" value="yes" /><input type="hidden" name="locationSource" value={coords ? "photo" : "manual"} /><input type="hidden" name="lat" value={coords?.lat ?? ""} /><input type="hidden" name="lng" value={coords?.lng ?? ""} />
            {photo && <div className="photo-preview"><img src={URL.createObjectURL(photo)} alt={t({ ro: "Previzualizarea fotografiei pentru tichet", ru: "Предпросмотр фотографии для заявки" })} /><button type="button" className="btn btn-quiet" onClick={() => photoInput.current?.click()}>{t({ ro: "Schimbă fotografia", ru: "Заменить фото" })}</button></div>}
            <div className="report-fields">
              <label>{t({ ro: "Titlul tichetului", ru: "Название заявки" })}<input className="input" name="title" value={title} minLength={5} maxLength={100} required onChange={(e) => setTitle(e.target.value)} placeholder={t({ ro: "Problema întâlnită", ru: "Обнаруженная проблема" })} /></label>
              <label>{t({ ro: "Orașul / localitatea", ru: "Город / населённый пункт" })}<select className="input" name="city" value={city} onChange={(e) => setCity(e.target.value as City)}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label>{t({ ro: "Locația", ru: "Место" })}<input className="input" name="location" value={location} minLength={3} onChange={(e) => setLocation(e.target.value)} placeholder={coords ? t({ ro: "Locație GPS găsită în fotografie", ru: "GPS-место найдено в фотографии" }) : t({ ro: "Scrie strada, numărul sau un reper", ru: "Укажи улицу, номер дома или ориентир" })} /></label>
              <p className="location-hint" aria-live="polite">{coords ? t({ ro: "✓ Am găsit coordonatele GPS în fotografia JPG. Le poți păstra sau edita.", ru: "✓ В JPG-фотографии найдены GPS-координаты. Их можно оставить или изменить." }) : photo ? t({ ro: "Nu am găsit coordonate GPS compatibile. Completează locația manual.", ru: "Не удалось найти GPS-координаты. Укажи место вручную." }) : t({ ro: "Dacă fotografia JPG are GPS, vom completa locația automat.", ru: "Если в JPG-фотографии есть GPS, мы заполним место автоматически." })}</p>
            </div>
            {error && <p role="alert" className="report-error">{error}</p>}
            <div className="report-form-actions"><Link href="/raporteaza" className="report-cancel">{t({ ro: "Anulează", ru: "Отмена" })}</Link><button className="report-submit" type="submit" disabled={busy}>{busy ? t({ ro: "Se creează…", ru: "Создаём…" }) : t({ ro: "Creează tichetul", ru: "Создать заявку" })}</button></div>
          </form>
        </>}
      </section>

      <section className="ticket-board" aria-labelledby="board-title">
        <div className="board-heading"><div><h2 id="board-title">{t({ ro: "Tichete din oraș", ru: "Заявки города" })}</h2></div><label className="city-filter"><span>{t({ ro: "Localitate", ru: "Населённый пункт" })}</span><select value={filterCity} onChange={(e) => setFilterCity(e.target.value)}><option value="all">{t({ ro: "Tot orașul", ru: "Весь город" })}</option>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></label></div>
        <div className="ticket-tabs" role="tablist" aria-label={t({ ro: "Starea tichetelor", ru: "Статус заявок" })}><button type="button" role="tab" aria-selected={filterStatus === "active"} onClick={() => setFilterStatus("active")}>{t({ ro: "Active", ru: "Активные" })}<span>{initialTickets.filter((x) => (x.status ?? "active") === "active" && (filterCity === "all" || (x.city ?? "Chișinău") === filterCity)).length}</span></button><button type="button" role="tab" aria-selected={filterStatus === "done"} onClick={() => setFilterStatus("done")}>{t({ ro: "Rezolvate", ru: "Решённые" })}<span>{initialTickets.filter((x) => x.status === "done" && (filterCity === "all" || (x.city ?? "Chișinău") === filterCity)).length}</span></button></div>
        {visible.length ? <div className="ticket-grid">{visible.map((x) => <article className="ticket-card" key={x.id}><div className="ticket-card-top"><span className={`ticket-status ${(x.status ?? "active") === "done" ? "done" : ""}`}><i />{(x.status ?? "active") === "done" ? t({ ro: "Rezolvat", ru: "Решено" }) : t({ ro: "Activ", ru: "Активно" })}</span><time>{new Intl.DateTimeFormat(lang === "ro" ? "ro-MD" : "ru-MD", { day: "numeric", month: "short" }).format(new Date(x.createdAt))}</time></div><h3>{x.title || x.description}</h3><p>⌖ {x.location?.text || x.city || "Chișinău"}</p><Link className="ticket-open" href={`/tichet/${x.id}`}>{t({ ro: "Vezi tichetul", ru: "Открыть заявку" })} ↗</Link></article>)}</div> : <div className="ticket-empty"><span aria-hidden="true">✳</span><h3>{filterStatus === "active" ? t({ ro: "Nicio sesizare activă aici", ru: "Здесь нет активных обращений" }) : t({ ro: "Încă nu sunt tichete rezolvate", ru: "Пока нет решённых заявок" })}</h3></div>}
      </section>

      <section className="report-faq" aria-labelledby="faq-title"><span className="report-kicker">{t({ ro: "RĂSPUNSURI RAPIDE", ru: "КОРОТКО О ГЛАВНОМ" })}</span><h2 id="faq-title">{t({ ro: "Întrebări frecvente", ru: "Частые вопросы" })}</h2><div>{FAQ.map((item) => <details key={item.q.ro}><summary>{t(item.q)}<span>＋</span></summary><p>{t(item.a)}</p></details>)}</div></section>
    </div>
  );
}
