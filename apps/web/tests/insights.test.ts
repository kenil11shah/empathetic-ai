import { describe, expect, it } from "vitest";
import { buildInsights, dailySeries, dateRange } from "@/lib/insights";
import { selectMemories } from "@/lib/memory";

describe("insights", () => {
  it("never fills missing days with zero", () => {
    const s = dailySeries([{ local_date: "2026-11-23", mood: 4, stress: 3, energy: 6 }], dateRange("2026-11-24", 3));
    expect(s.map((d) => d.mood)).toEqual([null, 4, null]);
  });

  it("averages multiple check-ins per day before anything else", () => {
    const s = dailySeries(
      [
        { local_date: "2026-11-24", mood: 2, stress: 8, energy: 3 },
        { local_date: "2026-11-24", mood: 4, stress: 4, energy: 5 },
      ],
      ["2026-11-24"],
    );
    expect(s[0]).toMatchObject({ mood: 3, stress: 6, energy: 4, n: 2 });
  });

  it("requires three distinct days before trend commentary", () => {
    const two = buildInsights(
      [
        { local_date: "2026-11-23", mood: 2, stress: 8, energy: 3 },
        { local_date: "2026-11-24", mood: 4, stress: 3, energy: 6 },
      ],
      "2026-11-24",
      "7d",
    );
    expect(two.sufficient_data).toBe(false);
    expect(two.observations).toHaveLength(0);
  });

  it("phrases comparisons as observations with sample counts", () => {
    const rows = [
      { local_date: "2026-11-18", mood: 4, stress: 2, energy: 6 },
      { local_date: "2026-11-19", mood: 2, stress: 8, energy: 4 },
      { local_date: "2026-11-20", mood: 5, stress: 3, energy: 7 },
      { local_date: "2026-11-21", mood: 2, stress: 9, energy: 3 },
      { local_date: "2026-11-22", mood: 4, stress: 2, energy: 6 },
      { local_date: "2026-11-23", mood: 1, stress: 8, energy: 2 },
    ];
    const r = buildInsights(rows, "2026-11-24", "7d");
    expect(r.sufficient_data).toBe(true);
    const text = r.observations.map((o) => o.text).join(" ");
    expect(text).toMatch(/lower stress.*higher/);
    expect(text).toMatch(/not an explanation of cause/);
  });
});

describe("memory retrieval", () => {
  it("prefers relevant, unexpired memories", () => {
    const now = Date.parse("2026-11-24T00:00:00Z");
    const rows = [
      { id: "1", summary: "Prefers short replies", updated_at: "2026-11-01T00:00:00Z" },
      { id: "2", summary: "Preparing for the GRE exam in December", updated_at: "2026-10-01T00:00:00Z" },
      { id: "3", summary: "Exam stress helped by walks", updated_at: "2026-11-20T00:00:00Z", expires_at: "2026-11-21T00:00:00Z" },
    ];
    const top = selectMemories(rows, "I'm worried about my exam", now, 2);
    expect(top[0].id).toBe("2");
    expect(top.find((r) => r.id === "3")).toBeUndefined();
  });
});
