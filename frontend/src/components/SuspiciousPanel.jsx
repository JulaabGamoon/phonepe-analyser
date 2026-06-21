import React, { useMemo } from "react";
import { useStore } from "../store/useStore";
import { TID } from "../constants/testIds";
import { fmtAmount, pct } from "../lib/format";
import { CheckCircle2, EyeOff, Asterisk, AlertOctagon, Repeat, Layers, Hash, ArrowDownUp, ArrowLeftRight, SplitSquareHorizontal } from "lucide-react";

const SEV_BORDER = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-blue-500",
};
const SEV_TEXT = {
  high: "text-red-400",
  medium: "text-amber-400",
  low: "text-blue-400",
};
const TYPE_ICON = {
  same_day_duplicate: Layers,
  repeated_amount: Hash,
  recurring_sequence: Repeat,
  burst_activity: ArrowDownUp,
  multiple_transfers: ArrowDownUp,
  round_number: Hash,
  masked_account: Asterisk,
  abnormal_small: AlertOctagon,
  self_transfer: ArrowLeftRight,
};

export default function SuspiciousPanel() {
  const entity = useStore((s) => s.entityById.get(s.selectedEntityId));
  const findings = useStore((s) => s.findings);
  const filters = useStore((s) => s.filters);
  const setFilter = useStore((s) => s.setFilter);
  const reviewed = useStore((s) => s.reviewedFindings);
  const markFindingReviewed = useStore((s) => s.markFindingReviewed);
  const ignoreAlias = useStore((s) => s.ignoreAlias);
  const splitAlias = useStore((s) => s.splitAlias);
  const forcedSplits = useStore((s) => s.forcedSplits);
  const selectEntity = useStore((s) => s.selectEntity);
  const selectTransaction = useStore((s) => s.selectTransaction);

  // Group findings: entity-scoped first, then portfolio (others)
  const entityFindings = useMemo(
    () => (entity ? findings.filter((f) => f.entityId === entity.entityId) : []),
    [entity, findings]
  );
  const otherFindings = useMemo(
    () => (entity ? findings.filter((f) => f.entityId !== entity.entityId) : findings).slice(0, 60),
    [entity, findings]
  );

  const flagCounts = useMemo(() => {
    const m = {};
    for (const f of findings) m[f.type] = (m[f.type] || 0) + 1;
    return m;
  }, [findings]);

  return (
    <aside
      data-testid={TID.suspiciousPanel}
      className="w-80 lg:w-96 flex-shrink-0 border-l border-slate-800 bg-slate-900/40 flex flex-col overflow-hidden"
    >
      <div className="px-4 pt-4 pb-3 border-b border-slate-800">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-500 mb-3">
          findings · {findings.length}
        </div>

        {/* Flag type filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(flagCounts).map(([type, n]) => (
            <button
              key={type}
              data-testid={`${TID.flagFilterChip}-${type}`}
              onClick={() =>
                setFilter({ flagType: filters.flagType === type ? null : type })
              }
              className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 border transition-colors ${
                filters.flagType === type
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                  : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
              }`}
              title={type.replace(/_/g, " ")}
            >
              {type.replace(/_/g, " ")} · {n}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Similar Names / Aliases for selected entity */}
        {entity && (
          <div data-testid={TID.similarNames} className="border-b border-slate-800">
            <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500 bg-slate-900/60">
              similar names · {entity.aliasCount}
            </div>
            {entity.aliases.map((a) => {
              const isSplit = forcedSplits.includes(a.name);
              return (
              <div
                key={a.name}
                data-testid={TID.aliasRow}
                className={`px-3 py-2 border-b border-slate-800/60 text-xs font-mono ${
                  a.ignored ? "opacity-40" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-200 truncate" title={a.name}>
                    {a.name}
                  </span>
                  <span className="text-amber-400">{pct(a.confidence)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-slate-600">×{a.count}</span>
                  <div className="flex items-center gap-2">
                    {entity.aliasCount > 1 && (
                      <button
                        data-testid={TID.splitAliasBtn}
                        onClick={() => splitAlias(a.name)}
                        className={`text-[10px] uppercase tracking-wider flex items-center gap-1 ${
                          isSplit
                            ? "text-amber-400"
                            : "text-slate-500 hover:text-amber-400"
                        }`}
                        title={isSplit ? "un-split this alias" : "split this alias into its own entity"}
                      >
                        <SplitSquareHorizontal className="w-3 h-3" />
                        {isSplit ? "splitting" : "split"}
                      </button>
                    )}
                    <button
                      data-testid={TID.ignoreAliasBtn}
                      onClick={() => ignoreAlias(entity.entityId, a.name)}
                      className="text-[10px] text-slate-500 hover:text-amber-400 uppercase tracking-wider flex items-center gap-1"
                    >
                      <EyeOff className="w-3 h-3" />
                      {a.ignored ? "restore" : "ignore"}
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Findings list */}
        <div>
          {entity && entityFindings.length > 0 && (
            <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-500 bg-slate-900/60 border-b border-slate-800">
              for {entity.displayName}
            </div>
          )}
          {entityFindings.map((f) => (
            <FindingRow
              key={f.id}
              f={f}
              reviewed={reviewed.includes(f.id)}
              onClickFinding={(f) => {
                selectEntity(f.entityId);
                if (f.transactionIds[0]) selectTransaction(f.transactionIds[0]);
              }}
              onMarkReviewed={markFindingReviewed}
            />
          ))}

          {!entity && findings.length === 0 && (
            <div className="p-6 text-center text-xs font-mono text-slate-500">no findings yet</div>
          )}

          {otherFindings.length > 0 && (
            <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500 bg-slate-900/60 border-b border-t border-slate-800">
              {entity ? "across portfolio" : "all findings"}
            </div>
          )}
          {otherFindings
            .filter((f) => !filters.flagType || f.type === filters.flagType)
            .map((f) => (
              <FindingRow
                key={f.id}
                f={f}
                reviewed={reviewed.includes(f.id)}
                onClickFinding={(f) => {
                  selectEntity(f.entityId);
                  if (f.transactionIds[0]) selectTransaction(f.transactionIds[0]);
                }}
                onMarkReviewed={markFindingReviewed}
              />
            ))}
        </div>
      </div>
    </aside>
  );
}

function FindingRow({ f, reviewed, onClickFinding, onMarkReviewed }) {
  const Icon = TYPE_ICON[f.type] || AlertOctagon;
  return (
    <div
      data-testid={TID.findingRow}
      data-finding-id={f.id}
      className={`px-3 py-2 border-b border-slate-800/60 border-l-2 ${
        SEV_BORDER[f.severity]
      } bg-slate-900/40 ${reviewed ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-2">
        <Icon className={`w-3.5 h-3.5 mt-0.5 ${SEV_TEXT[f.severity]} flex-shrink-0`} />
        <div className="min-w-0 flex-1">
          <button
            onClick={() => onClickFinding(f)}
            className="text-left text-xs font-mono text-slate-100 hover:text-amber-400 truncate w-full"
            title={f.label}
          >
            {f.label}
          </button>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5 leading-relaxed">
            {f.reason}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className={`text-[10px] font-mono uppercase tracking-wider ${SEV_TEXT[f.severity]}`}>
              {f.severity} · {pct(f.confidence)}
            </span>
            <button
              data-testid={TID.reviewedBtn}
              onClick={() => onMarkReviewed(f.id)}
              className={`text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 ${
                reviewed ? "text-emerald-400" : "text-slate-500 hover:text-emerald-400"
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              {reviewed ? "reviewed" : "mark reviewed"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
