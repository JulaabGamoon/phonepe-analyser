// CSV parser using PapaParse. Streams rows so large files don't block.

import Papa from "papaparse";
import {
  parseDate,
  parseAmount,
  normalizeDirection,
  dateKey,
  normalizeForDisplay,
  isMaskedAccount,
} from "./normalizer";

// Normalize column header strings to a canonical lowercase key
function headerKey(h) {
  return String(h || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

const HEADER_ALIASES = {
  date: "date",
  txndate: "date",
  transactiondate: "date",
  name: "name",
  description: "name",
  counterparty: "name",
  narration: "name",
  debitcredit: "direction",
  drcr: "direction",
  type: "direction",
  direction: "direction",
  amount: "amount",
  amt: "amount",
  value: "amount",
  category: "category",
  cat: "category",
};

function mapHeaders(fields) {
  const map = {};
  fields.forEach((f) => {
    const k = headerKey(f);
    if (HEADER_ALIASES[k]) {
      map[HEADER_ALIASES[k]] = f;
    }
  });
  return map;
}

/**
 * Parse CSV file. Returns a promise resolving with { transactions, errors, headerMap }.
 * onProgress(loaded, total) is called periodically.
 */
export function parseCsvFile(file, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const transactions = [];
    const errors = [];
    let headerMap = null;
    let missingColumns = null;
    let rowIndex = 0;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      worker: false, // PapaParse worker mode is fine but we already process incrementally
      transformHeader: (h) => h.trim(),
      step: (results, parser) => {
        rowIndex += 1;
        if (!headerMap) {
          headerMap = mapHeaders(results.meta.fields || []);
          const required = ["date", "name", "direction", "amount"];
          const missing = required.filter((k) => !headerMap[k]);
          if (missing.length) {
            missingColumns = missing;
            parser.abort();
            return;
          }
        }
        const row = results.data;
        const sourceRowIndex = rowIndex;
        try {
          const rawDate = row[headerMap.date];
          const rawName = row[headerMap.name];
          const rawDir = row[headerMap.direction];
          const rawAmt = row[headerMap.amount];
          const rawCat = headerMap.category ? row[headerMap.category] : "";

          const date = parseDate(rawDate);
          const amount = parseAmount(rawAmt);
          const direction = normalizeDirection(rawDir);
          const nameOriginal = normalizeForDisplay(rawName);

          const rowErrors = [];
          if (!date) rowErrors.push("invalid_date");
          if (!isFinite(amount)) rowErrors.push("invalid_amount");
          if (!direction) rowErrors.push("invalid_direction");
          if (!nameOriginal) rowErrors.push("missing_name");

          if (rowErrors.length) {
            errors.push({
              sourceRowIndex,
              reasons: rowErrors,
              raw: row,
            });
            return;
          }

          transactions.push({
            transactionId: `t_${sourceRowIndex}`,
            sourceRowIndex,
            date,
            dateKey: dateKey(date),
            nameOriginal,
            direction,
            amount,
            category: rawCat ? String(rawCat).trim() : "Uncategorized",
            isMasked: isMaskedAccount(nameOriginal),
            rawRow: row,
          });

          if (onProgress && rowIndex % 500 === 0) {
            onProgress(rowIndex);
          }
        } catch (e) {
          errors.push({
            sourceRowIndex,
            reasons: ["exception"],
            raw: row,
            message: e?.message,
          });
        }
      },
      complete: () => {
        if (missingColumns) {
          reject(new Error(`Missing required columns: ${missingColumns.join(", ")}`));
          return;
        }
        resolve({ transactions, errors, headerMap });
      },
      error: (err) => reject(err),
    });
  });
}

// Parse a CSV string (used for sample data)
export function parseCsvString(csv) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([csv], { type: "text/csv" });
    const file = new File([blob], "sample.csv", { type: "text/csv" });
    parseCsvFile(file).then(resolve).catch(reject);
  });
}
