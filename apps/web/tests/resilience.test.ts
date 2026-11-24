import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { runTurn, type TurnInput } from "@/lib/ai/orchestrator";
import { parseJsonObject } from "@/lib/ai/llm";

const base = (text: string): TurnInput => ({
  text, mode: "just_listen", history: [], selfReport: null, isPrivate: false, memoryConsent: false, memories: [],
  country: "IN", recentHints: [], lastAssistantAskedClarification: false, todayISO: "2026-11-24",
});

describe("model output parsing", () => {
  it("strips reasoning tags and code fences before parsing JSON", () => {
    expect(parseJsonObject('<think>{"x":1} maybe</think>\n```json\n{"reply":"hi"}\n```')).toEqual({ reply: "hi" });
  });
});

describe("free-tier resilience", () => {
  let server: http.Server;
  const seen: string[] = [];
  let mode: "first-limited" | "all-limited" = "first-limited";

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const { model, messages } = JSON.parse(body);
        seen.push(model);
        const limited = mode === "all-limited" || model === "main-model" || model === "fast-model";
        if (limited) {
          res.statusCode = 429;
          return res.end(JSON.stringify({ error: { message: "rate limit" } }));
        }
        const analysis = String(messages[0].content).startsWith("You analyse");
        const content = analysis
          ? { emotion: { neutral: 0.9 }, intent: "vent", intent_confidence: 0.9, safety: "ordinary" }
          : { reply: "Reply from the backup model.", proposal: null };
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }));
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    Object.assign(process.env, {
      LLM_API_KEY: "test",
      LLM_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      LLM_MODEL: "main-model",
      LLM_FAST_MODEL: "fast-model",
      LLM_FALLBACK_MODELS: "backup-a,backup-b",
    });
  });
  afterAll(() => {
    server.close();
    for (const k of ["LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL", "LLM_FAST_MODEL", "LLM_FALLBACK_MODELS"]) delete process.env[k];
  });

  it("moves to the next model when one model's free quota is used up", async () => {
    const out = await runTurn(base("Work was long today and I just want to talk"));
    expect(out.reply).toBe("Reply from the backup model.");
    expect(out.busy).toBe(false);
    expect(seen).toContain("main-model");
    expect(seen).toContain("backup-a");
  });

  it("keeps replying with the reviewed responder when every model is limited", async () => {
    mode = "all-limited";
    const out = await runTurn(base("Work was long today and I just want to talk"));
    expect(out.busy).toBe(true);
    expect(out.reply.length).toBeGreaterThan(20);
    expect(out.route).toBe("ordinary");
  });

  it("still routes safety deterministically when every model is limited", async () => {
    mode = "all-limited";
    const out = await runTurn(base("I want to kill myself"));
    expect(out.route).toBe("concern");
    expect(out.usedTemplate).toBe(true);
  });
});
