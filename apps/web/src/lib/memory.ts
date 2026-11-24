/** Small, user-scoped memory retrieval: keyword overlap plus recency. */
export type MemoryRow = { id: string; summary: string; updated_at: string; expires_at?: string | null };

const STOP = new Set("the a an and or but to of in on for with is are was were be been i me my you your it this that at as so do does did have has had not no".split(" "));
const words = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)?.filter((w) => !STOP.has(w)) ?? []);

export function selectMemories(rows: MemoryRow[], query: string, now = Date.now(), k = 5): MemoryRow[] {
  const q = words(query);
  return rows
    .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now)
    .map((r) => {
      const w = words(r.summary);
      let overlap = 0;
      for (const t of w) if (q.has(t)) overlap++;
      const ageDays = (now - new Date(r.updated_at).getTime()) / 86400000;
      return { r, score: overlap * 2 + Math.max(0, 1 - ageDays / 60) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.r);
}
