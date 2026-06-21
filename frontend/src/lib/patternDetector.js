// Suspicious pattern detection.
// Produces an array of findings: { id, type, severity, label, reason, entityId, transactionIds, evidence, confidence }

const ROUND_NUMBERS = new Set([1000, 2000, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 25000, 50000, 100000]);

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

let idCounter = 0;
function makeId(prefix) {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

/**
 * Detect patterns across entities and transactions.
 */
export function detectPatterns(entities, transactions) {
  idCounter = 0;
  const findings = [];

  // Pre-index transactions by entity
  const txByEntity = new Map();
  for (const tx of transactions) {
    if (!txByEntity.has(tx.entityId)) txByEntity.set(tx.entityId, []);
    txByEntity.get(tx.entityId).push(tx);
  }

  // 8. Masked account detection — produce one finding per masked entity
  for (const e of entities) {
    if (e.isMasked) {
      const txs = txByEntity.get(e.entityId) || [];
      findings.push({
        id: makeId("mask"),
        type: "masked_account",
        severity: "high",
        label: `Masked account ${e.displayName}`,
        reason: "Counterparty name is a masked account number — investigate destination.",
        entityId: e.entityId,
        transactionIds: txs.map((t) => t.transactionId),
        confidence: 1,
      });
    }
  }

  // 1. Same-day duplicate payments — same entity, same date, same amount, count > 1
  // 2. Repeated amount detection — same entity, same amount across multiple txs
  // 4. Recurring sequence detection — same amount on roughly regular intervals
  // 5. Multiple transfers to same entity — burst across days/months
  // 6. Abnormally small txns — amount << median for that entity
  for (const [entityId, txs] of txByEntity.entries()) {
    if (!txs.length) continue;
    const entity = entities.find((e) => e.entityId === entityId);
    if (!entity || entity.isMasked) continue;

    // Same-day duplicates
    const byDateAmount = new Map();
    for (const t of txs) {
      const k = `${t.dateKey}|${t.amount}|${t.direction}`;
      if (!byDateAmount.has(k)) byDateAmount.set(k, []);
      byDateAmount.get(k).push(t);
    }
    for (const group of byDateAmount.values()) {
      if (group.length > 1) {
        findings.push({
          id: makeId("dup"),
          type: "same_day_duplicate",
          severity: "high",
          label: `Duplicate ${group[0].direction.toLowerCase()} on ${group[0].dateKey}`,
          reason: `${group.length} identical ${group[0].direction.toLowerCase()} of ${formatAmt(group[0].amount)} to ${entity.displayName} on the same day.`,
          entityId,
          transactionIds: group.map((g) => g.transactionId),
          confidence: 0.95,
        });
      }
    }

    // Repeated amount (same amount > 2 times on different dates)
    const byAmount = new Map();
    for (const t of txs) {
      if (!byAmount.has(t.amount)) byAmount.set(t.amount, []);
      byAmount.get(t.amount).push(t);
    }
    for (const [amt, group] of byAmount.entries()) {
      const uniqueDates = new Set(group.map((g) => g.dateKey));
      if (group.length >= 3 && uniqueDates.size >= 2) {
        findings.push({
          id: makeId("rep"),
          type: "repeated_amount",
          severity: "medium",
          label: `Repeated amount ${formatAmt(amt)} × ${group.length}`,
          reason: `${entity.displayName} received/sent ${formatAmt(amt)} ${group.length} times across ${uniqueDates.size} dates.`,
          entityId,
          transactionIds: group.map((g) => g.transactionId),
          confidence: 0.85,
        });

        // Recurring sequence check — sort by date, compute gaps
        const sorted = [...group].sort((a, b) => a.date - b.date);
        if (sorted.length >= 3) {
          const gaps = [];
          for (let i = 1; i < sorted.length; i++) {
            gaps.push((sorted[i].date - sorted[i - 1].date) / 86400000);
          }
          const med = median(gaps);
          if (med >= 1) {
            const variance =
              gaps.reduce((s, g) => s + Math.abs(g - med), 0) / gaps.length;
            if (variance / Math.max(med, 1) < 0.3) {
              findings.push({
                id: makeId("rec"),
                type: "recurring_sequence",
                severity: "medium",
                label: `Recurring ${formatAmt(amt)} every ~${Math.round(med)}d`,
                reason: `Equal payments of ${formatAmt(amt)} occur on a regular cadence of ~${Math.round(med)} days.`,
                entityId,
                transactionIds: sorted.map((g) => g.transactionId),
                confidence: 0.8,
              });
            }
          }
        }
      }
    }

    // Burst activity — >=4 txs in any rolling 7-day window
    const sortedByDate = [...txs].sort((a, b) => a.date - b.date);
    for (let i = 0; i < sortedByDate.length; i++) {
      const window = [sortedByDate[i]];
      for (let j = i + 1; j < sortedByDate.length; j++) {
        if ((sortedByDate[j].date - sortedByDate[i].date) / 86400000 <= 7) {
          window.push(sortedByDate[j]);
        } else break;
      }
      if (window.length >= 4) {
        findings.push({
          id: makeId("burst"),
          type: "burst_activity",
          severity: "medium",
          label: `Burst: ${window.length} txns in 7 days`,
          reason: `${window.length} transactions to ${entity.displayName} between ${window[0].dateKey} and ${window[window.length - 1].dateKey}.`,
          entityId,
          transactionIds: window.map((w) => w.transactionId),
          confidence: 0.75,
        });
        break; // one burst per entity is enough
      }
    }

    // Multiple transfers — >=5 txs to same entity overall
    if (txs.length >= 5) {
      findings.push({
        id: makeId("multi"),
        type: "multiple_transfers",
        severity: "low",
        label: `${txs.length} transfers to ${entity.displayName}`,
        reason: `Repeated activity across multiple dates with the same counterparty.`,
        entityId,
        transactionIds: txs.map((t) => t.transactionId),
        confidence: 0.7,
      });
    }

    // Abnormally small — amount < 5% of median
    if (txs.length >= 4) {
      const med = median(txs.map((t) => t.amount));
      if (med > 0) {
        const tiny = txs.filter((t) => t.amount > 0 && t.amount < med * 0.05);
        if (tiny.length) {
          findings.push({
            id: makeId("small"),
            type: "abnormal_small",
            severity: "low",
            label: `Tiny txn vs ${formatAmt(med)} median`,
            reason: `Transaction(s) far below typical amount for ${entity.displayName}.`,
            entityId,
            transactionIds: tiny.map((t) => t.transactionId),
            confidence: 0.7,
          });
        }
      }
    }
  }

  // 7. Round-number detection — any transaction matching ROUND_NUMBERS
  // Group by entity for cleaner display
  const roundByEntity = new Map();
  for (const tx of transactions) {
    if (ROUND_NUMBERS.has(Math.round(tx.amount))) {
      if (!roundByEntity.has(tx.entityId)) roundByEntity.set(tx.entityId, []);
      roundByEntity.get(tx.entityId).push(tx);
    }
  }
  for (const [entityId, txs] of roundByEntity.entries()) {
    const entity = entities.find((e) => e.entityId === entityId);
    if (!entity) continue;
    findings.push({
      id: makeId("round"),
      type: "round_number",
      severity: "low",
      label: `Round-number txn × ${txs.length}`,
      reason: `Investigative round values (${[...new Set(txs.map((t) => formatAmt(t.amount)))].join(", ")}) at ${entity.displayName}.`,
      entityId,
      transactionIds: txs.map((t) => t.transactionId),
      confidence: 0.6,
    });
  }

  // Sort findings by severity + confidence
  const sevOrder = { high: 0, medium: 1, low: 2 };
  findings.sort(
    (a, b) => sevOrder[a.severity] - sevOrder[b.severity] || b.confidence - a.confidence
  );
  return findings;
}

function formatAmt(n) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}
