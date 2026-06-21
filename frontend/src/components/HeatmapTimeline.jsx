import React, { useMemo, useState, useRef, useEffect } from "react";
import { useStore } from "../store/useStore";
import { fmtAmount, fmtDate } from "../lib/format";
import { TID } from "../constants/testIds";

const CELL = 12;
const GAP = 2;
const STEP = CELL + GAP;
const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Five buckets, slate→amber gradient (no purple, no gradient-on-light)
const BUCKET_COLORS = [
  "rgb(15 23 42)",   // 0   slate-900
  "rgb(120 53 15)",  // 1   amber-900
  "rgb(180 83 9)",   // 2-4 amber-700
  "rgb(245 158 11)", // 5-9 amber-500
  "rgb(252 211 77)", // 10+ amber-300
];

function bucket(count) {
  if (!count) return 0;
  if (count === 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // Sunday start
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dateKeyOf(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * GitHub-contribution-style heatmap of daily transaction activity.
 * Optional `entityId` restricts to a single entity.
 */
export default function HeatmapTimeline({ entityId = null, height = 130 }) {
  const transactions = useStore((s) => s.transactions);
  const selectDate = useStore((s) => s.selectDate);
  const [hover, setHover] = useState(null);
  const scrollRef = useRef(null);

  const { byDate, minDate, maxDate, maxCount, totals } = useMemo(() => {
    const map = new Map();
    let minD = null;
    let maxD = null;
    let maxC = 0;
    let portfolioDebit = 0;
    let portfolioCredit = 0;
    for (const t of transactions) {
      if (entityId && t.entityId !== entityId) continue;
      const k = t.dateKey;
      let b = map.get(k);
      if (!b) {
        b = { count: 0, debit: 0, credit: 0, date: t.date };
        map.set(k, b);
      }
      b.count += 1;
      if (t.direction === "Debit") {
        b.debit += t.amount;
        portfolioDebit += t.amount;
      } else {
        b.credit += t.amount;
        portfolioCredit += t.amount;
      }
      if (!minD || t.date < minD) minD = t.date;
      if (!maxD || t.date > maxD) maxD = t.date;
      if (b.count > maxC) maxC = b.count;
    }
    return {
      byDate: map,
      minDate: minD,
      maxDate: maxD,
      maxCount: maxC,
      totals: { debit: portfolioDebit, credit: portfolioCredit, count: transactions.length },
    };
  }, [transactions, entityId]);

  // Auto-scroll to most recent week on first render
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [byDate]);

  if (!minDate || !maxDate) {
    return null;
  }

  // Build grid: column = week, row = day-of-week.
  const start = startOfWeek(minDate);
  const end = startOfWeek(maxDate);
  const weeksCount = Math.floor((end - start) / (7 * 86400000)) + 1;
  const width = weeksCount * STEP;

  // Month labels: render once for the first week of each month visible.
  const monthMarks = [];
  for (let w = 0; w < weeksCount; w++) {
    const cellDate = addDays(start, w * 7);
    if (cellDate.getDate() <= 7) {
      monthMarks.push({
        x: w * STEP,
        label: `${MONTH_LABELS[cellDate.getMonth()]}${cellDate.getMonth() === 0 ? " " + cellDate.getFullYear() : ""}`,
      });
    }
  }

  // Top peak day for the headline stat.
  let peak = null;
  for (const [k, v] of byDate.entries()) {
    if (!peak || v.count > peak.count) peak = { key: k, ...v };
  }

  return (
    <div
      data-testid={TID.heatmapTimeline}
      className="border border-slate-800 bg-slate-900/40"
    >
      <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-500">
            activity heatmap
          </div>
          <div className="text-[10px] font-mono text-slate-500">
            {fmtDate(minDate)} → {fmtDate(maxDate)} · {totals.count} txn
          </div>
        </div>
        {peak && (
          <div className="font-mono text-[10px] text-slate-400">
            peak day{" "}
            <button
              data-testid={TID.heatmapPeakBtn}
              onClick={() => selectDate(peak.key)}
              className="text-amber-400 hover:underline"
            >
              {peak.key}
            </button>{" "}
            · {peak.count} txn
          </div>
        )}
      </div>

      <div ref={scrollRef} className="overflow-x-auto custom-scrollbar relative">
        <svg
          width={width + 24}
          height={height}
          role="img"
          aria-label="Activity heatmap"
          className="block"
        >
          {/* Month labels */}
          {monthMarks.map((m, i) => (
            <text
              key={i}
              x={m.x + 24}
              y={10}
              fontSize="9"
              fill="rgb(148 163 184)"
              fontFamily="JetBrains Mono, monospace"
            >
              {m.label}
            </text>
          ))}

          {/* Day-of-week labels (S M T W T F S) */}
          {DOW_LABELS.map((l, i) => (
            <text
              key={i}
              x={4}
              y={18 + i * STEP + 9}
              fontSize="8"
              fill="rgb(100 116 139)"
              fontFamily="JetBrains Mono, monospace"
            >
              {i % 2 === 1 ? l : ""}
            </text>
          ))}

          {/* Cells */}
          {Array.from({ length: weeksCount }, (_, w) => (
            <g key={w} transform={`translate(${24 + w * STEP}, 18)`}>
              {Array.from({ length: 7 }, (_, d) => {
                const cellDate = addDays(start, w * 7 + d);
                if (cellDate < minDate || cellDate > maxDate) {
                  return (
                    <rect
                      key={d}
                      width={CELL}
                      height={CELL}
                      y={d * STEP}
                      fill="rgb(2 6 23)"
                      opacity="0.3"
                    />
                  );
                }
                const k = dateKeyOf(cellDate);
                const v = byDate.get(k);
                const idx = bucket(v?.count || 0);
                const color = BUCKET_COLORS[idx];
                return (
                  <rect
                    key={d}
                    data-testid={TID.heatmapCell}
                    data-date={k}
                    width={CELL}
                    height={CELL}
                    y={d * STEP}
                    fill={color}
                    style={{ cursor: v ? "pointer" : "default" }}
                    onMouseEnter={(e) =>
                      setHover({
                        key: k,
                        date: cellDate,
                        count: v?.count || 0,
                        debit: v?.debit || 0,
                        credit: v?.credit || 0,
                        x: 24 + w * STEP + CELL,
                        y: 18 + d * STEP,
                      })
                    }
                    onMouseLeave={() => setHover(null)}
                    onClick={() => v && selectDate(k)}
                  />
                );
              })}
            </g>
          ))}
        </svg>

        {hover && (
          <div
            className="absolute z-10 pointer-events-none bg-slate-950 border border-amber-500/40 px-2.5 py-1.5 font-mono text-[10px] text-slate-200 shadow-lg"
            style={{
              left: Math.min(hover.x + 8, (scrollRef.current?.scrollWidth || 9999) - 200),
              top: hover.y + 16,
            }}
          >
            <div className="text-amber-400">{fmtDate(hover.date)}</div>
            <div>{hover.count} txn</div>
            {hover.debit > 0 && (
              <div className="text-red-400">debit {fmtAmount(hover.debit, { compact: true })}</div>
            )}
            {hover.credit > 0 && (
              <div className="text-emerald-400">credit {fmtAmount(hover.credit, { compact: true })}</div>
            )}
            {hover.count > 0 && (
              <div className="text-slate-500 mt-0.5">click to drill in</div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500">
        <div>max: {maxCount} txn / day</div>
        <div className="flex items-center gap-1.5">
          <span>less</span>
          {BUCKET_COLORS.map((c, i) => (
            <span
              key={i}
              style={{ background: c, width: 10, height: 10, display: "inline-block" }}
            />
          ))}
          <span>more</span>
        </div>
      </div>
    </div>
  );
}
