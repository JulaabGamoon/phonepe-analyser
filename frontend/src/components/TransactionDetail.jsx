import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { TID } from "../constants/testIds";
import { fmtAmount, fmtDate, pct } from "../lib/format";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { X } from "lucide-react";

export default function TransactionDetail() {
  const txId = useStore((s) => s.selectedTransactionId);
  const tx = useStore((s) => s.txById.get(s.selectedTransactionId));
  const entity = useStore((s) => (tx ? s.entityById.get(tx.entityId) : null));
  const findings = useStore((s) => s.findings);
  const transactions = useStore((s) => s.transactions);
  const selectTransaction = useStore((s) => s.selectTransaction);
  const selectEntity = useStore((s) => s.selectEntity);
  const selectDate = useStore((s) => s.selectDate);

  const related = useMemo(() => {
    if (!tx) return { sameDay: [], sameAmount: [] };
    const sameDay = transactions
      .filter(
        (t) =>
          t.dateKey === tx.dateKey &&
          t.transactionId !== tx.transactionId
      )
      .slice(0, 20);
    const sameAmount = transactions
      .filter(
        (t) =>
          t.amount === tx.amount &&
          t.entityId === tx.entityId &&
          t.transactionId !== tx.transactionId
      )
      .slice(0, 20);
    return { sameDay, sameAmount };
  }, [tx, transactions]);

  const relatedFindings = useMemo(() => {
    if (!tx) return [];
    return findings.filter((f) => f.transactionIds.includes(tx.transactionId));
  }, [tx, findings]);

  const open = !!txId;
  const onClose = () => selectTransaction(null);

  return (
    <Sheet open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <SheetContent
        data-testid={TID.txDetail}
        side="right"
        className="w-full sm:max-w-xl bg-slate-950 border-slate-800 text-slate-100 p-0 overflow-y-auto custom-scrollbar"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-500">
              transaction · {tx?.transactionId}
            </div>
            <button
              data-testid={TID.txDetailClose}
              onClick={onClose}
              className="text-slate-500 hover:text-slate-200"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <SheetTitle className="font-heading text-xl text-slate-50 text-left mt-2">
            {tx?.nameOriginal}
          </SheetTitle>
        </SheetHeader>

        {tx && (
          <div className="px-6 py-5 space-y-6">
            <div className="grid grid-cols-2 gap-px bg-slate-800">
              <div className="bg-slate-950 p-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">date</div>
                <button
                  onClick={() => {
                    selectDate(tx.dateKey);
                    onClose();
                  }}
                  className="font-mono text-amber-400 hover:underline"
                >
                  {fmtDate(tx.date)}
                </button>
              </div>
              <div className="bg-slate-950 p-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  direction
                </div>
                <div
                  className={`font-mono ${
                    tx.direction === "Debit" ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {tx.direction}
                </div>
              </div>
              <div className="bg-slate-950 p-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  amount
                </div>
                <div
                  className={`font-mono text-lg tabular-nums ${
                    tx.direction === "Debit" ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {fmtAmount(tx.amount)}
                </div>
              </div>
              <div className="bg-slate-950 p-3">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  category
                </div>
                <div className="font-mono text-slate-200">{tx.category}</div>
              </div>
              <div className="bg-slate-950 p-3 col-span-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  resolved entity
                </div>
                <button
                  onClick={() => {
                    selectEntity(tx.entityId);
                    onClose();
                  }}
                  className="font-mono text-amber-400 hover:underline"
                >
                  {tx.entityDisplayName}
                </button>
                {entity && (
                  <div className="text-xs font-mono text-slate-500 mt-1">
                    match key: <span className="text-slate-300">{entity.matchKey || "—"}</span> ·
                    confidence {pct(entity.clusterConfidence)}
                  </div>
                )}
              </div>
            </div>

            {/* Match explanation */}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-500 mb-2">
                entity match explanation
              </div>
              <div className="text-xs font-mono text-slate-300 leading-relaxed border border-slate-800 p-3 bg-slate-900/40">
                Raw name <span className="text-slate-100">{tx.nameOriginal}</span> normalises to
                key <span className="text-amber-400">{tx.nameNormalized || "—"}</span>{" "}
                {entity?.aliasCount > 1
                  ? `and shares this key with ${entity.aliasCount - 1} other alias${
                      entity.aliasCount - 1 === 1 ? "" : "es"
                    } in the same cluster.`
                  : "and is the only alias in its cluster."}
              </div>
            </div>

            {/* Related findings */}
            {relatedFindings.length > 0 && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-500 mb-2">
                  related patterns ({relatedFindings.length})
                </div>
                <div className="space-y-1">
                  {relatedFindings.map((f) => (
                    <div
                      key={f.id}
                      className={`text-xs font-mono p-2 border-l-2 bg-slate-900/40 border-y border-r border-slate-800 ${
                        f.severity === "high"
                          ? "border-l-red-500"
                          : f.severity === "medium"
                          ? "border-l-amber-500"
                          : "border-l-blue-500"
                      }`}
                    >
                      <div className="text-slate-200">{f.label}</div>
                      <div className="text-slate-500 mt-1 leading-relaxed">{f.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Same-day peers */}
            {related.sameDay.length > 0 && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-500 mb-2">
                  same-day peers ({related.sameDay.length})
                </div>
                <div className="border border-slate-800 divide-y divide-slate-800/60">
                  {related.sameDay.map((r) => (
                    <button
                      key={r.transactionId}
                      onClick={() => selectTransaction(r.transactionId)}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-800/60 grid grid-cols-[1fr_auto] gap-3 text-xs font-mono"
                    >
                      <span className="truncate text-slate-300">{r.nameOriginal}</span>
                      <span
                        className={`text-right ${
                          r.direction === "Debit" ? "text-red-400" : "text-emerald-400"
                        }`}
                      >
                        {fmtAmount(r.amount)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Same-amount history */}
            {related.sameAmount.length > 0 && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-500 mb-2">
                  same-amount history at this entity ({related.sameAmount.length})
                </div>
                <div className="border border-slate-800 divide-y divide-slate-800/60">
                  {related.sameAmount.map((r) => (
                    <div
                      key={r.transactionId}
                      className="px-3 py-1.5 grid grid-cols-[1fr_auto] gap-3 text-xs font-mono"
                    >
                      <span className="text-slate-300">{fmtDate(r.date)}</span>
                      <span
                        className={
                          r.direction === "Debit" ? "text-red-400" : "text-emerald-400"
                        }
                      >
                        {fmtAmount(r.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw row */}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-500 mb-2">
                raw csv row · index {tx.sourceRowIndex}
              </div>
              <pre className="text-[11px] font-mono text-slate-400 bg-slate-900/60 border border-slate-800 p-3 overflow-x-auto custom-scrollbar">
                {JSON.stringify(tx.rawRow, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
