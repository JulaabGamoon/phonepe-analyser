# LEDGER//LENS — Forensic CSV Transaction Review

## Original problem statement
A fully client-side web application for forensic review of bank transaction CSV files. Users
upload one CSV, the app parses & normalises locally, resolves transaction names into entities,
provides drill-down navigation (Entity → Date → Transaction), detects suspicious patterns
(duplicates, recurring, bursts, round-numbers, masked accounts), and exports findings as CSV/JSON.

## Architecture
- **Purely client-side** — no backend used. The provided FastAPI server is left untouched.
- **State**: Zustand store (`/app/frontend/src/store/useStore.js`) with `persist` middleware
  storing manual merges / pins / notes / reviewed findings in `localStorage`.
- **Pipeline modules** (`/app/frontend/src/lib/`):
  - `parser.js` — PapaParse, streaming, header alias detection, error queue.
  - `normalizer.js` — match-key builder (corporate suffix strip, plural stem, initial
    collapse, masked-account class), date / amount / direction normalisers, Levenshtein.
  - `entityResolver.js` — cluster by match-key, manual merges, alias confidence.
  - `aggregator.js` — entity & time-bucket aggregates (year / month / day).
  - `patternDetector.js` — 8 detectors per spec §10.
  - `exporter.js` — CSV (flat) + JSON (snapshot of current state).
- **UI**: three-pane forensic shell (Left = entity list, Main = investigation, Right = findings)
  plus drawer for raw row detail.
- **Virtualisation**: `@tanstack/react-virtual` on the transaction table (handles 100k+ rows).
- **Design**: dark slate canvas + amber accent, Chivo / IBM Plex Sans / JetBrains Mono.

## Implemented features (Feb 2026)
- CSV upload + drag/drop + sample loader (instant demo with all spec aliases).
- Deterministic alias clustering — passes spec's must/must-not examples
  (DSOFT BUILDCON × 4, M K ENTERPRISES × 4, LATA PILLAY × 3; Suraj Sarode vs Suraj Sharma kept
  apart; Mukesh Traders vs Mukesh Transport kept apart; etc.).
- Cluster confidence score (avg alias similarity vs display name) + per-alias confidence.
- Entity Explorer with search, masked filter, debit/credit chip, 7 sort fields, pinning.
- Entity Investigation View: 6-card metric grid, yearly/monthly breakdown tables,
  virtualised transactions, investigator notes (persisted).
- Date Drill-Down (Level 3) — cross-entity transactions on a given date.
- Transaction Detail drawer (Level 4) — raw row JSON, entity match explanation, related
  patterns, same-day peers, same-amount history.
- Suspicious detectors: same-day duplicate, repeated amount, recurring sequence, burst,
  multiple transfers, abnormal small, round-number, masked account.
- Mark-as-reviewed, ignore alias, pin entity, notes.
- Export CSV (flat current view) + JSON (full investigation snapshot with filters, notes,
  manual merges, findings).
- Error queue with downloadable CSV report.

## Backlog / not yet implemented
- P1: Manual merge UI (currently store action exists; needs a "merge suggestions" modal).
- P1: Web Worker offload for very large parses.
- P2: Sankey / timeline chart visualisation.
- P2: Manual entity split (un-merge a single alias).
- P2: Time-of-day sort if CSV provides timestamps.

## Open spec decisions (locked)
- Manual merges persist in localStorage AND embed in JSON export.
- Date drill-down shows ALL entities active on that date.
- Confidence scores shown both per-alias and per-cluster.
- Duplicate detection uses EXACT amount match; "abnormal small" uses tolerance band vs median.
- Transaction table is fully virtualised.
