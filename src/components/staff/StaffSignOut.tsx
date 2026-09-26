"use client";

import { useRouter } from "next/navigation";
import { useLang } from "../LangProvider";

export function StaffSignOut() {
  const { t } = useLang();
  const router = useRouter();
  const signOut = async () => {
    await fetch("/api/staff/auth", { method: "DELETE" }).catch(() => null);
    router.refresh();
  };
  return (
    <button type="button" className="bo-signout" onClick={() => void signOut()}>
      {t({ ro: "Ieși din cont", ru: "Выйти" })}
    </button>
  );
}
