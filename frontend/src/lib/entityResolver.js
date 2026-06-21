// Entity resolution: cluster transaction names into entities by matching key.

import { buildMatchKey, similarity, isMaskedAccount } from "./normalizer";

function entityIdFromKey(key, index) {
  return `e_${index}_${key.replace(/\s+/g, "_").slice(0, 32)}`;
}

// Pick the best display name for a cluster:
// - prefer the most frequent original name
// - tie-breaker: shortest (cleaner) name without corporate suffix words
const SUFFIX_TOKENS = new Set([
  "ltd", "limited", "pvt", "private", "llp", "inc", "corp", "corporation", "co", "company",
]);

function chooseDisplayName(originals) {
  const counts = new Map();
  for (const n of originals) counts.set(n, (counts.get(n) || 0) + 1);
  let best = null;
  let bestScore = -Infinity;
  for (const [name, count] of counts.entries()) {
    const tokens = name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
    const hasSuffix = tokens.some((t) => SUFFIX_TOKENS.has(t));
    // Score: frequency * 10, prefer no-suffix (+5), prefer shorter (-len/100)
    const score = count * 10 + (hasSuffix ? 0 : 5) + (-name.length / 100);
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }
  return (best || originals[0] || "").toUpperCase();
}

/**
 * Resolve entities from transactions.
 * @param {Array} transactions - normalized transactions (each with nameOriginal)
 * @param {Object} options - { manualMerges: { [matchKey]: targetEntityId }, manualSplits: Set of matchKeys to never merge with others }
 * @returns { entities: Array, txWithEntities: Array }
 */
export function resolveEntities(transactions, { manualMerges = {}, ignoredAliases = new Set() } = {}) {
  // Step 1: group by match key
  const byKey = new Map();
  for (const tx of transactions) {
    const key = buildMatchKey(tx.nameOriginal);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(tx);
  }

  // Step 2: apply manual merges — if a key has a manual target, merge into that target's bucket
  // manualMerges: { sourceMatchKey: targetMatchKey }
  const mergedKeys = new Map(); // canonical key -> array of source keys
  for (const k of byKey.keys()) mergedKeys.set(k, [k]);

  for (const [src, tgt] of Object.entries(manualMerges)) {
    if (byKey.has(src) && byKey.has(tgt) && src !== tgt) {
      // Move src into tgt
      const srcTxs = byKey.get(src) || [];
      byKey.get(tgt).push(...srcTxs);
      byKey.delete(src);
      mergedKeys.get(tgt)?.push(src);
      mergedKeys.delete(src);
    }
  }

  // Step 3: build entities
  const entities = [];
  const txWithEntities = [];
  let idx = 0;
  for (const [key, txs] of byKey.entries()) {
    idx += 1;
    const originals = txs.map((t) => t.nameOriginal);
    const uniqueOriginals = Array.from(new Set(originals));
    const isMasked = isMaskedAccount(txs[0].nameOriginal);
    const displayName = isMasked
      ? txs[0].nameOriginal // e.g. "******4849"
      : chooseDisplayName(originals);
    const entityId = entityIdFromKey(key, idx);

    // Confidence per alias (against display name)
    const aliasStats = uniqueOriginals.map((name) => {
      const sim = isMasked ? 1 : similarity(name, displayName);
      const count = originals.filter((o) => o === name).length;
      return {
        name,
        count,
        confidence: Math.max(0.6, sim), // floor at 60% — they share matching key by construction
        ignored: ignoredAliases.has(`${entityId}::${name}`),
      };
    });
    aliasStats.sort((a, b) => b.count - a.count || b.confidence - a.confidence);

    // Cluster confidence: average of alias confidences weighted by count
    const totalCount = aliasStats.reduce((s, a) => s + a.count, 0) || 1;
    const clusterConfidence =
      aliasStats.reduce((s, a) => s + a.confidence * a.count, 0) / totalCount;

    const entity = {
      entityId,
      matchKey: key,
      displayName,
      aliases: aliasStats,
      aliasCount: uniqueOriginals.length,
      clusterConfidence,
      isMasked,
      mergedFrom: mergedKeys.get(key) || [key],
    };
    entities.push(entity);

    for (const tx of txs) {
      txWithEntities.push({
        ...tx,
        entityId,
        entityDisplayName: displayName,
        nameNormalized: key,
      });
    }
  }
  return { entities, transactions: txWithEntities };
}
