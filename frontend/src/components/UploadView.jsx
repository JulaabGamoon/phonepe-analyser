import React, { useState, useCallback } from "react";
import {
  Upload as UploadIcon,
  FileText,
  AlertTriangle,
  Sparkles,
  Lock,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { parseCsvFile, parseCsvString } from "../lib/parser";
import { parsePdfFile, PdfErrors } from "../lib/pdfParser";
import { SAMPLE_CSV } from "../lib/sampleData";
import { useStore } from "../store/useStore";
import { TID } from "../constants/testIds";
import { toast } from "sonner";

export default function UploadView() {
  const loadTransactions = useStore((s) => s.loadTransactions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  // PDF password flow
  const [pendingPdf, setPendingPdf] = useState(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState(null);

  const finishLoad = useCallback(
    (transactions, errors, fileName) => {
      if (!transactions.length) {
        setError("No valid transactions found in this file.");
        setBusy(false);
        return;
      }
      loadTransactions(transactions, errors, fileName);
      toast.success(`Parsed ${transactions.length.toLocaleString()} transactions`, {
        description: errors.length
          ? `${errors.length} row(s) skipped — see error report.`
          : undefined,
      });
    },
    [loadTransactions]
  );

  const tryParsePdf = useCallback(
    async (file, pwd) => {
      setBusy(true);
      setError(null);
      setPasswordError(null);
      try {
        const { transactions, errors } = await parsePdfFile(file, { password: pwd });
        setPendingPdf(null);
        setPassword("");
        finishLoad(transactions, errors, file.name);
      } catch (e) {
        if (e?.code === PdfErrors.PASSWORD_REQUIRED) {
          setPendingPdf(file);
          setBusy(false);
        } else if (e?.code === PdfErrors.INCORRECT_PASSWORD) {
          setPendingPdf(file);
          setPasswordError("Incorrect password — try again.");
          setBusy(false);
        } else {
          setError(e?.message || "Failed to read PDF.");
          setPendingPdf(null);
          setBusy(false);
        }
      }
    },
    [finishLoad]
  );

  const handleFile = useCallback(
    async (file) => {
      setError(null);
      setPasswordError(null);
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (ext === "pdf") {
        await tryParsePdf(file, undefined);
        return;
      }
      // CSV path
      setBusy(true);
      try {
        const { transactions, errors } = await parseCsvFile(file);
        finishLoad(transactions, errors, file.name);
      } catch (e) {
        setError(e?.message || "Failed to parse CSV.");
        setBusy(false);
      }
    },
    [tryParsePdf, finishLoad]
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

  const onSubmitPassword = (e) => {
    e.preventDefault();
    if (!pendingPdf || !password) return;
    tryParsePdf(pendingPdf, password);
  };

  // -------- PDF PASSWORD VIEW --------
  if (pendingPdf) {
    return (
      <div className="min-h-full w-full grid-overlay flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <button
            data-testid={TID.pdfPasswordCancel}
            onClick={() => {
              setPendingPdf(null);
              setPassword("");
              setPasswordError(null);
            }}
            className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-amber-400 mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            back
          </button>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-500 mb-3">
            encrypted pdf
          </div>
          <h2 className="font-heading text-2xl font-bold text-slate-50 mb-2">
            This statement is password-protected.
          </h2>
          <p className="text-sm text-slate-400 mb-6 font-mono leading-relaxed">
            PhonePe and most bank PDFs use your DOB (DDMMYYYY) or a phone-number-derived code.
            Decryption happens entirely in your browser — the password is never sent anywhere.
          </p>

          <form onSubmit={onSubmitPassword} className="space-y-3">
            <div className="relative">
              <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                data-testid={TID.pdfPasswordInput}
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="enter pdf password"
                className="w-full bg-slate-950 border border-slate-800 pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 font-mono"
              />
            </div>
            <button
              data-testid={TID.pdfPasswordSubmit}
              type="submit"
              disabled={busy || !password}
              className="w-full inline-flex items-center justify-center gap-2 bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-mono uppercase tracking-wider transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {busy ? "decrypting…" : "unlock & parse"}
            </button>
            {passwordError && (
              <div
                data-testid={TID.pdfPasswordError}
                className="text-xs font-mono text-red-400 flex items-center gap-2"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {passwordError}
              </div>
            )}
            <div className="text-[11px] font-mono text-slate-600 pt-2">
              file: <span className="text-slate-400">{pendingPdf.name}</span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // -------- DEFAULT UPLOAD VIEW --------
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
            Upload a bank-statement CSV or a PhonePe PDF (password-protected supported).
            We resolve aliases into entities, surface duplicates, round-number transfers,
            masked accounts and recurring patterns — all in your browser.
          </p>
        </div>

        <label
          data-testid={TID.uploadDropzone}
          htmlFor="upload-file-input"
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
            id="upload-file-input"
            data-testid={TID.uploadInput}
            type="file"
            accept=".csv,.pdf,text/csv,application/pdf"
            className="hidden"
            onChange={onPick}
            disabled={busy}
          />
          {busy ? (
            <Loader2 className="w-7 h-7 mx-auto text-amber-500 mb-4 animate-spin" strokeWidth={1.5} />
          ) : (
            <UploadIcon className="w-7 h-7 mx-auto text-slate-500 mb-4" strokeWidth={1.5} />
          )}
          <div className="font-mono text-sm text-slate-300">
            {busy ? "Parsing…" : "Drop CSV or PDF here · or click to browse"}
          </div>
          <div className="font-mono text-xs text-slate-500 mt-2">
            CSV: Date, Name, Debit/Credit, Amount, Category &nbsp;·&nbsp; PDF: PhonePe statement
            (encrypted ok)
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
          100% client-side · PDF decryption local · nothing is uploaded
        </div>
      </div>
    </div>
  );
}
