/**
 * Deterministic demo responder used when no LLM key is configured. Every reply produced
 * here is labelled "Demo mode" in the UI. It exists so the full flow (safety, emotion,
 * proposals, approval) can be exercised without credentials.
 */
import { EMOTION_LABEL, type EmotionOrUnknown } from "@/lib/constants";
import type { Strategy } from "@/lib/ai/strategy";

function firstClause(text: string) {
  const s = text.replace(/\s+/g, " ").trim().split(/[.!?]/)[0] ?? "";
  return s.length > 90 ? s.slice(0, 87) + "..." : s;
}

export function mockReply(text: string, strategy: Strategy, emotion: EmotionOrUnknown) {
  const feeling = emotion !== "mixed_unknown" && emotion !== "neutral" ? EMOTION_LABEL[emotion] : null;
  const echo = firstClause(text);
  const feel = feeling ? `It sounds like there might be some ${feeling} in this.` : "Thank you for sharing that with me.";
  const replies: Record<Strategy["id"], string> = {
    reflective_listening: `${feel} You said "${echo}". I'm listening, so take your time and tell me more if you'd like.`,
    socratic_questions: `${feel} What part of this feels most important to you right now? And what would "a bit better" look like?`,
    problem_solving: `${feel} One way to approach it could be to write down everything on your plate, pick the single most urgent item, and decide on one small first step. Which of those feels most doable?`,
    realistic_encouragement: `${feel} The fact that you're thinking this through shows real effort. What's one small thing you could do in the next hour that future-you would thank you for?`,
    reflection_prompts: `${feel} A prompt you might sit with: when did you last feel this way, and what helped then? What do you think this feeling is asking for?`,
    casual_chat: `Hey! Nice to hear from you. What's been the best part of your day so far?`,
    gentle_grounding: `${feel} If you'd like, try this: breathe in gently for about four counts and out for about six, a few times. You can stop whenever you want. How does your body feel right now?`,
    celebrate: `That's wonderful news! You should feel proud. What do you think made it possible?`,
    distress_support: `${feel} That sounds really hard, and it makes sense that it's weighing on you. Would it help more if I just listened, if we thought it through together, or if we tried something calming?`,
    supportive_clarification: `I want to make sure I understand you. When you say "${echo}", can you tell me a bit more about what you mean and how you're doing right now? Talking to someone you trust or a helpline is always an option too.`,
  };
  let reply = replies[strategy.id];
  if (strategy.askClarification) reply += " What would help most right now: being heard, or working out a next step?";

  let proposal: Record<string, unknown> | null = null;
  if (strategy.allowTaskProposal) {
    proposal = {
      type: "task_plan",
      reason: "A few small steps can make a big load feel more manageable.",
      tasks: [
        { title: "Write down everything on my plate (10 minutes)", due_date: null },
        { title: "Pick the most urgent item and one small first step", due_date: null },
        { title: "Take a short break away from screens", due_date: null },
      ],
    };
  } else if (strategy.allowJournalProposal && text.length > 60) {
    proposal = {
      type: "journal_entry",
      reason: "You reflected on something that might be worth keeping.",
      title: "Reflection",
      body: text,
      tags: ["reflection"],
    };
  }
  return { reply, proposal, memory_suggestion: null as Record<string, unknown> | null };
}
