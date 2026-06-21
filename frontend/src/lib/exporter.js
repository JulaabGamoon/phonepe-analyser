// Export helpers — produce CSV and JSON snapshots of current investigation state.

import Papa from "papaparse";

export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

/**
 * Export a flat CSV of the currently visible transaction set.
 */
export function exportTransactionsCsv(transactions, filename = "transactions.csv") {
  const rows = transactions.map((tx) => ({
    transactionId: tx.transactionId,
    date: tx.dateKey,
    nameOriginal: tx.nameOriginal,
    entityDisplayName: tx.entityDisplayName,
    direction: tx.direction,
    amount: tx.amount,
    category: tx.category,
    sourceRowIndex: tx.sourceRowIndex,
    flags: (tx.flags || []).join("|"),
  }));
  const csv = Papa.unparse(rows);
  downloadFile(filename, csv, "text/csv;charset=utf-8");
}

/**
 * Export a structured JSON snapshot — preserves entity hierarchy, findings, filters and notes.
 */
export function exportInvestigationJson(snapshot, filename = "investigation.json") {
  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    ...snapshot,
  };
  // Replace Maps with plain objects/arrays so JSON.stringify works.
  const json = JSON.stringify(payload, replacer, 2);
  downloadFile(filename, json, "application/json");
}

function replacer(_key, value) {
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  if (value instanceof Set) {
    return Array.from(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

/**
 * Export the error queue produced during parsing.
 */
export function exportErrorReport(errors, filename = "csv-errors.csv") {
  if (!errors.length) return;
  const rows = errors.map((e) => ({
    sourceRowIndex: e.sourceRowIndex,
    reasons: (e.reasons || []).join("|"),
    raw: JSON.stringify(e.raw),
    message: e.message || "",
  }));
  const csv = Papa.unparse(rows);
  downloadFile(filename, csv, "text/csv;charset=utf-8");
}
