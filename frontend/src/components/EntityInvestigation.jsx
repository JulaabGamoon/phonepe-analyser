import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { TID } from "../constants/testIds";
import { fmtAmount, fmtDate, pct } from "../lib/format";
import { Pin, ChevronRight, Hash, Calendar, TrendingDown, TrendingUp } from "lucide-react";
import TransactionTable from "./TransactionTable";
import DateDrillDown from "./DateDrillDown";
import HeatmapTimeline from "./HeatmapTimeline";

function MetricCard({ label, value, sub, tone = "default" }) {
  const toneClass =
    tone === "negative" ? "text-red-400" : tone === "positive" ? "text-emerald-400" : "text-slate-50";
  return (
    <div
      data-testid={TID.metricCard}
      className="p-4 border-r border-b border-slate-800 flex flex-col gap-1 bg-slate-900/30"
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className={`font-mono text-xl tracking-tight tabular-nums ${toneClass}`}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-slate-500">{sub}</div>}
    </div>
  );
}

function BreakdownTable({ title, rows, testId, onRowClick }) {
  if (!rows.length) return null;
  return (
    <div data-testid={testId} className="border border-slate-800 bg-slate-900/30">
      <div className="px-3 py-2 border-b border-slate-800 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-500">
        {title}
      </div>
      <table className="w-full text-xs">
        <thead className="bg-slate-900/60">
          <tr className="text-slate-500 font-mono uppercase tracking-wider">
            <th className="text-left px-3 py-1.5 font-normal">period</th>
            <th className="text-right px-3 py-1.5 font-normal">count</th>
            <th className="text-right px-3 py-1.5 font-normal">debit</th>
            <th className="text-right px-3 py-1.5 font-normal">credit</th>
            <th className="text-right px-3 py-1.5 font-normal">net</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              onClick={() => onRowClick?.(r)}
              className="border-t border-slate-800/60 hover:bg-slate-800/40 cursor-pointer font-mono tabular-nums"
            >
              <td className="px-3 py-1.5 text-slate-200">{r.key}</td>
              <td className="px-3 py-1.5 text-right text-slate-400">{r.count}</td>
              <td className="px-3 py-1.5 text-right text-red-400">
                {r.debit ? fmtAmount(r.debit, { compact: true }) : "—"}
              </td>
              <td className="px-3 py-1.5 text-right text-emerald-400">
                {r.credit ? fmtAmount(r.credit, { compact: true }) : "—"}
              </td>
              <td
                className={`px-3 py-1.5 text-right ${
                  r.net < 0 ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {fmtAmount(r.net, { compact: true, signed: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EntityInvestigation() {
  const entity = useStore((s) => s.entityById.get(s.selectedEntityId));
  const transactions = useStore((s) => s.transactions);
  const filters = useStore((s) => s.filters);
  const selectedDateKey = useStore((s) => s.selectedDateKey);
  const selectDate = useStore((s) => s.selectDate);
  const pinned = useStore((s) => s.pinnedEntities);
  const pinEntity = useStore((s) => s.pinEntity);
  const notes = useStore((s) => s.notes);
  const setNote = useStore((s) => s.setNote);
  const selectTransaction = useStore((s) => s.selectTransaction);

  const entityTxs = useMemo(() => {
    if (!entity) return [];
    let list = transactions.filter((t) => t.entityId === entity.entityId);
    if (filters.direction === "Debit") list = list.filter((t) => t.direction === "Debit");
    else if (filters.direction === "Credit") list = list.filter((t) => t.direction === "Credit");
    return list.sort((a, b) => a.date - b.date);
  }, [entity, transactions, filters.direction]);

  if (!entity) {
    return (
      <div className="flex-1 flex items-center justify-center grid-overlay">
        <div className="text-center max-w-md">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-500 mb-3">
            no entity selected
          </div>
          <h2 className="font-heading text-2xl text-slate-200">
            Select an entity to begin the investigation.
          </h2>
          <p className="text-sm text-slate-500 mt-3 font-mono">
            Entities are ranked by activity in the left panel. Click one to see aliases, timelines,
            and patterns.
          </p>
        </div>
      </div>
    );
  }

  if (selectedDateKey) {
    return <DateDrillDown dateKey={selectedDateKey} />;
  }

  const yearly = Array.from(entity.byYear?.values?.() ?? []).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const monthly = Array.from(entity.byMonth?.values?.() ?? []).sort((a, b) => a.key.localeCompare(b.key));
  const isPinned = pinned.includes(entity.entityId);
  const isSelfTransfer = entityTxs.some((t) => (t.flags || []).includes("self_transfer"));

  return (
    <section
      data-testid={TID.entityInvestigation}
      className="flex-1 flex flex-col min-w-0 overflow-hidden"
    >
      {/* Header */}
      <div
        data-testid={TID.entityHeader}
        className="h-auto border-b border-slate-800 bg-slate-900/60 px-6 py-4 flex items-start justify-between gap-4 shrink-0"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 mb-1">
            <Hash className="w-3 h-3" />
            entity · {entity.matchKey || "—"}
          </div>
          <h1 className="font-heading text-2xl text-slate-50 truncate" title={entity.displayName}>
            {entity.displayName}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-xs font-mono text-slate-400">
            <span>{entity.aliasCount} alias{entity.aliasCount === 1 ? "" : "es"}</span>
            <span className="text-slate-700">·</span>
            <span className="text-amber-400">cluster confidence {pct(entity.clusterConfidence)}</span>
            {entity.isMasked && (
              <span className="text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 uppercase tracking-wider">
                masked acct
              </span>
            )}
            {entity.suspiciousScore >= 3 && (
              <span className="text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 uppercase tracking-wider">
                high-risk
              </span>
            )}
          </div>
        </div>
        <button
          data-testid={TID.pinBtn}
          onClick={() => pinEntity(entity.entityId)}
          className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-mono uppercase tracking-wider transition-colors ${
            isPinned
              ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
              : "border-slate-800 text-slate-400 hover:text-amber-400 hover:border-amber-500/40"
          }`}
        >
          <Pin className="w-3.5 h-3.5" />
          {isPinned ? "pinned" : "pin"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Entity-specific activity heatmap */}
        <div className="px-6 pt-5">
          <HeatmapTimeline entityId={entity.entityId} />
        </div>

        {/* Metric grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 border-l border-t border-slate-800 mt-6">
          <MetricCard label="transactions" value={entity.txCount} />
          <MetricCard
            label="total debit"
            value={fmtAmount(entity.totalDebit)}
            tone="negative"
          />
          <MetricCard
            label="total credit"
            value={fmtAmount(entity.totalCredit)}
            tone="positive"
          />
          <MetricCard
            label="net flow"
            value={fmtAmount(entity.netFlow, { signed: true })}
            tone={entity.netFlow < 0 ? "negative" : "positive"}
          />
          <MetricCard
            label="highest txn"
            value={fmtAmount(entity.highestTxAmount)}
          />
          <MetricCard
            label="activity span"
            value={`${fmtDate(entity.firstDate)}`}
            sub={`→ ${fmtDate(entity.lastDate)}`}
          />
        </div>

        {/* Breakdowns */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BreakdownTable
              title="yearly breakdown"
              rows={yearly}
              testId={TID.yearlyBreakdown}
              onRowClick={null}
            />
            <BreakdownTable
              title="monthly breakdown"
              rows={monthly}
              testId={TID.monthlyBreakdown}
              onRowClick={null}
            />
          </div>

          {/* Transactions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-500 flex items-center gap-2">
                <span>transactions · {entityTxs.length}</span>
                {filters.direction !== "all" && (
                  <span className="text-[9px] tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 normal-case">
                    filter: {filters.direction.toLowerCase()} only · {entity.txCount - entityTxs.length} hidden
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono text-slate-500 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-red-400" />
                  debit
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  credit
                </span>
              </div>
            </div>
            <TransactionTable
              transactions={entityTxs}
              onRowClick={(tx) => selectTransaction(tx.transactionId)}
              onDateClick={(dateKey) => selectDate(dateKey)}
            />
          </div>

          {/* Notes */}
          <div className="border border-slate-800 bg-slate-900/30">
            <div className="px-3 py-2 border-b border-slate-800 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-500">
              investigator notes
            </div>
            <textarea
              data-testid={TID.noteTextarea}
              value={notes[entity.entityId] || ""}
              onChange={(e) => setNote(entity.entityId, e.target.value)}
              placeholder="What did you find? Suspicions, follow-ups, evidence…"
              className="w-full bg-transparent p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none resize-none font-mono leading-relaxed"
              rows={4}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
