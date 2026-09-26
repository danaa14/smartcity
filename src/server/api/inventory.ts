import { INVENTORY } from "@/lib/corpus/inventory";

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function GET() {
  const head = ["annex_category", "start_url", "accessible", "http_status", "final_url", "home_title", "html_lang", "js_only", "probed_at", "processed_doc_title", "processed_doc_url", "publisher", "language", "published_at", "effective_at", "revised_at", "retrieved_at", "passage_citable", "notes"];
  const rows: unknown[][] = [];
  for (const r of INVENTORY) {
    const base = [r.category, r.startUrl, r.accessible, r.httpStatus, r.finalUrl, r.homeTitle, r.htmlLang, r.jsOnly, r.probedAt];
    if (!r.processed.length) rows.push([...base, "", "", "", "", "", "", "", "", "no", r.note.ro]);
    for (const p of r.processed) rows.push([...base, p.title, p.url, p.publisher, p.lang, p.publishedAt, p.effectiveAt, p.revisedAt, p.retrievedAt, "yes", r.note.ro]);
  }
  const csv = [head, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  return new Response("﻿" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="annex1-source-inventory.csv"' } });
}
