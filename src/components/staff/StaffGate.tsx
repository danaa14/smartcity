"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "../LangProvider";

export function StaffGate({ configured }: { configured: boolean }) {
  const { t } = useLang();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/staff/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setPassword("");
      router.refresh();
      return;
    }
    setError(
      res?.status === 429
        ? t({ ro: "Prea multe încercări. Încearcă din nou peste 10 minute.", ru: "Слишком много попыток. Повторите через 10 минут." })
        : t({ ro: "Parolă greșită.", ru: "Неверный пароль." }),
    );
  };

  if (!configured) {
    return (
      <div className="bo-gate">
        <span className="bo-gate-mark" aria-hidden="true">⌘</span>
        <h1>{t({ ro: "Back office închis", ru: "Бэк-офис закрыт" })}</h1>
        <p>{t({ ro: "Nu este configurată nicio parolă, deci pagina rămâne închisă pentru toată lumea.", ru: "Пароль не задан, поэтому страница закрыта для всех." })}</p>
        <p className="bo-gate-hint">
          {t({ ro: "Setează", ru: "Задайте" })} <code>STAFF_PASSWORD</code>{" "}
          {t({ ro: "în .env.local (minimum 8 caractere) și repornește serverul.", ru: "в .env.local (минимум 8 символов) и перезапустите сервер." })}
        </p>
      </div>
    );
  }

  return (
    <div className="bo-gate">
      <span className="bo-gate-mark" aria-hidden="true">⌘</span>
      <h1>{t({ ro: "Intrare pentru angajați", ru: "Вход для сотрудников" })}</h1>
      <p>{t({ ro: "Această zonă arată întrebări fără răspuns, contradicții și tichete. Nu este publică.", ru: "Здесь — вопросы без ответа, противоречия и заявки. Раздел непубличный." })}</p>
      <form onSubmit={submit}>
        <label className="sr-only" htmlFor="staff-password">{t({ ro: "Parolă", ru: "Пароль" })}</label>
        <input
          id="staff-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t({ ro: "Parolă", ru: "Пароль" })}
          required
        />
        {error && <p className="bo-gate-error" role="alert">{error}</p>}
        <button type="submit" disabled={busy || !password}>
          {busy ? t({ ro: "Se verifică…", ru: "Проверяем…" }) : t({ ro: "Intră", ru: "Войти" })}
        </button>
      </form>
      <p className="bo-gate-hint">
        {t({ ro: "Prototip: o singură parolă comună, fără conturi individuale. Datele provin doar din utilizarea acestui prototip.", ru: "Прототип: один общий пароль, без отдельных учётных записей. Данные — только из использования этого прототипа." })}
      </p>
    </div>
  );
}
