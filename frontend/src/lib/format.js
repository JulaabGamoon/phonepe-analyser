// Formatting helpers used across the UI.

export const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

export const dec = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

export function fmtAmount(n, { compact = false, signed = false } = {}) {
  if (n == null || !isFinite(n)) return "—";
  const f = compact ? inrCompact : inr;
  const out = f.format(Math.abs(n));
  if (signed) return n < 0 ? "-" + out : "+" + out;
  return out;
}

export function fmtDate(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return "—";
  const day = String(dt.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day}-${months[dt.getMonth()]}-${dt.getFullYear()}`;
}

export function fmtDateShort(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toISOString().slice(0, 10);
}

export function pct(n) {
  if (n == null || !isFinite(n)) return "—";
  return `${Math.round(n * 100)}%`;
}
