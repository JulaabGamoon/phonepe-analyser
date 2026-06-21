// Central Zustand store for the investigation app.
// Holds parsed transactions, resolved entities, findings, filters, and user state.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { resolveEntities } from "../lib/entityResolver";
import { aggregate } from "../lib/aggregator";
import { detectPatterns } from "../lib/patternDetector";

function recompute(state) {
  const { transactions: rawTx, manualMerges, ignoredAliases, forcedSplits } = state;
  if (!rawTx.length) {
    return {
      entities: [],
      transactions: [],
      findings: [],
      txById: new Map(),
      entityById: new Map(),
    };
  }
  const { entities: resolvedEntities, transactions: txWithEntities } = resolveEntities(
    rawTx,
    {
      manualMerges,
      ignoredAliases: new Set(ignoredAliases),
      forcedSplits: new Set(forcedSplits || []),
    }
  );
  const { entities: enrichedEntities } = aggregate(resolvedEntities, txWithEntities);
  const findings = detectPatterns(enrichedEntities, txWithEntities);

  // Attach flag types to transactions
  const findingsByTx = new Map();
  for (const f of findings) {
    for (const tid of f.transactionIds) {
      if (!findingsByTx.has(tid)) findingsByTx.set(tid, []);
      findingsByTx.get(tid).push(f.type);
    }
  }
  const finalTx = txWithEntities.map((t) => ({
    ...t,
    flags: findingsByTx.get(t.transactionId) || [],
  }));

  // Suspicious score per entity = sum of severity weights
  const sevWeight = { high: 3, medium: 2, low: 1 };
  const susByEntity = new Map();
  for (const f of findings) {
    susByEntity.set(f.entityId, (susByEntity.get(f.entityId) || 0) + sevWeight[f.severity]);
  }
  const enrichedWithScore = enrichedEntities.map((e) => ({
    ...e,
    suspiciousScore: susByEntity.get(e.entityId) || 0,
  }));

  const txById = new Map(finalTx.map((t) => [t.transactionId, t]));
  const entityById = new Map(enrichedWithScore.map((e) => [e.entityId, e]));

  return {
    entities: enrichedWithScore,
    transactions: finalTx,
    findings,
    txById,
    entityById,
  };
}

export const useStore = create(
  persist(
    (set, get) => ({
      // Raw inputs
      transactions: [], // raw parsed transactions (pre-resolution)
      parseErrors: [],
      fileName: null,
      uploadedAt: null,

      // User decisions (persisted)
      manualMerges: {}, // sourceMatchKey -> targetMatchKey
      ignoredAliases: [], // array of "entityId::aliasName"
      forcedSplits: [], // array of alias original-name strings to never merge
      pinnedEntities: [], // entityIds
      notes: {}, // entityId -> string
      reviewedFindings: [], // finding ids

      // Computed (regenerated, not persisted directly)
      entities: [],
      findings: [],
      txById: new Map(),
      entityById: new Map(),

      // UI state
      selectedEntityId: null,
      selectedDateKey: null,
      selectedTransactionId: null,
      filters: {
        query: "",
        direction: "all", // 'all' | 'Debit' | 'Credit'
        dateFrom: "",
        dateTo: "",
        amountMin: "",
        amountMax: "",
        flagType: null, // suspicious flag type filter
        maskedOnly: false,
        recurringOnly: false,
        duplicateOnly: false,
      },
      sort: { field: "txCount", dir: "desc" },

      // Actions
      loadTransactions: (transactions, errors, fileName) => {
        set({
          transactions,
          parseErrors: errors,
          fileName,
          uploadedAt: new Date().toISOString(),
          selectedEntityId: null,
          selectedDateKey: null,
          selectedTransactionId: null,
        });
        const computed = recompute(get());
        set(computed);
      },
      clearData: () =>
        set({
          transactions: [],
          parseErrors: [],
          fileName: null,
          uploadedAt: null,
          entities: [],
          findings: [],
          txById: new Map(),
          entityById: new Map(),
          selectedEntityId: null,
          selectedDateKey: null,
          selectedTransactionId: null,
        }),
      setFilter: (patch) =>
        set((s) => ({ filters: { ...s.filters, ...patch } })),
      setSort: (sort) => set({ sort }),
      selectEntity: (entityId) =>
        set({ selectedEntityId: entityId, selectedDateKey: null, selectedTransactionId: null }),
      selectDate: (dateKey) =>
        set({ selectedDateKey: dateKey, selectedTransactionId: null }),
      selectTransaction: (txId) => set({ selectedTransactionId: txId }),
      pinEntity: (entityId) =>
        set((s) => ({
          pinnedEntities: s.pinnedEntities.includes(entityId)
            ? s.pinnedEntities.filter((p) => p !== entityId)
            : [...s.pinnedEntities, entityId],
        })),
      setNote: (entityId, text) =>
        set((s) => ({ notes: { ...s.notes, [entityId]: text } })),
      markFindingReviewed: (id) =>
        set((s) => ({
          reviewedFindings: s.reviewedFindings.includes(id)
            ? s.reviewedFindings.filter((x) => x !== id)
            : [...s.reviewedFindings, id],
        })),
      ignoreAlias: (entityId, aliasName) =>
        set((s) => {
          const key = `${entityId}::${aliasName}`;
          const next = s.ignoredAliases.includes(key)
            ? s.ignoredAliases.filter((k) => k !== key)
            : [...s.ignoredAliases, key];
          const newState = { ...s, ignoredAliases: next };
          return { ...newState, ...recompute(newState) };
        }),
      splitAlias: (aliasName) =>
        set((s) => {
          const next = s.forcedSplits.includes(aliasName)
            ? s.forcedSplits.filter((n) => n !== aliasName)
            : [...s.forcedSplits, aliasName];
          const newState = { ...s, forcedSplits: next };
          return { ...newState, ...recompute(newState) };
        }),
      manualMerge: (sourceKey, targetKey) =>
        set((s) => {
          const next = { ...s.manualMerges, [sourceKey]: targetKey };
          const newState = { ...s, manualMerges: next };
          return { ...newState, ...recompute(newState) };
        }),
      undoManualMerge: (sourceKey) =>
        set((s) => {
          const next = { ...s.manualMerges };
          delete next[sourceKey];
          const newState = { ...s, manualMerges: next };
          return { ...newState, ...recompute(newState) };
        }),
      recomputeAll: () => set((s) => recompute(s)),
    }),
    {
      name: "ledger-lens-state",
      partialize: (s) => ({
        manualMerges: s.manualMerges,
        ignoredAliases: s.ignoredAliases,
        forcedSplits: s.forcedSplits,
        pinnedEntities: s.pinnedEntities,
        notes: s.notes,
        reviewedFindings: s.reviewedFindings,
      }),
    }
  )
);
