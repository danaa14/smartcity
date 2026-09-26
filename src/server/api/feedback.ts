import { NextResponse } from "next/server";
import { logReview } from "@/lib/feedback";
import { PASSAGE_BY_ID } from "@/lib/corpus/passages";

const REASONS = new Set(["wrong_passage", "outdated", "misread", "other"]);

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const lang = b.lang === "ru" ? "ru" : "ro";
  const comment = typeof b.comment === "string" ? b.comment.slice(0, 1000) : undefined;
  const question = typeof b.question === "string" ? b.question : undefined;

  if (b.type === "rating") {
    if (typeof b.useful !== "boolean") return NextResponse.json({ error: "missing_rating" }, { status: 400 });
    const item = await logReview({
      kind: "rating",
      lang,
      question,
      useful: b.useful,
      comment,
      topicId: typeof b.topicId === "string" ? b.topicId : null,
      answerStatus: typeof b.status === "string" ? (b.status as never) : undefined,
    });
    return NextResponse.json({ ok: true, id: item.id });
  }

  if (b.type === "citation") {
    const passageId = typeof b.passageId === "string" ? b.passageId : "";
    if (!PASSAGE_BY_ID.has(passageId)) return NextResponse.json({ error: "unknown_passage" }, { status: 400 });
    const reason = typeof b.reason === "string" && REASONS.has(b.reason) ? (b.reason as "wrong_passage") : null;
    if (!reason) return NextResponse.json({ error: "missing_reason" }, { status: 400 });
    const item = await logReview({
      kind: "citation_report",
      lang,
      question,
      passageId,
      claimId: typeof b.claimId === "string" ? b.claimId : undefined,
      reportReason: reason,
      comment,
    });
    return NextResponse.json({ ok: true, id: item.id });
  }

  return NextResponse.json({ error: "unknown_type" }, { status: 400 });
}
