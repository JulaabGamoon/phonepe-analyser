import React, { useState, useCallback } from "react";
import { Upload as UploadIcon, FileText, AlertTriangle, Sparkles } from "lucide-react";
import { parseCsvFile, parseCsvString } from "../lib/parser";
import { SAMPLE_CSV } from "../lib/sampleData";
import { useStore } from "../store/useStore";
import { TID } from "../constants/testIds";
import { toast } from "sonner";

export default function UploadView() {
  const loadTransactions = useStore((s) => s.loadTransactions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file) => {
      setBusy(true);
      setError(null);
      try {
        const { transactions, errors } = await parseCsvFile(file);
        if (!transactions.length) {
          setError("No valid transactions found in this file.");
          setBusy(false);
          return;
        }
        loadTransactions(transactions, errors, file.name);
        toast.success(`Parsed ${transactions.length.toLocaleString()} transactions`, {
          description: errors.length ? `${errors.length} row(s) skipped — see error report.` : undefined,
        });
      } catch (e) {
        setError(e?.message || "Failed to parse CSV.");
      } finally {
        setBusy(false);
      }
    },
    [loadTransactions]
  );

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const loadSample = async () => {
    setBusy(true);
    setError(null);
    try {
      const { transactions, errors } = await parseCsvString(SAMPLE_CSV);
      loadTransactions(transactions, errors, "sample-bank-statement.csv");
      toast.success(`Sample loaded — ${transactions.length} transactions`);
    } catch (e) {
      setError(e?.message || "Failed to load sample.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full w-full grid-overlay flex items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        <div className="mb-10">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-amber-500 mb-3">
            ledger / lens
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-slate-50 leading-tight">
            Forensic CSV review,
            <br />
            <span className="text-amber-500">entity-first.</span>
          </h1>
          <p className="text-slate-400 mt-4 max-w-xl text-sm leading-relaxed">
            Upload a bank statement CSV. We resolve aliases into entities, surface duplicates,
            round-number transfers, masked accounts and recurring patterns — all in your browser.
          </p>
        </div>

        <label
          data-testid={TID.uploadDropzone}
          htmlFor="csv-file-input"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`block border-2 border-dashed cursor-pointer transition-colors px-6 py-12 text-center ${
            dragOver
              ? "border-amber-500 bg-amber-500/5"
              : "border-slate-800 hover:border-slate-700 bg-slate-900/40"
          }`}
        >
          <input
            id="csv-file-input"
            data-testid={TID.uploadInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onPick}
            disabled={busy}
          />
          <UploadIcon className="w-7 h-7 mx-auto text-slate-500 mb-4" strokeWidth={1.5} />
          <div className="font-mono text-sm text-slate-300">
            {busy ? "Parsing…" : "Drop CSV here or click to browse"}
          </div>
          <div className="font-mono text-xs text-slate-500 mt-2">
            Required columns: Date, Name, Debit/Credit, Amount, Category
          </div>
        </label>

        <div className="mt-6 flex items-center gap-3">
          <button
            data-testid={TID.loadSampleBtn}
            onClick={loadSample}
            disabled={busy}
            className="inline-flex items-center gap-2 bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 disabled:opacity-50 px-4 py-2 text-sm font-mono uppercase tracking-wider transition-colors"
          >
            <Sparkles className="w-4 h-4" strokeWidth={2} />
            Load sample data
          </button>
          <span className="text-xs text-slate-500 font-mono">
            instant demo · 40 rows · spec aliases included
          </span>
        </div>

        {error && (
          <div
            data-testid={TID.parseError}
            className="mt-6 p-4 border border-red-500/30 bg-red-500/5 text-red-300 text-sm flex items-start gap-3"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-mono uppercase text-xs tracking-wider text-red-400">
                upload error
              </div>
              <div className="mt-1">{error}</div>
            </div>
          </div>
        )}

        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-800">
          {[
            ["entities", "resolved + scored"],
            ["timelines", "yearly · monthly · daily"],
            ["patterns", "duplicates · bursts · recurring"],
            ["exports", "csv + json snapshots"],
          ].map(([title, sub]) => (
            <div key={title} className="bg-slate-950 p-4">
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-amber-500">
                {title}
              </div>
              <div className="text-xs text-slate-500 mt-2 font-mono">{sub}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center gap-2 text-xs text-slate-500 font-mono">
          <FileText className="w-3.5 h-3.5" />
          100% client-side · nothing is uploaded · localStorage persists your overrides
        </div>
      </div>
    </div>
  );
}
