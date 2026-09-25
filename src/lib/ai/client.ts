import "server-only";
import { AI } from "./config";

export class ModelError extends Error {
  constructor(public code: "training_not_allowed" | "upstream" | "timeout" | "network" | "empty", message: string) {
    super(message);
  }
}

type ResponsesOutput = { output_text?: string; output?: { content?: { type: string; text?: string }[] }[] };

/** One completion via OpenCode Go. Muse Spark models use the Responses API; others use Chat Completions. */
export async function complete(system: string, user: string, sessionId: string): Promise<string> {
  const responsesApi = AI.model.startsWith("muse-spark");
  const url = `${AI.baseUrl}/${responsesApi ? "responses" : "chat/completions"}`;
  const body = responsesApi
    ? { model: AI.model, instructions: system, input: user, max_output_tokens: 16000 }
    : { model: AI.model, messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: 16000 };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), AI.timeoutMs);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${AI.apiKey}`,
        "content-type": "application/json",
        "user-agent": "chisinau-pe-fir/0.1",
        "x-opencode-session": sessionId,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const msg: string = j?.error?.message ?? `HTTP ${r.status}`;
      throw new ModelError(/trains on request data/i.test(msg) ? "training_not_allowed" : "upstream", msg);
    }
    const text = responsesApi
      ? ((j as ResponsesOutput).output_text ??
        ((j as ResponsesOutput).output ?? []).flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "").join(""))
      : j?.choices?.[0]?.message?.content;
    if (!text) throw new ModelError("empty", "empty completion");
    return text;
  } catch (e) {
    if (e instanceof ModelError) throw e;
    throw new ModelError((e as Error).name === "AbortError" ? "timeout" : "network", String(e));
  } finally {
    clearTimeout(timer);
  }
}
