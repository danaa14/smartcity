import { NextResponse } from "next/server";
import { answerWithModel } from "@/lib/answer/withModel";
import { logReview } from "@/lib/feedback";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { question?: string; lang?: string } | null;
  const question = body?.question?.trim();
  if (!question) return NextResponse.json({ error: "empty_question" }, { status: 400 });
  if (question.length > 500) return NextResponse.json({ error: "too_long" }, { status: 400 });
  const lang = body?.lang === "ru" ? "ru" : "ro";
  const answer = await answerWithModel(question, lang);

  // Documentation repair loop: gaps and conflicts become review items (question is redacted).
  if (answer.status !== "supported") {
    const kind = answer.status === "missing" ? "unanswered" : answer.status === "partial" ? "partial" : "conflict";
    await logReview({
      kind,
      lang,
      question,
      topicId: answer.topicId,
      answerStatus: answer.status,
      missing: answer.missing.map((m) => m.ro),
      conflictGroup: answer.conflicts[0]?.group,
    });
  }
  return NextResponse.json(answer);
}
