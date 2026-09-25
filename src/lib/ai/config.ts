import "server-only";

export const AI = {
  apiKey: process.env.OPENCODE_API_KEY ?? "",
  get enabled() {
    return process.env.AI_MODE !== "off" && !!this.apiKey;
  },
  baseUrl: process.env.OPENCODE_BASE_URL || "https://opencode.ai/zen/go/v1",
  model: process.env.AI_MODEL || "muse-spark-1.3-contributor",
  timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 90000,
};

/** OpenCode states that Muse Spark models train on request data. */
export const MODEL_TRAINS_ON_DATA = AI.model.startsWith("muse-spark");
