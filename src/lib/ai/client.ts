import "server-only";
import { AI } from "./config";

export class ModelError extends Error {
  constructor(public code: "training_not_allowed" | "upstream" | "timeout" | "network" | "empty" | "truncated", message: string, public status?: number) {
    super(message);
  }
}

function retryable(e: unknown): boolean {
  if (!(e instanceof ModelError)) return false;
  // "truncated" is deterministic: the same budget produces the same cut-off, so retrying wastes a call.
  if (e.code === "network" || e.code === "timeout" || e.code === "empty") return true;
  return e.code === "upstream" && !!e.status && (e.status === 429 || e.status >= 500);
}

type ResponsesOutput = {
  output_text?: string;
  output?: { content?: { type: string; text?: string }[] }[];
  status?: string;
  incomplete_details?: { reason?: string };
};

/**
 * Muse Spark is a reasoning model: it spends output tokens thinking before it writes a word.
 * A 700-token budget was consumed almost entirely by reasoning (697 tokens, 0 visible
 * characters), which surfaced as blank or half-finished answers. Caps must leave room for
 * reasoning AND the reply — unused budget costs nothing, a starved one costs the answer.
 */
const MAX_TOKENS_DEFAULT = 16000;

export interface CompleteOptions {
  /** Cap on generated output tokens. Keep it tight: the provider reserves to this bound. */
  maxTokens?: number;
  /** When true, an AbortSignal is passed down and caller handles cancellation. */
  signal?: AbortSignal;
}

/** One completion via OpenCode Go. Muse Spark models use the Responses API; others use Chat Completions. */
export async function complete(system: string, user: string, sessionId: string, opts: CompleteOptions = {}): Promise<string> {
  const { maxTokens = MAX_TOKENS_DEFAULT, signal } = opts;
  const t0 = Date.now();
  console.log(`[ai] complete start session=${sessionId} model=${AI.model} maxTokens=${maxTokens} inputChars=${user.length}`);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await runOnce();
      console.log(`[ai] complete ok session=${sessionId} attempt=${attempt + 1} ms=${Date.now() - t0} outChars=${out.length}`);
      return out;
    } catch (e) {
      const m = e instanceof ModelError;
      console.warn(`[ai] complete fail session=${sessionId} attempt=${attempt + 1} code=${m ? e.code : "?"} status=${m ? e.status ?? "-" : "-"} ms=${Date.now() - t0} msg=${m ? e.message.slice(0, 120) : String(e)}`);
      if (!retryable(e) || attempt === 1) throw e;
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  throw new ModelError("upstream", "unreachable");

  async function runOnce(): Promise<string> {
    const responsesApi = AI.model.startsWith("muse-spark");
    const url = `${AI.baseUrl}/${responsesApi ? "responses" : "chat/completions"}`;
    const body = responsesApi
      ? { model: AI.model, instructions: system, input: user, max_output_tokens: maxTokens }
      : { model: AI.model, messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: maxTokens };
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
        signal: combineSignals(ctrl.signal, signal),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        const msg: string = j?.error?.message ?? `HTTP ${r.status}`;
        throw new ModelError(/trains on request data/i.test(msg) ? "training_not_allowed" : "upstream", msg, r.status);
      }
      const text = responsesApi
        ? ((j as ResponsesOutput).output_text ??
          ((j as ResponsesOutput).output ?? []).flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "").join(""))
        : j?.choices?.[0]?.message?.content;
      // Responses API reports truncation as incomplete_details; Chat Completions as finish_reason.
      const cut = responsesApi
        ? (j as ResponsesOutput)?.incomplete_details?.reason === "max_output_tokens"
        : j?.choices?.[0]?.finish_reason === "length";
      if (cut) throw new ModelError("truncated", `output cut off at ${maxTokens} tokens (reasoning consumed the budget)`);
      if (!text) throw new ModelError("empty", "empty completion");
      return text;
    } catch (e) {
      if (e instanceof ModelError) throw e;
      throw new ModelError((e as Error).name === "AbortError" ? "timeout" : "network", String(e));
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Streaming completion — SSE lines become text chunks.
 * Yields the visible output text only (no JSON framing, no tool/buf chunks).
 */
export async function* completeStream(system: string, user: string, sessionId: string, opts: CompleteOptions = {}): AsyncGenerator<string> {
  const { maxTokens = MAX_TOKENS_DEFAULT, signal } = opts;
  const t0 = Date.now();
  console.log(`[ai] stream start session=${sessionId} model=${AI.model} maxTokens=${maxTokens} inputChars=${user.length}`);
  let yielded = 0;
  let yieldedText = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      for await (const chunk of runOnceStream()) {
        yielded++;
        yieldedText += chunk.length;
        yield chunk;
      }
      console.log(`[ai] stream ok session=${sessionId} attempt=${attempt + 1} ms=${Date.now() - t0} chunks=${yielded} chars=${yieldedText}`);
      return;
    } catch (e) {
      const m = e instanceof ModelError;
      console.warn(`[ai] stream fail session=${sessionId} attempt=${attempt + 1} yielded=${yielded} code=${m ? e.code : "?"} status=${m ? e.status ?? "-" : "-"} ms=${Date.now() - t0} msg=${m ? e.message.slice(0, 120) : String(e)}`);
      if (!retryable(e) || attempt === 1 || yielded > 0) throw e;
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  throw new ModelError("upstream", "unreachable");

  async function* runOnceStream(): AsyncGenerator<string> {
    const responsesApi = AI.model.startsWith("muse-spark");
    const url = `${AI.baseUrl}/${responsesApi ? "responses" : "chat/completions"}`;
    const body = responsesApi
      ? { model: AI.model, instructions: system, input: user, max_output_tokens: maxTokens, stream: true }
      : { model: AI.model, messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: maxTokens, stream: true };
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
        signal: combineSignals(ctrl.signal, signal),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        const msg: string = j?.error?.message ?? `HTTP ${r.status}`;
        throw new ModelError(/trains on request data/i.test(msg) ? "training_not_allowed" : "upstream", msg, r.status);
      }
      if (!r.body) throw new ModelError("upstream", "no response body");
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let obj: {
            type?: unknown;
            delta?: unknown;
            choices?: { delta?: { content?: unknown }; finish_reason?: string }[];
            response?: { incomplete_details?: { reason?: string } };
          };
          try {
            obj = JSON.parse(payload);
          } catch {
            continue;
          }
          const cut = responsesApi
            ? obj.type === "response.incomplete" && obj.response?.incomplete_details?.reason === "max_output_tokens"
            : obj.choices?.[0]?.finish_reason === "length";
          if (cut) throw new ModelError("truncated", `stream cut off at ${maxTokens} tokens (reasoning consumed the budget)`);
          const chunk = responsesApi
            ? (obj.type === "response.output_text.delta" && typeof obj.delta === "string" ? obj.delta : null)
            : (() => {
                const content = obj.choices?.[0]?.delta?.content;
                return typeof content === "string" ? content : null;
              })();
          if (chunk) yield chunk;
        }
      }
    } catch (e) {
      if (e instanceof ModelError) throw e;
      throw new ModelError((e as Error).name === "AbortError" ? "timeout" : "network", String(e));
    } finally {
      clearTimeout(timer);
    }
  }
}

function combineSignals(a: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!b) return a;
  const ctrl = new AbortController();
  const on = () => ctrl.abort();
  a.addEventListener("abort", on, { once: true });
  b.addEventListener("abort", on, { once: true });
  return ctrl.signal;
}