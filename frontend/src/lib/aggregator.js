// Aggregator — compute entity-level and time-bucket metrics.

/**
 * Compute per-entity aggregates and attach to entities.
 * @returns { entities, byEntity (Map of entityId -> aggregate) }
 */
export function aggregate(entities, transactions) {
  const byEntity = new Map();
  for (const tx of transactions) {
    let agg = byEntity.get(tx.entityId);
    if (!agg) {
      agg = {
        entityId: tx.entityId,
        txCount: 0,
        totalDebit: 0,
        totalCredit: 0,
        netFlow: 0,
        highestTxAmount: 0,
        highestTxId: null,
        firstDate: null,
        lastDate: null,
        // Per-year/per-month/per-day buckets
        byYear: new Map(),
        byMonth: new Map(), // yyyy-mm
        byDay: new Map(),   // yyyy-mm-dd
        // For pattern detection helpers
        amounts: [],
        txIds: [],
      };
      byEntity.set(tx.entityId, agg);
    }
    agg.txCount += 1;
    if (tx.direction === "Debit") {
      agg.totalDebit += tx.amount;
      agg.netFlow -= tx.amount;
    } else {
      agg.totalCredit += tx.amount;
      agg.netFlow += tx.amount;
    }
    if (tx.amount > agg.highestTxAmount) {
      agg.highestTxAmount = tx.amount;
      agg.highestTxId = tx.transactionId;
    }
    if (!agg.firstDate || tx.date < agg.firstDate) agg.firstDate = tx.date;
    if (!agg.lastDate || tx.date > agg.lastDate) agg.lastDate = tx.date;

    const y = tx.date.getFullYear();
    const ym = `${y}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`;
    const ymd = tx.dateKey;
    bumpBucket(agg.byYear, y, tx);
    bumpBucket(agg.byMonth, ym, tx);
    bumpBucket(agg.byDay, ymd, tx);
    agg.amounts.push(tx.amount);
    agg.txIds.push(tx.transactionId);
  }

  // Attach aggregates back onto entities
  const enriched = entities.map((e) => {
    const agg = byEntity.get(e.entityId) || emptyAgg();
    return { ...e, ...agg };
  });
  return { entities: enriched, byEntity };
}

function bumpBucket(map, key, tx) {
  let b = map.get(key);
  if (!b) {
    b = { key, debit: 0, credit: 0, count: 0, net: 0 };
    map.set(key, b);
  }
  b.count += 1;
  if (tx.direction === "Debit") {
    b.debit += tx.amount;
    b.net -= tx.amount;
  } else {
    b.credit += tx.amount;
    b.net += tx.amount;
  }
}

function emptyAgg() {
  return {
    txCount: 0,
    totalDebit: 0,
    totalCredit: 0,
    netFlow: 0,
    highestTxAmount: 0,
    highestTxId: null,
    firstDate: null,
    lastDate: null,
    byYear: new Map(),
    byMonth: new Map(),
    byDay: new Map(),
    amounts: [],
    txIds: [],
  };
}

// Compute portfolio-level metrics
export function portfolioStats(transactions) {
  let debit = 0, credit = 0, count = transactions.length;
  let earliest = null, latest = null;
  for (const tx of transactions) {
    if (tx.direction === "Debit") debit += tx.amount;
    else credit += tx.amount;
    if (!earliest || tx.date < earliest) earliest = tx.date;
    if (!latest || tx.date > latest) latest = tx.date;
  }
  return {
    txCount: count,
    totalDebit: debit,
    totalCredit: credit,
    netFlow: credit - debit,
    earliest,
    latest,
  };
}
