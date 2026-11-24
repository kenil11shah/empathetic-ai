"use client";
import { useState } from "react";

type Point = { date: string; value: number | null };

/**
 * Accessible line chart: gaps are drawn as breaks (never zero-filled), every chart has a
 * text summary and a data-table alternative, and colours carry no good/bad judgement.
 */
export function LineChart({ title, points, min, max, color, unit }: { title: string; points: Point[]; min: number; max: number; color: string; unit: string }) {
  const [table, setTable] = useState(false);
  const W = 640, H = 180, P = { l: 32, r: 12, t: 12, b: 26 };
  const x = (i: number) => P.l + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (W - P.l - P.r));
  const y = (v: number) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);

  const segments: string[] = [];
  let cur = "";
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur) segments.push(cur);
      cur = "";
    } else cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)} `;
  });
  if (cur) segments.push(cur);

  const recorded = points.filter((p) => p.value !== null);
  const summary = recorded.length
    ? `${title}: ${recorded.length} of ${points.length} days recorded, ranging from ${Math.min(...recorded.map((p) => p.value!))} to ${Math.max(...recorded.map((p) => p.value!))} ${unit}.`
    : `${title}: no days recorded in this range.`;
  const ticks = [min, (min + max) / 2, max];
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <figure>
      <figcaption className="mb-2 flex items-baseline justify-between">
        <span className="font-medium">{title}</span>
        <button className="text-xs text-teal underline" onClick={() => setTable(!table)} aria-expanded={table}>{table ? "Show chart" : "Show data table"}</button>
      </figcaption>
      {table ? (
        <div className="max-h-56 overflow-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-canvas"><tr><th className="px-3 py-1.5 text-left font-medium">Date</th><th className="px-3 py-1.5 text-left font-medium">{title} ({unit})</th></tr></thead>
            <tbody>{points.map((p) => <tr key={p.date} className="border-t border-line"><td className="px-3 py-1">{p.date}</td><td className="px-3 py-1">{p.value ?? "no entry"}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={summary}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#DDE5E0" strokeDasharray="3 4" />
              <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6B807B">{Number.isInteger(t) ? t : t.toFixed(1)}</text>
            </g>
          ))}
          {segments.map((d, i) => <path key={i} d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}
          {points.map((p, i) => p.value !== null && <circle key={p.date} cx={x(i)} cy={y(p.value)} r="3.5" fill={color}><title>{`${p.date}: ${p.value} ${unit}`}</title></circle>)}
          {points.map((p, i) => i % labelEvery === 0 && <text key={p.date} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#6B807B">{p.date.slice(5)}</text>)}
        </svg>
      )}
      <p className="sr-only">{summary}</p>
    </figure>
  );
}

export function Bars({ items, label }: { items: { label: string; count: number }[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="space-y-2" aria-label={label}>
      {items.map((i) => (
        <li key={i.label} className="grid grid-cols-[8rem_1fr_2rem] items-center gap-2 text-sm">
          <span className="truncate text-ink-soft">{i.label}</span>
          <span className="h-2.5 rounded-full bg-canvas"><span className="block h-2.5 rounded-full bg-teal/70" style={{ width: `${(i.count / max) * 100}%` }} /></span>
          <span className="text-right tabular-nums text-muted">{i.count}</span>
        </li>
      ))}
    </ul>
  );
}
