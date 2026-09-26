import { TicketJourney } from "@/components/report/TicketJourney";
import type { Metadata } from "next";
import Link from "next/link";
import { getLang } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n";
import { tickets } from "@/lib/tickets/repo";

export const metadata: Metadata = { title: "Tichet demo" };
export const dynamic = "force-dynamic";

export default async function TicketPage(props: PageProps<"/tichet/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const lang = await getLang();
  const t = (x: { ro: string; ru: string }) => tr(x, lang);
  const tk = await tickets.get(id);

  if (!tk)
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">{t({ ro: "Tichetul nu a fost găsit", ru: "Заявка не найдена" })}</h1>
        <p>{t({ ro: `Nu există tichetul „${id}” pe acest computer. Poate a fost șters.`, ru: `Заявки «${id}» нет на этом компьютере. Возможно, она удалена.` })}</p>
        <Link href="/raporteaza" className="btn btn-primary">{t({ ro: "Raportează o problemă", ru: "Сообщить о проблеме" })}</Link>
      </div>
    );

  return <TicketJourney initial={tk} fresh={sp.nou === "1"} />;
}
