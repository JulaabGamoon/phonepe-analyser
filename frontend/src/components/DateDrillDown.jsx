import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { TID } from "../constants/testIds";
import { fmtAmount, fmtDate } from "../lib/format";
import { ArrowLeft } from "lucide-react";

export default function DateDrillDown({ dateKey }) {
  const transactions = useStore((s) => s.transactions);
  const selectDate = useStore((s) => s.selectDate);
  const selectTransaction = useStore((s) => s.selectTransaction);
  const selectEntity = useStore((s) => s.selectEntity);

  const dayTxs = useMemo(
    () =>
      transactions
        .filter((t) => t.dateKey === dateKey)
        .sort((a, b) => (a.sourceRowIndex || 0) - (b.sourceRowIndex || 0)),
    [transactions, dateKey]
  );

  const totals = useMemo(() => {
    let debit = 0,
      credit = 0;
    for (const t of dayTxs) {
      if (t.direction === "Debit") debit += t.amount;
      else credit += t.amount;
    }
    return { debit, credit, count: dayTxs.length };
  }, [dayTxs]);

  return (
    <section
      data-testid={TID.dateDrilldown}
      className="flex-1 flex flex-col min-w-0 overflow-hidden"
    >
      <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <button
            data-testid={TID.dateBackBtn}
            onClick={() => selectDate(null)}
            className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-amber-400 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            back to entity
          </button>
          <h1 className="font-heading text-2xl text-slate-50">{fmtDate(new Date(dateKey))}</h1>
          <div className="text-xs font-mono text-slate-400 mt-1">
            cross-entity activity for {dateKey}
          </div>
        </div>
        <div className="flex gap-6 font-mono text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">count</div>
            <div className="text-slate-100 text-lg">{totals.count}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">debit</div>
            <div className="text-red-400 text-lg">{fmtAmount(totals.debit, { compact: true })}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">credit</div>
            <div className="text-emerald-400 text-lg">
              {fmtAmount(totals.credit, { compact: true })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="border border-slate-800 bg-slate-900/40">
          <div className="grid grid-cols-[1fr_180px_100px_140px_120px] bg-slate-900 border-b border-slate-800 px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
            <div>raw name → entity</div>
            <div>category</div>
            <div className="text-center">dir</div>
            <div className="text-right">amount</div>
            <div className="text-right">flags</div>
          </div>
          {dayTxs.length === 0 && (
            <div className="p-8 text-center text-xs font-mono text-slate-500">
              no transactions on this date
            </div>
          )}
          {dayTxs.map((tx) => (
            <div
              key={tx.transactionId}
              data-testid={TID.dateRow}
              className="grid grid-cols-[1fr_180px_100px_140px_120px] items-center px-3 py-2 text-xs font-mono tabular-nums border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer"
              onClick={() => selectTransaction(tx.transactionId)}
            >
              <div className="min-w-0 truncate">
                <span className="text-slate-200">{tx.nameOriginal}</span>
                <span className="text-slate-600 mx-2">→</span>
                <button
                  className="text-amber-400 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectEntity(tx.entityId);
                    selectDate(null);
                  }}
                >
                  {tx.entityDisplayName}
                </button>
              </div>
              <div className="text-slate-500 truncate">{tx.category}</div>
              <div
                className={`text-center text-[10px] uppercase tracking-wider ${
                  tx.direction === "Debit" ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {tx.direction === "Debit" ? "Dr" : "Cr"}
              </div>
              <div
                className={`text-right ${
                  tx.direction === "Debit" ? "text-red-400" : "text-emerald-400"
                }`}
              >
                {fmtAmount(tx.amount)}
              </div>
              <div className="text-right text-[10px] text-amber-400">
                {(tx.flags || []).join(" ") || "—"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
