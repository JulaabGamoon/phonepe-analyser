import React from "react";
import { useStore } from "../store/useStore";
import { TID } from "../constants/testIds";
import { Download, FileText, RotateCcw, AlertTriangle, ScanLine } from "lucide-react";
import {
  exportTransactionsCsv,
  exportInvestigationJson,
  exportErrorReport,
} from "../lib/exporter";
import { toast } from "sonner";

export default function Header() {
  const fileName = useStore((s) => s.fileName);
  const parseErrors = useStore((s) => s.parseErrors);
  const transactions = useStore((s) => s.transactions);
  const entities = useStore((s) => s.entities);
  const findings = useStore((s) => s.findings);
  const filters = useStore((s) => s.filters);
  const selectedEntityId = useStore((s) => s.selectedEntityId);
  const selectedDateKey = useStore((s) => s.selectedDateKey);
  const manualMerges = useStore((s) => s.manualMerges);
  const ignoredAliases = useStore((s) => s.ignoredAliases);
  const notes = useStore((s) => s.notes);
  const reviewedFindings = useStore((s) => s.reviewedFindings);
  const clearData = useStore((s) => s.clearData);

  const onExportCsv = () => {
    exportTransactionsCsv(transactions, `ledger-lens-${Date.now()}.csv`);
    toast.success("CSV downloaded");
  };

  const onExportJson = () => {
    const snapshot = {
      fileName,
      portfolio: {
        txCount: transactions.length,
        entityCount: entities.length,
      },
      filters,
      selection: { selectedEntityId, selectedDateKey },
      entities: entities.map((e) => ({
        entityId: e.entityId,
        displayName: e.displayName,
        matchKey: e.matchKey,
        aliasCount: e.aliasCount,
        clusterConfidence: e.clusterConfidence,
        suspiciousScore: e.suspiciousScore,
        txCount: e.txCount,
        totalDebit: e.totalDebit,
        totalCredit: e.totalCredit,
        netFlow: e.netFlow,
        firstDate: e.firstDate,
        lastDate: e.lastDate,
        aliases: e.aliases,
        isMasked: e.isMasked,
        byYear: e.byYear,
        byMonth: e.byMonth,
      })),
      transactions: transactions.map((t) => ({
        transactionId: t.transactionId,
        date: t.dateKey,
        nameOriginal: t.nameOriginal,
        entityId: t.entityId,
        entityDisplayName: t.entityDisplayName,
        direction: t.direction,
        amount: t.amount,
        category: t.category,
        flags: t.flags,
        sourceRowIndex: t.sourceRowIndex,
      })),
      findings,
      manualMerges,
      ignoredAliases,
      notes,
      reviewedFindings,
    };
    exportInvestigationJson(snapshot, `ledger-lens-${Date.now()}.json`);
    toast.success("JSON snapshot downloaded");
  };

  const onErrorReport = () => {
    if (!parseErrors.length) return;
    exportErrorReport(parseErrors, "ledger-lens-errors.csv");
    toast.info(`Error report downloaded (${parseErrors.length} rows)`);
  };

  return (
    <header
      data-testid={TID.appHeader}
      className="h-14 border-b border-slate-800 bg-slate-950/90 backdrop-blur flex items-center justify-between px-4 shrink-0"
    >
      <div className="flex items-center gap-3 min-w-0">
        <ScanLine className="w-5 h-5 text-amber-500" strokeWidth={1.5} />
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-500 hidden sm:block">
          ledger / lens
        </div>
        <div className="h-5 w-px bg-slate-800 hidden sm:block" />
        <div className="font-mono text-xs text-slate-400 truncate" title={fileName}>
          {fileName}
        </div>
        <div className="font-mono text-[10px] text-slate-600 hidden md:flex items-center gap-3 ml-2">
          <span>{transactions.length.toLocaleString()} txn</span>
          <span>·</span>
          <span>{entities.length} entities</span>
          <span>·</span>
          <span className={findings.length ? "text-amber-400" : ""}>{findings.length} findings</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {parseErrors.length > 0 && (
          <button
            data-testid={TID.errorReportBtn}
            onClick={onErrorReport}
            className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-red-400 hover:text-red-300 px-2 py-1.5 border border-red-500/30"
            title="Download error report"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {parseErrors.length} errors
          </button>
        )}
        <button
          data-testid={TID.exportCsvBtn}
          onClick={onExportCsv}
          className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-300 hover:text-amber-400 px-2.5 py-1.5 border border-slate-800 hover:border-amber-500/40 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          csv
        </button>
        <button
          data-testid={TID.exportJsonBtn}
          onClick={onExportJson}
          className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-300 hover:text-amber-400 px-2.5 py-1.5 border border-slate-800 hover:border-amber-500/40 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          json
        </button>
        <button
          data-testid={TID.resetBtn}
          onClick={() => {
            if (window.confirm("Clear the current file and return to upload?")) clearData();
          }}
          className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-500 hover:text-red-400 px-2.5 py-1.5 border border-slate-800 hover:border-red-500/40 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          reset
        </button>
      </div>
    </header>
  );
}
