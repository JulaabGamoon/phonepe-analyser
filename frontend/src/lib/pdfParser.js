// Client-side PDF parser for bank/PhonePe statements.
// Uses pdfjs-dist (legacy build) so it works in CRA's webpack 5 without worker setup hassle.
// Returns transactions in the SAME shape as parser.js so the rest of the pipeline is unchanged
// (credits are first-class — no filtering anywhere).

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import {
  parseDate,
  dateKey,
  normalizeForDisplay,
  isMaskedAccount,
} from "./normalizer";

// Use the worker shipped alongside our pdfjs install. It's copied to /public so
// the dev server serves it from the same origin (no CDN/CORS dependency).
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ""}/pdf.worker.min.mjs`;

const PasswordResponses = pdfjsLib.PasswordResponses || {
  NEED_PASSWORD: 1,
  INCORRECT_PASSWORD: 2,
};

// PhonePe statement line shape:
//   "Jul 15, 2024 Paid to John Doe Debit INR 500.00"
//   "Jul 15, 2024 Received from Alice Credit INR 1,000.00"
//   Some lines may include trailing transaction id / utr — we'll strip that.
const TXN_LINE_RX =
  /([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})\s+(.+?)\s+(Debit|Credit)\s+(?:INR\s+)?([\d,]+(?:\.\d{1,2})?)/;

// Some statements show the date on one line and details on the next.
// We also try a "date-only" matcher to seed multi-line reconstruction.
const DATE_ONLY_RX = /^([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})\s*$/;

/**
 * Extract text lines from a PDF, optionally decrypting with a password.
 * Throws an Error with code='PASSWORD_REQUIRED' or 'INCORRECT_PASSWORD' so the
 * caller can prompt the user.
 */
async function extractLines(file, password) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    password: password || undefined,
    // Newer pdfjs needs these tiny niceties when run in CRA:
    isEvalSupported: false,
    disableFontFace: true,
  });

  // Hook so we surface a typed error instead of pdfjs's prompt callback.
  loadingTask.onPassword = (_updatePassword, reason) => {
    const err = new Error(
      reason === PasswordResponses.INCORRECT_PASSWORD
        ? "INCORRECT_PASSWORD"
        : "PASSWORD_REQUIRED"
    );
    err.code = err.message;
    loadingTask.destroy().catch(() => {});
    throw err;
  };

  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (e) {
    if (e?.name === "PasswordException") {
      const code =
        e.code === PasswordResponses.INCORRECT_PASSWORD
          ? "INCORRECT_PASSWORD"
          : "PASSWORD_REQUIRED";
      const err = new Error(code);
      err.code = code;
      throw err;
    }
    throw e;
  }

  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    // Group items by y-coordinate (pdfjs uses bottom-left origin, so each "row"
    // has the same y). Round to one decimal to merge nearly-aligned glyphs.
    const byY = new Map();
    for (const item of tc.items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5] * 2) / 2;
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y).push(item);
    }
    const sortedY = [...byY.keys()].sort((a, b) => b - a); // top first
    for (const y of sortedY) {
      const items = byY.get(y).sort((a, b) => a.transform[4] - b.transform[4]);
      const line = items
        .map((i) => i.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (line) lines.push(line);
    }
    page.cleanup();
  }
  await doc.cleanup();
  return lines;
}

function cleanName(rawName) {
  let name = rawName.trim();
  // Strip common PhonePe prefixes
  name = name.replace(/^Paid to\s+/i, "");
  name = name.replace(/^Received from\s+/i, "");
  name = name.replace(/^Payment to\s+/i, "");
  name = name.replace(/^From\s+/i, "");
  // Strip trailing transaction id / UTR / reference suffixes
  name = name.replace(
    /\s+(Transaction ID|Txn ID|UTR|Ref(?:\.|erence)?(?: No)?\.?|RRN|UPI Ref)\b.*$/i,
    ""
  );
  // Strip long trailing digit blocks (txn ids without a prefix label)
  name = name.replace(/\s+\d{10,}\b.*$/, "");
  // Collapse whitespace
  return name.replace(/\s+/g, " ").trim();
}

/**
 * Parse a PhonePe (or PhonePe-style) PDF statement.
 * Returns { transactions, errors } — same shape as parseCsvFile.
 *
 * In addition to the headline date/name/amount, we also capture the user's own
 * account number from the multi-line metadata block that follows each row
 * ("Debited from XX8494" / "Credited to XX8494"). This lets the pattern
 * detector flag self-transfers — i.e. payments to an account that the user
 * has previously been seen debiting/crediting from.
 */
export async function parsePdfFile(file, { password } = {}) {
  const lines = await extractLines(file, password);

  const transactions = [];
  const errors = [];
  let idx = 0;

  // Pre-pass: if we find date-only lines followed by detail lines, join them.
  const merged = [];
  for (let i = 0; i < lines.length; i++) {
    const dateOnly = DATE_ONLY_RX.exec(lines[i]);
    if (dateOnly && i + 1 < lines.length) {
      merged.push(`${dateOnly[1]} ${lines[i + 1]}`);
      i += 1;
    } else {
      merged.push(lines[i]);
    }
  }

  // Helper: pull trailing account digits from a "Debited from XX8494" / "Credited to XX8494" line.
  // We keep the full masked form (e.g. "XX8494") AND the digit suffix (for fuzzy matching).
  const FROM_RX =
    /(?:Debited from|Credited to|From|To)\s+([Xx*]+\d{2,}|\d{2,}[Xx*]+|XX+\d{2,})/i;

  for (let i = 0; i < merged.length; i++) {
    const line = merged[i];
    const m = TXN_LINE_RX.exec(line);
    if (!m) continue;
    idx += 1;
    const [, dateStr, body, dir, amtStr] = m;
    const sourceRowIndex = idx;
    const date = parseDate(dateStr);
    const amount = parseFloat(amtStr.replace(/,/g, ""));
    const name = cleanName(body);

    // Look at the next few lines (until the next txn row) for the user's own account.
    let userAccount = null;
    for (let j = i + 1; j < Math.min(merged.length, i + 6); j++) {
      if (TXN_LINE_RX.test(merged[j])) break;
      const fm = FROM_RX.exec(merged[j]);
      if (fm) {
        userAccount = fm[1].toUpperCase();
        break;
      }
    }
    const userAccountDigits = userAccount ? (userAccount.match(/\d+/g) || []).join("") : null;

    const rowErrors = [];
    if (!date) rowErrors.push("invalid_date");
    if (!isFinite(amount)) rowErrors.push("invalid_amount");
    if (!name) rowErrors.push("missing_name");

    if (rowErrors.length) {
      errors.push({
        sourceRowIndex,
        reasons: rowErrors,
        raw: { line, dateStr, name, dir, amtStr, userAccount },
      });
      continue;
    }

    transactions.push({
      transactionId: `t_${sourceRowIndex}`,
      sourceRowIndex,
      date,
      dateKey: dateKey(date),
      nameOriginal: normalizeForDisplay(name),
      direction: dir, // both "Debit" and "Credit" are first-class
      amount,
      category: "Other",
      isMasked: isMaskedAccount(name),
      userAccount,           // e.g. "XX8494"  (user's own account this row touched)
      userAccountDigits,     // e.g. "8494"    (digits-only suffix, for matching)
      rawRow: {
        source: "pdf",
        line,
        date: dateStr,
        name,
        direction: dir,
        amount: amtStr,
        userAccount,
      },
    });
  }

  if (!transactions.length && !errors.length) {
    throw new Error(
      "No PhonePe-style transaction lines found in this PDF. Is it a PhonePe statement?"
    );
  }

  return { transactions, errors };
}

export const PdfErrors = {
  PASSWORD_REQUIRED: "PASSWORD_REQUIRED",
  INCORRECT_PASSWORD: "INCORRECT_PASSWORD",
};
