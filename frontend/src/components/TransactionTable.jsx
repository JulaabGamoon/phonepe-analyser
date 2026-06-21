import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TID } from "../constants/testIds";
import { fmtAmount, fmtDate } from "../lib/format";
import { AlertOctagon, Asterisk } from "lucide-react";

const ROW_HEIGHT = 36;

const FLAG_LABEL = {
  same_day_duplicate: "DUP",
  repeated_amount: "REP",
  recurring_sequence: "REC",
  burst_activity: "BRST",
  multiple_transfers: "MULT",
  round_number: "RND",
  masked_account: "MASK",
  abnormal_small: "SML",
  self_transfer: "SELF",
};

export default function TransactionTable({ transactions, onRowClick, onDateClick, height = 360 }) {
  const parentRef = useRef(null);

  const rowVirtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  if (!transactions.length) {
    return (
      <div className="border border-slate-800 p-8 text-center text-xs font-mono text-slate-500">
        no transactions
      </div>
    );
  }

  return (
    <div
      data-testid={TID.transactionTable}
      className="border border-slate-800 bg-slate-900/40 flex flex-col"
    >
      <div className="grid grid-cols-[110px_1fr_160px_100px_110px_120px] bg-slate-900 border-b border-slate-800 px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
        <div>date</div>
        <div>raw name</div>
        <div>category</div>
        <div className="text-center">dir</div>
        <div className="text-right">amount</div>
        <div className="text-right">flags</div>
      </div>
      <div
        ref={parentRef}
        className="overflow-y-auto custom-scrollbar"
        style={{ height }}
      >
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((vi) => {
            const tx = transactions[vi.index];
            const isDebit = tx.direction === "Debit";
            return (
              <button
                key={tx.transactionId}
                data-testid={TID.transactionRow}
                data-tx-id={tx.transactionId}
                onClick={() => onRowClick?.(tx)}
                className="absolute left-0 right-0 grid grid-cols-[110px_1fr_160px_100px_110px_120px] items-center px-3 text-xs font-mono tabular-nums border-b border-slate-800/60 hover:bg-slate-800/60 transition-colors text-left"
                style={{
                  height: vi.size,
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                <span
                  className="text-amber-400/90 hover:text-amber-400 underline-offset-2 hover:underline"
                  onClick={(e) => {
                    if (onDateClick) {
                      e.stopPropagation();
                      onDateClick(tx.dateKey);
                    }
                  }}
                >
                  {fmtDate(tx.date)}
                </span>
                <span className="text-slate-200 truncate flex items-center gap-1.5" title={tx.nameOriginal}>
                  {tx.isMasked && <Asterisk className="w-3 h-3 text-amber-400" />}
                  {tx.nameOriginal}
                </span>
                <span className="text-slate-500 truncate">{tx.category}</span>
                <span
                  className={`text-center text-[10px] uppercase tracking-wider ${
                    isDebit ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {isDebit ? "Dr" : "Cr"}
                </span>
                <span className={`text-right ${isDebit ? "text-red-400" : "text-emerald-400"}`}>
                  {fmtAmount(tx.amount)}
                </span>
                <span className="text-right flex items-center justify-end gap-1 flex-wrap">
                  {(tx.flags || []).slice(0, 3).map((f) => (
                    <span
                      key={f}
                      className="text-[9px] tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1"
                      title={f}
                    >
                      {FLAG_LABEL[f] || f.slice(0, 4).toUpperCase()}
                    </span>
                  ))}
                  {(tx.flags || []).length > 3 && (
                    <span className="text-[9px] text-slate-500">+{tx.flags.length - 3}</span>
                  )}
                  {(tx.flags || []).length === 0 && (
                    <span className="text-slate-700">—</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
