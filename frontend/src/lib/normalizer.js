// Name & data normalization utilities.
// Pure functions — safe to import anywhere (UI, workers, tests).

const CORPORATE_SUFFIXES = [
  "private limited",
  "pvt ltd",
  "pvt. ltd",
  "private ltd",
  "pvt limited",
  "limited",
  "ltd",
  "llp",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "co",
  "company",
];

// Trailing transactional noise words (only stripped when at the very end)
const TRAILING_NOISE = new Set([
  "repayment",
  "payment",
  "transfer",
  "txn",
  "tx",
  "ref",
  "imps",
  "neft",
  "rtgs",
  "upi",
]);

// Detect masked-account pattern e.g. "******4849" or "xxxx4000"
export function isMaskedAccount(rawName) {
  if (!rawName) return false;
  const s = String(rawName).trim();
  return /^[*x]{2,}\s*\d{2,}$/i.test(s) || /^\d*[*x]{3,}\d{2,}$/i.test(s);
}

// Tokenize after stripping punctuation
function tokenize(s) {
  return s
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

// Strip trailing noise tokens repeatedly
function stripTrailingNoise(tokens) {
  let i = tokens.length;
  while (i > 1 && TRAILING_NOISE.has(tokens[i - 1])) {
    i--;
  }
  return tokens.slice(0, i);
}

// Strip trailing corporate suffix sequences (multi-word) repeatedly
function stripCorporateSuffix(joined) {
  let changed = true;
  let s = joined;
  while (changed) {
    changed = false;
    for (const suf of CORPORATE_SUFFIXES) {
      if (s.endsWith(" " + suf) || s === suf) {
        s = s.slice(0, s.length - suf.length).trim();
        changed = true;
      }
    }
  }
  return s;
}

// Stem plural 's' (only on tokens ≥ 4 chars, not ending in 'ss', not 'us')
function stem(tok) {
  if (tok.length >= 4 && tok.endsWith("s") && !tok.endsWith("ss") && !tok.endsWith("us")) {
    return tok.slice(0, -1);
  }
  return tok;
}

// Collapse consecutive single-character tokens into one (e.g. "m k" -> "mk")
function collapseInitials(tokens) {
  const out = [];
  let buf = "";
  for (const t of tokens) {
    if (t.length === 1) {
      buf += t;
    } else {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      out.push(t);
    }
  }
  if (buf) out.push(buf);
  return out;
}

/**
 * Build the matching key used to cluster aliases.
 * Two names with the same matching key are merged automatically.
 */
export function buildMatchKey(rawName) {
  if (!rawName) return "";
  if (isMaskedAccount(rawName)) {
    // Strip leading/trailing whitespace, keep masked suffix to differentiate accounts
    const digits = String(rawName).match(/\d+/g);
    return "__masked__" + (digits ? digits.join("") : String(rawName).trim());
  }
  let s = String(rawName).toLowerCase();
  let tokens = tokenize(s);
  tokens = stripTrailingNoise(tokens);
  let joined = tokens.join(" ");
  joined = stripCorporateSuffix(joined);
  tokens = joined.split(" ").filter(Boolean);
  tokens = collapseInitials(tokens);
  tokens = tokens.map(stem);
  return tokens.join(" ").trim();
}

/**
 * A lighter normalization that preserves more (used for display/search index).
 */
export function normalizeForDisplay(rawName) {
  if (!rawName) return "";
  return String(rawName).trim().replace(/\s+/g, " ");
}

// Levenshtein distance — used for confidence scoring (small inputs only)
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > Math.max(al, bl)) return Math.max(al, bl);
  const v0 = new Array(bl + 1);
  const v1 = new Array(bl + 1);
  for (let i = 0; i <= bl; i++) v0[i] = i;
  for (let i = 0; i < al; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < bl; j++) {
      const cost = a.charCodeAt(i) === b.charCodeAt(j) ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= bl; j++) v0[j] = v1[j];
  }
  return v0[bl];
}

// Similarity 0..1 based on Levenshtein
export function similarity(a, b) {
  if (!a && !b) return 1;
  const aa = String(a).toLowerCase().trim();
  const bb = String(b).toLowerCase().trim();
  if (!aa.length && !bb.length) return 1;
  const dist = levenshtein(aa, bb);
  const maxLen = Math.max(aa.length, bb.length);
  return 1 - dist / maxLen;
}

// Parse various date formats into a Date object. Returns null on failure.
export function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // ISO yyyy-mm-dd
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!isNaN(d.getTime())) return d;
  }
  // dd-mmm-yyyy / dd mmm yyyy
  m = /^(\d{1,2})[-\s\/](\w{3,9})[-\s\/](\d{2,4})/.exec(s);
  if (m) {
    const months = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      january: 0, february: 1, march: 2, april: 3, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    };
    const month = months[m[2].toLowerCase().slice(0, 3)];
    if (month != null) {
      let year = Number(m[3]);
      if (year < 100) year += 2000;
      const d = new Date(year, month, Number(m[1]));
      if (!isNaN(d.getTime())) return d;
    }
  }
  // dd/mm/yyyy or dd-mm-yyyy
  m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/.exec(s);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(d.getTime())) return d;
  }
  // Fallback Date.parse
  const t = Date.parse(s);
  if (!isNaN(t)) return new Date(t);
  return null;
}

// Format date as yyyy-mm-dd (key)
export function dateKey(d) {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Parse amount: strip currency symbols, commas
export function parseAmount(raw) {
  if (raw == null) return NaN;
  const s = String(raw).replace(/[₹$,€£¥\s]/g, "").trim();
  if (!s) return NaN;
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}

// Normalize direction string
export function normalizeDirection(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === "debit" || s === "dr" || s === "d" || s === "withdrawal" || s === "out") return "Debit";
  if (s === "credit" || s === "cr" || s === "c" || s === "deposit" || s === "in") return "Credit";
  return null;
}
