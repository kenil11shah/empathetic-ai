export type Activity = {
  id: string;
  title: string;
  minutes: number;
  summary: string;
  steps: string[];
  accessibility: string;
};

/** Curated, non-clinical activities. No breath-holding, no promises of relief. */
export const ACTIVITIES: Activity[] = [
  {
    id: "paced-breathing",
    title: "Paced breathing",
    minutes: 3,
    summary: "Slow, comfortable breaths with a slightly longer out-breath.",
    steps: [
      "Sit or lie in a position that feels okay for you.",
      "Breathe in gently through your nose for about 4 counts.",
      "Breathe out slowly for about 6 counts. No need to hold your breath.",
      "Keep going at your own pace. If it feels uncomfortable, return to normal breathing.",
    ],
    accessibility: "Counts are a guide, not a rule. Breathe in whatever way is comfortable.",
  },
  {
    id: "grounding-54321",
    title: "5-4-3-2-1 grounding",
    minutes: 4,
    summary: "Gently bring attention to your surroundings using your senses.",
    steps: [
      "Notice 5 things you can see.",
      "Notice 4 things you can feel, like your feet on the floor.",
      "Notice 3 things you can hear.",
      "Notice 2 things you can smell, or two scents you like.",
      "Notice 1 thing you can taste, or one kind thing you could say to yourself.",
    ],
    accessibility: "Skip or swap any sense that doesn't work for you.",
  },
  {
    id: "body-check",
    title: "Short body check-in",
    minutes: 5,
    summary: "Move attention slowly from head to toe, just noticing.",
    steps: [
      "Start at the top of your head and notice any sensations.",
      "Move slowly through your face, shoulders, arms and hands.",
      "Continue through your chest, stomach, legs and feet.",
      "If you notice tension, you can let it be, or gently relax it.",
    ],
    accessibility: "You can keep your eyes open and stop at any time.",
  },
  {
    id: "two-minute-reflection",
    title: "Two-minute reflection",
    minutes: 2,
    summary: "A quick pause to name what's going on.",
    steps: [
      "What is one thing on your mind right now?",
      "What are you feeling about it, in a word or two?",
      "What is one small thing that might help, even a little?",
    ],
    accessibility: "You can answer in your head, out loud or in your journal.",
  },
  {
    id: "movement-break",
    title: "Stretch or walk break",
    minutes: 5,
    summary: "Step away from the screen and move in a way that suits your body.",
    steps: [
      "Stand up or shift position if you can.",
      "Gently stretch your neck, shoulders and back, only as far as is comfortable.",
      "If possible, take a short walk, even just around the room.",
      "Notice how your body feels afterwards.",
    ],
    accessibility: "Seated stretches work too. Skip anything that causes pain.",
  },
  {
    id: "gratitude-moment",
    title: "A good moment",
    minutes: 3,
    summary: "Recall one moment, big or small, that felt okay. It's fine if nothing comes to mind.",
    steps: [
      "Think of one moment from today or this week that felt okay or good.",
      "What was happening? Who or what was there?",
      "If you'd like, save it in your journal.",
    ],
    accessibility: "There's no need to feel positive. Noticing is enough.",
  },
];
