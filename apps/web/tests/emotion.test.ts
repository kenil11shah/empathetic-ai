import { describe, expect, it } from "vitest";
import fixtures from "@/lib/emotion/model/text-baseline.fixtures.json";
import { predictBaseline } from "@/lib/emotion/baseline";
import { fuse, shouldShowHint } from "@/lib/emotion/fusion";
import { EMOTIONS } from "@/lib/constants";

describe("TF-IDF + LR runtime parity with scikit-learn", () => {
  for (const f of fixtures as { text: string; probs: number[] }[]) {
    it(`matches sklearn for: ${f.text}`, () => {
      const p = predictBaseline(f.text).probs;
      EMOTIONS.forEach((e, i) => expect(Math.abs(p[e] - f.probs[i])).toBeLessThan(0.002));
    });
  }
});

describe("fusion and abstention", () => {
  it("fuses agreeing signals", () => {
    const f = fuse([
      { source: "tfidf_lr", probs: { joy: 0.7, neutral: 0.3 }, quality: 1 },
      { source: "llm_zero_shot", probs: { joy: 0.8, neutral: 0.2 }, quality: 1 },
    ]);
    expect(f.label).toBe("joy");
    expect(f.abstained).toBe(false);
  });

  it("abstains when confident modalities disagree", () => {
    const f = fuse([
      { source: "tfidf_lr", probs: { anger: 0.9, neutral: 0.1 }, quality: 1 },
      { source: "llm_zero_shot", probs: { sadness: 0.9, neutral: 0.1 }, quality: 1 },
    ]);
    expect(f.disagreement).toBe(true);
    expect(f.label).toBe("mixed_unknown");
  });

  it("abstains on low-quality input (noise)", () => {
    const f = fuse([{ source: "tfidf_lr", probs: { joy: 0.9 }, quality: 0.05 }]);
    expect(f.label).toBe("mixed_unknown");
  });

  it("treats a user correction as authoritative", () => {
    const f = fuse([{ source: "tfidf_lr", probs: { joy: 0.9, neutral: 0.1 }, quality: 1 }], "sadness");
    expect(f.label).toBe("sadness");
    expect(f.source).toBe("self_report");
  });

  it("does not repeat the same hint", () => {
    const f = fuse([{ source: "llm_zero_shot", probs: { frustration: 0.8, neutral: 0.2 }, quality: 1 }]);
    expect(shouldShowHint(f, [])).toBe(true);
    expect(shouldShowHint(f, ["frustration"])).toBe(false);
  });
});
