import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { TID } from "../constants/testIds";
import { fmtAmount, fmtDateShort, pct } from "../lib/format";
import { Search, Pin, ArrowDownUp, AlertOctagon, Eye } from "lucide-react";

const SORT_OPTIONS = [
  { value: "txCount", label: "Txn count" },
  { value: "totalDebit", label: "Total debit" },
  { value: "totalCredit", label: "Total credit" },
  { value: "netFlow", label: "Net flow" },
  { value: "lastDate", label: "Last activity" },
  { value: "clusterConfidence", label: "Confidence" },
  { value: "suspiciousScore", label: "Suspicious score" },
];

export default function EntityExplorer() {
  const entities = useStore((s) => s.entities);
  const filters = useStore((s) => s.filters);
  const sort = useStore((s) => s.sort);
  const setFilter = useStore((s) => s.setFilter);
  const setSort = useStore((s) => s.setSort);
  const selectedEntityId = useStore((s) => s.selectedEntityId);
  const selectEntity = useStore((s) => s.selectEntity);
  const pinnedEntities = useStore((s) => s.pinnedEntities);
  const findings = useStore((s) => s.findings);

  const filtered = useMemo(() => {
    let list = entities;
    const q = filters.query.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => {
        if (e.displayName.toLowerCase().includes(q)) return true;
        if (e.aliases?.some((a) => a.name.toLowerCase().includes(q))) return true;
        return false;
      });
    }
    if (filters.maskedOnly) list = list.filter((e) => e.isMasked);
    if (filters.direction === "Debit") list = list.filter((e) => (e.totalDebit || 0) > 0);
    else if (filters.direction === "Credit") list = list.filter((e) => (e.totalCredit || 0) > 0);
    if (filters.flagType) {
      const ids = new Set(findings.filter((f) => f.type === filters.flagType).map((f) => f.entityId));
      list = list.filter((e) => ids.has(e.entityId));
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    const key = sort.field;
    list = [...list].sort((a, b) => {
      // pinned first
      const ap = pinnedEntities.includes(a.entityId) ? 1 : 0;
      const bp = pinnedEntities.includes(b.entityId) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const av = a[key] ?? 0;
      const bv = b[key] ?? 0;
      if (av instanceof Date && bv instanceof Date) return (av.getTime() - bv.getTime()) * dir;
      if (typeof av === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return list;
  }, [entities, filters, sort, pinnedEntities, findings]);

  return (
    <aside className="w-80 flex-shrink-0 border-r border-slate-800 bg-slate-900/40 flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-slate-800">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-500 mb-2">
          entities · {entities.length}
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            data-testid={TID.searchInput}
            value={filters.query}
            onChange={(e) => setFilter({ query: e.target.value })}
            placeholder="search names, aliases…"
            className="w-full bg-slate-950 border border-slate-800 pl-8 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 font-mono"
          />
        </div>

        <div className="flex items-center gap-2 mt-3">
          <ArrowDownUp className="w-3 h-3 text-slate-500" />
          <select
            data-testid={TID.sortSelect}
            value={sort.field}
            onChange={(e) => setSort({ field: e.target.value, dir: sort.dir })}
            className="flex-1 bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSort({ ...sort, dir: sort.dir === "asc" ? "desc" : "asc" })}
            className="text-xs text-slate-400 hover:text-amber-400 px-2 py-1 border border-slate-800 font-mono"
            title="Toggle direction"
          >
            {sort.dir === "asc" ? "ASC" : "DESC"}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {[
            { val: "all", label: "all" },
            { val: "Debit", label: "debit" },
            { val: "Credit", label: "credit" },
          ].map((f) => (
            <button
              key={f.val}
              data-testid={`${TID.directionFilter}-${f.val.toLowerCase()}`}
              onClick={() => setFilter({ direction: f.val })}
              className={`text-[11px] font-mono uppercase tracking-wider px-2 py-1 border transition-colors ${
                filters.direction === f.val
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                  : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            data-testid="masked-filter"
            onClick={() => setFilter({ maskedOnly: !filters.maskedOnly })}
            className={`text-[11px] font-mono uppercase tracking-wider px-2 py-1 border transition-colors ${
              filters.maskedOnly
                ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
            }`}
          >
            masked
          </button>
        </div>
      </div>

      <div data-testid={TID.entityList} className="flex-1 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-500 font-mono">no entities match</div>
        )}
        {filtered.map((e) => {
          const active = e.entityId === selectedEntityId;
          const pinned = pinnedEntities.includes(e.entityId);
          return (
            <button
              key={e.entityId}
              data-testid={TID.entityListItem}
              data-entity-id={e.entityId}
              onClick={() => selectEntity(e.entityId)}
              className={`w-full text-left px-3 py-2.5 border-b border-slate-800/70 hover:bg-slate-800/60 transition-colors flex flex-col gap-1 ${
                active ? "bg-slate-800 border-l-2 border-l-amber-500 pl-[10px]" : ""
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {pinned && <Pin className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                {e.suspiciousScore >= 3 && (
                  <AlertOctagon className="w-3 h-3 text-red-400 flex-shrink-0" />
                )}
                <div className="font-mono text-sm text-slate-100 truncate flex-1" title={e.displayName}>
                  {e.displayName}
                </div>
                {e.aliasCount > 1 && (
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 border border-amber-500/20">
                    {e.aliasCount}×
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-500">{e.txCount} txn</span>
                <span className={e.netFlow < 0 ? "text-red-400" : "text-emerald-400"}>
                  {fmtAmount(e.netFlow, { compact: true, signed: true })}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-600">
                <span>{fmtDateShort(e.lastDate)}</span>
                <span className="text-slate-500">conf {pct(e.clusterConfidence)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
