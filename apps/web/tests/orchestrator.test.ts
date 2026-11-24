import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { runTurn, type TurnInput } from "@/lib/ai/orchestrator";

const base = (over: Partial<TurnInput>): TurnInput => ({
  text: "hello",
  mode: "just_listen",
  history: [],
  selfReport: null,
  isPrivate: false,
  memoryConsent: false,
  memories: [],
  country: "IN",
  recentHints: [],
  lastAssistantAskedClarification: false,
  todayISO: "2026-11-24",
  ...over,
});

describe("orchestrator in demo mode (no LLM key)", () => {
  beforeAll(() => {
    delete process.env.LLM_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.HF_TOKEN;
  });

  it("responds in demo mode and labels it", async () => {
    const out = await runTurn(base({ text: "Work has been really frustrating this week" }));
    expect(out.demo).toBe(true);
    expect(out.reply.length).toBeGreaterThan(10);
    expect(out.route).toBe("ordinary");
  });

  it("suppresses task proposals in Just Listen unless explicitly requested", async () => {
    const a = await runTurn(base({ text: "I have so many deadlines and I'm behind on everything" }));
    expect(a.proposals).toHaveLength(0);
    const b = await runTurn(base({ text: "Can you make me a plan for my deadlines?" }));
    expect(b.proposals[0]?.type).toBe("task_plan");
  });

  it("proposes a plan in Problem Solver mode when the user wants advice", async () => {
    const out = await runTurn(base({ mode: "problem_solver", text: "What should I do about my exam prep, I keep procrastinating" }));
    expect(out.proposals[0]?.type).toBe("task_plan");
  });

  it("bypasses inference and uses the reviewed template for immediate danger", async () => {
    const out = await runTurn(base({ text: "I have the pills and I'm going to end it tonight", mode: "casual" }));
    expect(out.route).toBe("immediate");
    expect(out.usedTemplate).toBe(true);
    expect(out.reply).toContain("14416");
    expect(out.proposals).toHaveLength(0);
  });

  it("safety overrides every mode", async () => {
    for (const mode of ["just_listen", "problem_solver", "motivate_me", "casual"] as const) {
      const out = await runTurn(base({ mode, text: "I want to kill myself" }));
      expect(out.route).toBe("concern");
      expect(out.showResources).toBe(true);
      expect(out.proposals).toHaveLength(0);
    }
  });

  it("uses a correction as authoritative self-report", async () => {
    const out = await runTurn(base({ text: "I got the job offer today!", selfReport: "fear_anxiety" }));
    expect(out.emotion.label).toBe("fear_anxiety");
    expect(out.emotion.source).toBe("self_report");
    expect(out.hint).toBeNull();
  });

  it("offers choices on distress", async () => {
    const out = await runTurn(base({ mode: "problem_solver", text: "I'm completely overwhelmed and can't cope with anything" }));
    expect(out.route).toBe("distress");
    expect(out.quickReplies.length).toBe(3);
  });
});

describe("orchestrator with a stub OpenAI-compatible provider", () => {
  let server: http.Server;
  let reply: Record<string, unknown> = {};
  let analysis: Record<string, unknown> = {};

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const parsed = JSON.parse(body);
        const isAnalysis = String(parsed.messages[0].content).startsWith("You analyse");
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(isAnalysis ? analysis : reply) } }] }));
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    process.env.LLM_API_KEY = "test";
    process.env.LLM_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server.close();
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_BASE_URL;
  });

  it("uses the model reply and fuses the model's emotion with the baseline", async () => {
    analysis = { emotion: { joy: 0.85, neutral: 0.15 }, intent: "celebrate", intent_confidence: 0.9, safety: "ordinary", explicit_plan_request: false, topic: "Got the job" };
    reply = { reply: "That's wonderful! How are you feeling about starting?", proposal: null, memory_suggestion: null };
    const out = await runTurn(base({ mode: "casual", text: "I got the job, I am so happy and excited!" }));
    expect(out.demo).toBe(false);
    expect(out.reply).toContain("wonderful");
    expect(out.emotion.label).toBe("joy");
    expect(out.hint?.label).toBe("joy");
    expect(out.topic).toBe("Got the job");
  });

  it("blocks a harmful draft with the output guard", async () => {
    analysis = { emotion: { sadness: 0.7, neutral: 0.3 }, intent: "vent", intent_confidence: 0.8, safety: "ordinary" };
    reply = { reply: "It sounds like you probably have depression.", proposal: null };
    const out = await runTurn(base({ text: "I've felt low for weeks" }));
    expect(out.outputViolations).toContain("diagnosis");
    expect(out.reply).not.toContain("depression");
  });

  it("drops proposals the strategy does not allow (never trusts the model)", async () => {
    analysis = { emotion: { neutral: 0.9 }, intent: "vent", intent_confidence: 0.9, safety: "ordinary" };
    reply = { reply: "I hear you.", proposal: { type: "task_plan", reason: "x", tasks: [{ title: "Do a thing" }] } };
    const out = await runTurn(base({ mode: "just_listen", text: "I just need to vent about my roommate" }));
    expect(out.proposals).toHaveLength(0);
  });

  it("rejects memory suggestions that contain sensitive health information", async () => {
    analysis = { emotion: { neutral: 0.9 }, intent: "reflect", intent_confidence: 0.9, safety: "ordinary" };
    reply = { reply: "Thanks for sharing.", memory_suggestion: { summary: "User has an anxiety disorder diagnosis", category: "other" } };
    const out = await runTurn(base({ memoryConsent: true, text: "Some background about me" }));
    expect(out.proposals.find((p) => p.type === "memory")).toBeUndefined();
    reply = { reply: "Noted.", memory_suggestion: { summary: "Prefers short, practical replies", category: "preference" } };
    const ok = await runTurn(base({ memoryConsent: true, text: "I like short practical answers" }));
    expect(ok.proposals.find((p) => p.type === "memory")).toBeDefined();
  });

  it("lets the model escalate the route, but not to immediate", async () => {
    analysis = { emotion: { sadness: 0.8 }, intent: "vent", intent_confidence: 0.8, safety: "concern" };
    reply = { reply: "unused" };
    const out = await runTurn(base({ text: "everything feels pointless lately and I keep thinking about not being around" }));
    expect(out.route).toBe("concern");
  });
});
