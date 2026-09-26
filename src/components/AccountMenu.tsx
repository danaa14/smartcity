"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getProviders, signIn, signOut, useSession } from "next-auth/react";
import { useLang } from "./LangProvider";
import { LangSwitch } from "./LangSwitch";
import { useConversations } from "./ConversationProvider";
import { Icon } from "./chat/Icon";

export function AccountMenu() {
  const { t, lang } = useLang();
  const { data: session, status } = useSession();
  const history = useConversations();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => { if (new URLSearchParams(location.search).has("authError")) {
      setAuthError(true); setOpen(true); dialog.current?.showModal();
    } });
    return () => { cancelAnimationFrame(frame); if (timer.current) clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  const close = () => {
    if (closing) return;
    setClosing(true);
    timer.current = setTimeout(() => { dialog.current?.close(); setClosing(false); }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240);
  };
  async function login() {
    setAuthBusy(true); setAuthError(false);
    try {
      const providers = await getProviders();
      if (!providers?.google) throw new Error("unconfigured");
      await signIn("google", { callbackUrl: location.pathname });
    } catch { setAuthError(true); setAuthBusy(false); }
  }
  return <>
    <button ref={trigger} type="button" className="menu-trigger" aria-label={t({ ro: "Deschide meniul", ru: "Открыть меню" })} aria-haspopup="dialog" aria-expanded={open} aria-controls="account-menu" onClick={() => { setOpen(true); dialog.current?.showModal(); }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h14" /></svg>
    </button>
    <dialog ref={dialog} id="account-menu" className={`account-drawer ${closing ? "is-closing" : ""}`} aria-labelledby="history-title" onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => { setOpen(false); trigger.current?.focus(); }} onClick={(event) => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right) close(); } }}>
      <div className="drawer-inner">
        <header className="drawer-heading"><div><span className="drawer-eyebrow">PE FIR · CHIȘINĂU</span><h2 id="history-title">{t({ ro: "Istoric conversații", ru: "История диалогов" })}</h2></div><button type="button" className="drawer-close" onClick={close} aria-label={t({ ro: "Închide meniul", ru: "Закрыть меню" })}><Icon name="close" /></button></header>
        <button className="new-conversation" onClick={() => { history.select(null); router.push("/"); close(); }}><Icon name="plus" />{t({ ro: "Conversație nouă", ru: "Новый диалог" })}</button>
        <div className="drawer-history">
          {!history.ready ? <p role="status">{t({ ro: "Se încarcă…", ru: "Загрузка…" })}</p> : history.items.length ? <ul>{history.items.map((item) => <li key={item.id}><button className="history-item" aria-current={history.active?.id === item.id ? "true" : undefined} onClick={() => { history.select(item); router.push("/"); close(); }}><Icon name="chat" /><span><strong>{item.title}</strong><time dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleDateString(lang === "ro" ? "ro-RO" : "ru-RU", { day: "numeric", month: "short" })}</time></span><Icon name="chevron" /></button></li>)}</ul> : <div className="history-empty"><span><Icon name="chat" /></span><h3>{t({ ro: "O conversație începe cu tine.", ru: "Диалог начинается с вас." })}</h3><p>{t({ ro: "Întrebările tale vor apărea aici. Revino oricând pentru a continua.", ru: "Ваши вопросы появятся здесь. Возвращайтесь, чтобы продолжить." })}</p></div>}
        </div>
        <footer className="drawer-footer">
          {history.error && <p role="alert">{t({ ro: "Istoricul nu poate fi salvat în acest browser.", ru: "Не удалось сохранить историю в браузере." })}</p>}
          <p className="history-storage-note">{t({ ro: "Conversațiile sunt păstrate în acest browser, separat pentru fiecare cont.", ru: "Диалоги сохраняются в этом браузере отдельно для каждого аккаунта." })}</p>
          {session?.user && <div className="account-details"><strong>{session.user.name}</strong><span>{session.user.email}</span><button onClick={() => void signOut({ callbackUrl: "/" })}>{t({ ro: "Deconectare", ru: "Выйти" })}</button></div>}
          <div className="drawer-controls"><button type="button" className="google-control" disabled={status === "loading" || authBusy || !!session?.user} onClick={() => void login()} aria-label={session?.user ? t({ ro: "Conectat cu Google", ru: "Вход через Google выполнен" }) : t({ ro: "Conectare cu Google", ru: "Войти через Google" })}>{session?.user?.image ? <Image unoptimized width={28} height={28} src={session.user.image} alt="" referrerPolicy="no-referrer" /> : <span className="google-mark" aria-hidden="true">G</span>}<span>{session?.user ? t({ ro: "Conectat", ru: "Вы вошли" }) : authBusy ? "…" : "Google"}</span></button><LangSwitch /></div>
          {authError && <p className="auth-error" role="alert">{t({ ro: "Conectarea Google nu este disponibilă. Verifică configurarea sau încearcă din nou.", ru: "Вход через Google недоступен. Проверьте настройки или попробуйте снова." })}</p>}
        </footer>
      </div>
    </dialog>
  </>;
}
