# Development Plan: djmix — AI DJ Set Builder

> **Generated:** 2026-07-01
> **PRD Version:** PRD.md (Draft v1, decisions resolved)

## Executive Summary

djmix is a client-heavy web app: audio analysis and set sequencing run entirely in the browser (Web Workers + Essentia.js WASM); Supabase provides auth, the community feature cache, and saved-set persistence. The plan front-loads the two highest-risk systems — the analysis pipeline and the sequencing engine — behind a scaffolded foundation, builds the UI on top of proven engines, and finishes with persistence, export, and deployment. The engines are pure logic with typed inputs/outputs, so they are developed test-first against fixtures before any UI exists.

**Total Phases:** 5
**Total Chunks:** 17
**Estimated Total Effort:** ~10 L-equivalents (roughly 6–9 weeks solo with AI assistance)

---

## Phase Overview

```
Phase 1: Foundation ─────────────────────────────────►
  └── 1.1 ─┬→ 1.2
           └→ 1.3   (1.2 ∥ 1.3)

Phase 2: Analysis Engine ────────────────────────────►
  └── 2.1 → 2.2 → 2.3 → 2.5
              └→ 2.4 (parallel with 2.3)

Phase 3: Sequencing Engine ──────────────────────────►
  └── 3.1 → 3.2 → 3.3   (parallel with Phase 4 start)

Phase 4: Set Builder UI ─────────────────────────────►
  └── 4.1 → 4.2 → 4.3 → 4.4

Phase 5: Persistence, Export & Launch ───────────────►
  └── 5.1 ∥ 5.2 → 5.3 → 5.4
```

---

## Phase 1: Foundation

**Objective:** Working development environment with the two riskiest technical unknowns de-risked: WASM analysis running in a worker, and Supabase auth + schema in place.

**Prerequisites:** None (first phase)

**Success Criteria:**

- [ ] `npm run dev` serves the app with COOP/COEP headers; `npm run test`, `lint`, `build` all pass
- [ ] Essentia.js computes a feature inside a Web Worker on a test file
- [ ] A user can sign up / sign in (email + Google) against Supabase

**Estimated Effort:** 1× M + 2× L

---

### Chunk 1.1: Project Scaffolding

**Prerequisites:** None

**Estimated Effort:** M

**Test Criteria:**

- [x] Vite dev server runs with React + TS strict + Tailwind
- [x] Vitest sample test passes; ESLint/Prettier configured
- [x] Dev server sends `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (verified via curl on preview)

**Tasks:**

#### Task 1.1.1: Initialize Vite + React + TypeScript project

- **Acceptance:** TS strict mode; path aliases; folder layout `src/{analysis,sequencing,ingestion,ui,state,storage,export}`.
- **Files:** `package.json`, `vite.config.ts`, `tsconfig.json`, `src/`

#### Task 1.1.2: Tooling — Tailwind, ESLint, Prettier, Vitest

- **Acceptance:** `npm run lint`, `npm run test`, `npm run build` all pass clean.

#### Task 1.1.3: COOP/COEP headers in dev and preview

- **Acceptance:** Headers verified in devtools; documented in README why they exist (SharedArrayBuffer/threaded WASM).
- **Notes:** Do this now — retrofitting is a classic time sink (PRD stack note).

#### Task 1.1.4: Git repo + GitHub remote + CI stub

- **Acceptance:** GitHub Actions workflow runs lint + test on push.

---

### Chunk 1.2: Supabase Project & Schema v1

**Prerequisites:** 1.1 (parallel with 1.3)

**Estimated Effort:** L

**Test Criteria:**

- [x] Email sign-in wired and configured (Google deferred — button coded, needs Google Cloud creds)
- [x] Tables: `profiles`, `sets`, `track_features` (community cache, keyed by content hash), `user_tracks` (per-user library entries + manual overrides) — migration applied to live project
- [~] RLS policies applied; verification script `supabase/tests/rls_checks.sql` provided (run against live DB to confirm the matrix)
- [x] Feature JSON stored as `jsonb` with a GIN index

**Tasks:**

#### Task 1.2.1: Create Supabase project, enable auth providers

- **Acceptance:** Both providers work in local dev; redirect URLs configured.

#### Task 1.2.2: Schema v1 migration

- **Acceptance:** Migration file in repo (`supabase/migrations/`); types generated for the client (`supabase gen types`).
- **Notes:** ⚠ Shared state — all later chunks depend on this schema; changes after Phase 2 require migrations. Keep Supabase keys in untracked env files only.

#### Task 1.2.3: RLS policies + tests

- **Acceptance:** SQL tests (or scripted checks) proving the access matrix above.

**Progress (code authored, awaiting live project):**

- [x] Client wiring (`src/lib/supabase.ts`, memoized, config-guarded), typed env, hand-written `Database` types, minimal auth harness (`AuthPanel` + `useSession`) with email-link + Google buttons
- [x] Schema v1 migration authored (`supabase/migrations/20260702000000_schema_v1.sql`): all four tables, RLS policies, `track_features` GIN index, profile-on-signup trigger, updated_at triggers
- [x] RLS check script (`supabase/tests/rls_checks.sql`)
- [ ] **Needs user's project:** apply migration, configure Google OAuth (Google Cloud creds), set `.env.local`, then verify sign-in + run RLS checks + regenerate types

---

### Chunk 1.3: Worker + WASM Infrastructure

**Prerequisites:** 1.1 (parallel with 1.2)

**Estimated Effort:** L

**Test Criteria:**

- [x] A Comlink-wrapped worker loads Essentia.js WASM and returns a computed feature (RMS) for a fixture file
- [x] Worker pool sized to `navigator.hardwareConcurrency - 1`, processes N jobs concurrently (queues excess)
- [x] Analysis bundle is lazy-loaded (dynamic essentia imports + separate worker chunk); confirmed in the initial-page bundle once the UI wires the pool in Chunk 2.1

**Decision (CI testing):** Essentia's Emscripten build aborts under Node, so WASM / Web-Audio tests run in real Chromium via Vitest browser mode (`@vitest/browser-playwright`); pure logic (downmix, RMS) stays in Node/jsdom. `npm test` runs both projects; CI installs Chromium.

**⚠ Finding (licensing):** `essentia.js@0.1.3` is **AGPL-3.0** — needs a product decision before launch (see risk R8).

**Tasks:**

#### Task 1.3.1: Worker pool + Comlink plumbing

- **Acceptance:** Typed request/response interface; jobs queue when pool is saturated; progress events reach the main thread.
- **Files:** `src/analysis/worker-pool.ts`, `src/analysis/analysis.worker.ts`

#### Task 1.3.2: Essentia.js integration smoke test

- **Acceptance:** Fixture WAV decoded via OfflineAudioContext → mono downmix → Essentia RMS matches known value within tolerance; runs in CI (headless browser or node shim — decide and document).
- **Notes:** 🔶 De-risking spike — if Essentia.js has blocking issues, this is the earliest possible moment to discover and pick fallbacks (Meyda + custom DSP).

---

### Phase 1 Completion Checklist

- [ ] All chunks 1.1–1.3 complete, test criteria passing
- [ ] CI green; repo pushed
- [ ] Phase success criteria met

---

## Phase 2: Analysis Engine (PRD F1–F3)

**Objective:** Select local files → full per-section feature JSON, with accuracy validated against a reference suite and results cached locally + community-wide.

**Prerequisites:** Phase 1 complete

**Success Criteria:**

- [ ] 20-track playlist analyzes end-to-end at ≤ ~3 s/track on a mid-range laptop
- [ ] Accuracy harness: BPM ±0.1 ≥ 95%, key ≥ 85%, vocal ≥ 90% on the reference suite
- [ ] Re-adding an analyzed track is near-instant (cache hit, local or community)

**Estimated Effort:** 1× M + 4× L

---

### Chunk 2.1: File Ingestion & Hashing (F1)

**Prerequisites:** Phase 1

**Estimated Effort:** M

**Test Criteria:**

- [x] File System Access API picker (files + directory) with capability detection; `<input type="file" multiple>` fallback (cross-browser manual check pending)
- [x] MP3/WAV/FLAC/M4A/AAC accepted; unsupported filtered out (a "skipped N unsupported" notice is a small UI follow-up)
- [x] Content hash (size + head/tail chunks) stable across re-selection — verified in-browser

**Tasks:**

#### Task 2.1.1: Track intake module with both picker paths

- **Acceptance:** Returns a normalized `TrackFile[]`; capability-detects the API.
- **Files:** `src/ingestion/`

#### Task 2.1.2: Metadata tag reading + content hashing

- **Acceptance:** Title/artist/existing BPM-key tags extracted (display only, per PRD); hash unit-tested against fixtures.

---

### Chunk 2.2: Core DSP Features (F2 part 1)

**Prerequisites:** 2.1

**Estimated Effort:** L

**Test Criteria:**

- [x] BPM + beat grid with confidence; half/double-time candidates surfaced
- [x] Key + scale → Camelot code with confidence
- [x] Normalized energy curve + 1–10 energy score; spike list (energy-novelty based)
- [x] Feature JSON schema v1 defined, versioned (`schemaVersion`), documented — provisional until 2.3 adds sections/instrumentation

**Architecture:** engine behind an `Analyzer` interface (`EssentiaAnalyzer` = first impl); only BPM + key use Essentia, energy/spikes are pure DSP → swappable engine (R8 mitigation realized).

**Finding:** `RhythmExtractor2013` (multifeature) is not bit-deterministic (~1 BPM run-to-run). Feeds into 2.4 (harness tolerance) and cache semantics — first-writer-wins is fine given the wobble is < rounding error for beatgridding.

**Tasks:**

#### Task 2.2.1: Decode + preprocess stage (mono, analysis sample rate)

- **Acceptance:** Deterministic output for a fixture; memory released after each track (no tab growth over 50-track run).

#### Task 2.2.2: Rhythm extractor (BPM, grid, onsets)

- **Acceptance:** Matches ground truth on 10 hand-labeled fixtures.

#### Task 2.2.3: Key extractor + Camelot mapping

- **Acceptance:** Camelot mapping unit-tested for all 24 keys.

#### Task 2.2.4: Energy curve + spike detection + feature JSON assembly

- **Acceptance:** JSON validates against the schema; size ≤ ~50 KB/track.
- **Notes:** ⚠ Schema is shared state with 2.5, 3.x, and Supabase `track_features` — version it from day one.

---

### Chunk 2.3: Structure & Instrumentation Profile (F2 part 2)

**Prerequisites:** 2.2

**Estimated Effort:** L

**Test Criteria:**

- [x] Section boundaries labeled intro/build/drop/breakdown/outro (energy-novelty, beat-snapped, graceful degradation); real-audio spot-check pending 2.4
- [~] Per-section profile: percussiveness (spectral-flux proxy), bass weight, brightness, density — **done**; **vocal presence deferred** (needs the ML model spike, see below). `vocalPresence` is optional in the schema so it slots in without a breaking change.
- [x] No genre or instrument-name output anywhere (PRD honest-features principle)

**Deferred — voice/instrumental model (Task 2.3.2):** the real vocal detector is a TFJS + pre-trained-weights integration with a COEP `require-corp` interaction (cross-origin weight fetch) and bundle-size cost. It deserves its own de-risking spike like Essentia got, and needs a decision (which model, where to host weights). Left a heuristic-free gap rather than a low-quality proxy (honest-features). Tracked as a decision point.

**Tasks:**

#### Task 2.3.1: Structure segmentation (novelty + self-similarity)

- **Acceptance:** Every track gets ≥ intro/body/outro even on degenerate input; boundaries snap to the beat grid.

#### Task 2.3.2: Voice/instrumental model integration

- **Acceptance:** Model lazy-loads (few MB); per-segment vocal flags on fixtures ≥ 90% accurate.

#### Task 2.3.3: HPSS, band energy, brightness, density per section

- **Acceptance:** Values in documented normalized ranges; stable across re-analysis.

---

### Chunk 2.4: Accuracy Harness (parallel with 2.3)

**Prerequisites:** 2.2

**Estimated Effort:** M _(user input needed: reference tracks)_

**Test Criteria:**

- [ ] ≥ 30 reference tracks with ground-truth BPM/key (user-supplied or public datasets like GiantSteps key/tempo)
- [ ] `npm run test:accuracy` prints per-metric pass/fail vs. PRD NFR targets
- [ ] Runs in CI on a small subset; full suite locally

**Tasks:**

#### Task 2.4.1: Harness + ground-truth format

- **Acceptance:** CSV/JSON manifest of expected values; tolerance logic (BPM ±0.1, half/double-time counted correctly).

#### Task 2.4.2: Baseline report + tuning pass

- **Acceptance:** Documented baseline; extractor parameters tuned until targets met or gaps ticketed.
- **Notes:** 🔷 Decision point — if key accuracy < 85% with Essentia defaults, evaluate alternative key profiles before proceeding to Phase 3 (sequencing trusts these values).

---

### Chunk 2.5: Feature Caching — IndexedDB + Community Cache (F3)

**Prerequisites:** 2.3, 1.2

**Estimated Effort:** L

**Test Criteria:**

- [ ] Cache lookup order: IndexedDB → Supabase community cache → analyze; verified by instrumented test
- [ ] Analyzing a track upserts `track_features` (schema-versioned) and IndexedDB
- [ ] Signed-out users still get IndexedDB caching (community cache requires auth)
- [ ] Manual BPM/key overrides stored per-user (`user_tracks`), never overwrite community values

**Tasks:**

#### Task 2.5.1: IndexedDB feature store

- **Acceptance:** Versioned store; survives reload; eviction strategy documented.

#### Task 2.5.2: Community cache read/write + override layering

- **Acceptance:** Cache hit skips analysis entirely; override precedence unit-tested (user override > community > fresh analysis).

---

### Phase 2 Completion Checklist

- [ ] Chunks 2.1–2.5 complete; accuracy targets met or consciously waived with tickets
- [ ] 50-track soak test: no memory growth, no worker deadlocks
- [ ] Feature JSON schema v1 frozen and documented

---

## Phase 3: Sequencing Engine (PRD F4, F8 core)

**Objective:** Feature JSON in → ordered set + per-transition explanations out. Pure TypeScript, fully unit-testable, no UI dependency.

**Prerequisites:** Phase 2 (schema frozen); can start 3.1 once 2.2's schema exists, using synthetic fixtures

**Success Criteria:**

- [ ] 100 synthetic tracks sequenced in ≤ 10 s in a worker
- [ ] Anchors respected; anti-monotony behaviors demonstrable in tests
- [ ] Misfit detection flags planted outliers (e.g., 88 BPM vocal track among 124 BPM instrumentals)

**Estimated Effort:** 1× M + 2× L

---

### Chunk 3.1: Transition Scoring Module

**Prerequisites:** 2.2 (feature schema) — synthetic fixtures OK

**Estimated Effort:** L

**Test Criteria:**

- [x] Scores A.outro → B.intro (per-section, not track averages)
- [x] Terms implemented: Camelot distance, BPM incl. half/double-time, energy continuity, vocal clash penalty, percussive/melodic handoff, bass conflict, brightness/density continuity
- [x] All weights in one centralized, tunable config (`weights.ts`)
- [x] Property tests: identical→high, clash→low, key/bpm symmetric, section terms directional

**Note:** total renormalizes over _available_ terms, so the deferred vocal term auto-activates (no code change) once vocal presence is measured. Explanation notes per term feed the F5 inspector (3.1.3 done).

**Tasks:**

#### Task 3.1.1: Scoring types + synthetic fixture builder

- **Acceptance:** Fixture builder can generate tracks with arbitrary feature profiles for tests.
- **Files:** `src/sequencing/scoring.ts`, `src/sequencing/fixtures.ts`

#### Task 3.1.2: Implement all scoring terms + weight config

- **Acceptance:** Each term unit-tested in isolation with named test cases mirroring PRD language.

#### Task 3.1.3: Explanation generator

- **Acceptance:** Every score decomposes into human-readable term contributions (feeds F5 transition inspector).

---

### Chunk 3.2: Global Optimizer

**Prerequisites:** 3.1

**Estimated Effort:** L

**Test Criteria:**

- [ ] Arc presets (warm-up / peak-time / journey / flat) as target energy **and tempo** curves
- [ ] Start/end anchors held fixed; locked mid-set tracks respected
- [ ] Anti-monotony verified: same-key streak penalty and texture-diversity penalty change orderings in targeted tests
- [ ] Runs in a worker; 100 tracks ≤ 10 s; deterministic given a seed

**Tasks:**

#### Task 3.2.1: Optimizer core (beam search or simulated annealing — benchmark both, pick one)

- **Acceptance:** Beats greedy-nearest-neighbor baseline on total score across 20 random synthetic playlists.
- **Notes:** 🔷 Decision point — algorithm choice documented with the benchmark.

#### Task 3.2.2: Arc fitting + anchors + anti-monotony terms

- **Acceptance:** Warm-up preset produces monotonically-trending energy/tempo opening in tests; key-streak test shows movement.

#### Task 3.2.3: Output assembly — ordered set, transition breakdowns, mix-point suggestions, warnings

- **Acceptance:** Output type consumed as-is by F5 UI (no UI-side recomputation).

---

### Chunk 3.3: Fit Scores, Misfit Flags & Bench (F8 core)

**Prerequisites:** 3.2

**Estimated Effort:** M

**Test Criteria:**

- [ ] Pre-optimization centroid-distance fit score + post-optimization transition-based fit score
- [ ] Planted hip-hop-profile track in tech-house-profile playlist gets flagged with a plain-language, feature-based reason string
- [ ] Bench list excluded from optimization but preserved in state; re-inclusion re-optimizes

**Tasks:**

#### Task 3.3.1: Fit score computation + flag thresholds

- **Acceptance:** Thresholds tunable in the central config; no genre vocabulary in reason strings (PRD honest-features principle).

#### Task 3.3.2: Bench state semantics + half/double-time bridge suggestions for kept outliers

- **Acceptance:** Keep/bench/re-include flows covered by unit tests.

---

### Phase 3 Completion Checklist

- [ ] Chunks 3.1–3.3 complete; engine consumed only via its public typed API
- [ ] Real-audio smoke test: analyze 20 real tracks (Phase 2) → sequence → manually sanity-check order plausibility

---

## Phase 4: Set Builder UI (PRD F5)

**Objective:** The full user-facing flow: intake → analysis progress → generated set on a visual timeline → edit → inspect transitions → preview junctions.

**Prerequisites:** Phase 2 complete; Phase 3.1–3.2 complete (4.1 can start after Phase 2)

**Success Criteria:**

- [ ] End-to-end flow works on a real 20-track playlist without devtools
- [ ] Drag-reorder re-scores affected transitions in < 100 ms
- [ ] Misfit/bench UX matches PRD F8 (flag reasons on hover, bench alongside timeline)

**Estimated Effort:** 1× M + 3× L

---

### Chunk 4.1: App Shell, Auth & Intake Flow

**Prerequisites:** Phase 2

**Estimated Effort:** L

**Test Criteria:**

- [ ] Sign-in/out, session persistence; signed-out users can still analyze + sequence (nudge to save)
- [ ] Intake: pickers, per-track analysis progress, cache hits shown as instant
- [ ] Set parameters form: duration, arc preset, optional start/end anchor pickers

**Tasks:**

#### Task 4.1.1: Routing, layout, auth screens (Supabase UI helpers)

#### Task 4.1.2: Intake + progress screen wired to worker pool and caches

#### Task 4.1.3: Set parameter form → engine invocation → results state (Zustand)

---

### Chunk 4.2: Timeline Visualization

**Prerequisites:** 4.1, 3.2

**Estimated Effort:** L

**Test Criteria:**

- [ ] Tracks rendered as blocks: energy curve, section colors, vocal regions, key/BPM labels
- [ ] Set-wide energy arc overlaid on the target preset curve
- [ ] 60 fps pan/zoom on a 100-track set (Canvas 2D, devicePixelRatio-aware)

**Tasks:**

#### Task 4.2.1: Canvas renderer with layered draw model (static track layer / overlay layer)

#### Task 4.2.2: Arc overlay + hover states + hit-testing utilities

---

### Chunk 4.3: Editing Interactions

**Prerequisites:** 4.2, 3.3

**Estimated Effort:** L

**Test Criteria:**

- [ ] Drag-to-reorder with live re-scoring of affected junctions; lock/anchor toggles
- [ ] Misfit indicators with reason-on-hover; bench panel with one-click bench/restore (restore triggers re-optimize prompt)
- [ ] Manual BPM/key override editor per track (persists per 2.5 layering)

**Tasks:**

#### Task 4.3.1: Drag/drop + locks + incremental re-score wiring

#### Task 4.3.2: Misfit + bench UI (F8)

#### Task 4.3.3: Track detail panel with overrides

---

### Chunk 4.4: Transition Inspector & Junction Preview

**Prerequisites:** 4.3

**Estimated Effort:** M

**Test Criteria:**

- [ ] Clicking a junction shows the score breakdown (from 3.1.3 explanations) + recommended mix window
- [ ] Play button previews outgoing-outro → incoming-intro from the local files (re-request file handles if permissions lapsed)

**Tasks:**

#### Task 4.4.1: Inspector panel rendering score decomposition

#### Task 4.4.2: Junction audio preview (Web Audio, simple crossfade at the suggested mix point)

---

### Phase 4 Completion Checklist

- [ ] Chunks 4.1–4.4 complete; full flow demo recorded
- [ ] Playwright smoke test covers intake → sequence → reorder → inspect

---

## Phase 5: Persistence, Export & Launch (PRD F6–F7 completion)

**Objective:** Saved sets sync, exports work in real DJ software, app deployed publicly with the privacy story stated.

**Prerequisites:** Phase 4 complete (5.1 and 5.2 can run in parallel)

**Success Criteria:**

- [ ] A set saved on machine A opens on machine B (feature JSON travels; audio obviously doesn't)
- [ ] Rekordbox imports the exported XML with correct order, BPM, key
- [ ] Deployed with COOP/COEP headers; privacy policy live

**Estimated Effort:** 2× M + 2× L

---

### Chunk 5.1: Saved Sets & Sync (F7 completion)

**Prerequisites:** Phase 4 (parallel with 5.2)

**Estimated Effort:** L

**Test Criteria:**

- [ ] Sets autosave; list/rename/duplicate/delete; TanStack Query cache-and-sync verified offline→online
- [ ] Opening a synced set on a machine without the audio files degrades gracefully (sequence + features visible; preview disabled with explanation)

**Tasks:**

#### Task 5.1.1: Set persistence model + CRUD + autosave

#### Task 5.1.2: Missing-local-file degradation UX

---

### Chunk 5.2: Exports (F6)

**Prerequisites:** Phase 4 (parallel with 5.1)

**Estimated Effort:** M

**Test Criteria:**

- [ ] M3U8 opens in VLC/foobar in order
- [ ] Rekordbox XML imports into Rekordbox with order, BPM, key intact _(user validation — requires Rekordbox install)_
- [ ] Set sheet (markdown → print/PDF) lists order, keys, BPMs, mix points, warnings

**Tasks:**

#### Task 5.2.1: M3U8 + Rekordbox XML writers with unit-tested output against captured real examples

#### Task 5.2.2: Set sheet generator

---

### Chunk 5.3: E2E, Performance & Hardening

**Prerequisites:** 5.1, 5.2

**Estimated Effort:** L

**Test Criteria:**

- [ ] Playwright covers: auth, intake (fixture files), analysis, sequencing, reorder, bench, export download, saved-set reload
- [ ] Performance NFRs re-verified: ≤ 3 s/track analysis, ≤ 10 s/100-track sequencing, UI responsive during analysis
- [ ] Firefox/Safari fallback path manually verified

**Tasks:**

#### Task 5.3.1: E2E suite + CI integration

#### Task 5.3.2: Performance audit + fixes; error boundaries + user-facing failure states

---

### Chunk 5.4: Deployment & Privacy

**Prerequisites:** 5.3

**Estimated Effort:** M

**Test Criteria:**

- [ ] Deployed to Cloudflare Pages or Vercel with COOP/COEP headers verified in production
- [ ] Supabase production project with prod redirect URLs; keys only in host env vars
- [ ] Privacy policy page live ("audio never leaves your device" stated and true)

**Tasks:**

#### Task 5.4.1: Production infra + header config + domain

#### Task 5.4.2: Privacy policy + landing copy

- **Notes:** 🔶 Rollback: static hosting → instant rollback via previous deployment; Supabase migrations are forward-only, so gate schema changes behind the export of a backup.

---

### Phase 5 Completion Checklist

- [ ] MVP success metrics from PRD §7 measurable (instrument reorder-count before export)
- [ ] Post-MVP backlog seeded: F8 library swaps (stretch), free-drawn arc, Beatport (Phase 2 PRD)

---

## Appendices

### A. Dependency Graph

```
1.1 ─┬─► 1.2 ─────────────────────┐
     └─► 1.3 ──► 2.1 ──► 2.2 ──► 2.3 ──► 2.5
                          │  └──► 2.4 (∥ 2.3)
                          ▼
                         3.1 ──► 3.2 ──► 3.3
                                  │       │
               Phase 2 ──► 4.1 ──► 4.2 ──► 4.3 ──► 4.4
                                                    │
                                         ┌── 5.1 (∥ 5.2) ──┐
                                         └── 5.2 ──────────┴─► 5.3 ──► 5.4
```

### B. Risk Register

| ID  | Risk                                                                                       | Impact | Probability | Mitigation                                                                                                                                  | Contingency                                                                                  | Affected Chunks |
| --- | ------------------------------------------------------------------------------------------ | ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------- |
| R1  | Essentia.js gaps/bugs (loading, algorithms, threading)                                     | High   | Retired     | Spike 1.3 done: WASM loads + computes RMS in a Chromium worker                                                                              | Meyda + custom DSP; server-side analysis as last resort (breaks a core principle — escalate) | 1.3, 2.2, 2.3   |
| R8  | essentia.js is AGPL-3.0; network copyleft may force source disclosure for a hosted product | High   | Medium      | Product/legal decision before launch (accept & open-source / reimplement needed DSP under permissive license / commercial license from MTG) | Swap analysis lib — callers are insulated behind the worker API                              | 1.3, 2.2, 2.3   |
| R2  | Key/BPM accuracy below NFR targets                                                         | High   | Medium      | Accuracy harness (2.4) gates Phase 3                                                                                                        | Alternative key profiles; expose confidence + overrides prominently                          | 2.2, 2.4, 3.x   |
| R3  | Structure segmentation unreliable on real-world variety                                    | Medium | High        | Beat-grid snapping, conservative labels, manual boundary editing (PRD mitigation)                                                           | Degrade to whole-track features per PRD                                                      | 2.3, 3.1        |
| R4  | Optimizer produces plausible-but-boring sets (monotony)                                    | Medium | Medium      | Anti-monotony terms tested behaviorally (3.2)                                                                                               | Weight tuning via central config; add diversity slider post-MVP                              | 3.2             |
| R5  | Browser memory pressure on large playlists                                                 | Medium | Medium      | Per-track decode/release discipline; 50-track soak test (Phase 2 checklist)                                                                 | Chunked/sequential analysis mode                                                             | 2.2, 2.3        |
| R6  | Rekordbox XML import quirks                                                                | Medium | Medium      | Test against captured real-world XML examples                                                                                               | Ship M3U8 first; iterate XML with user validation                                            | 5.2             |
| R7  | File-handle permissions lapse between sessions                                             | Low    | High        | Re-request flow designed in 4.4/5.1                                                                                                         | Graceful degradation (preview disabled)                                                      | 4.4, 5.1        |

### C. Glossary

| Term          | Definition                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------ |
| Camelot wheel | Key notation (1A–12B) where adjacent codes are harmonically compatible                     |
| HPSS          | Harmonic-percussive source separation — DSP split of tonal vs. percussive content          |
| Arc preset    | Target energy+tempo curve for the whole set (warm-up, peak-time, journey, flat)            |
| Fit score     | How well a track sits in this playlist (centroid distance + achievable transition quality) |
| Bench         | Reserve list: excluded from sequencing, kept visible for re-inclusion                      |
| Feature JSON  | Per-track analysis output (the only thing that ever leaves the browser)                    |

### D. Change Log

| Date       | Version | Changes                                                                           |
| ---------- | ------- | --------------------------------------------------------------------------------- |
| 2026-07-01 | 1.0     | Initial plan generated from PRD.md                                                |
| 2026-07-01 | 1.1     | Removed Claude Code environment setup (chunk + tool mappings); renumbered Phase 1 |

---

## Notes for Development

### Parallel Work Opportunities

- 1.2 (Supabase) ∥ 1.3 (WASM infra) — no shared code
- 2.4 (accuracy harness) ∥ 2.3 (structure/instrumentation)
- 3.x (sequencing, fixture-driven) can begin once 2.2's schema exists — doesn't need real analysis output
- 5.1 (sync) ∥ 5.2 (exports)

### Decision Points

- **Chunk 2.4:** If key accuracy misses 85%, evaluate alternatives before Phase 3
- **Chunk 3.2:** Optimizer algorithm choice (beam search vs. simulated annealing) — decide by benchmark
- **Chunk 1.3:** Essentia.js viability — fallback is Meyda + custom DSP

### External Dependencies

- **Chunk 2.4:** Needs reference tracks with ground truth (user-supplied and/or GiantSteps datasets)
- **Chunk 5.2:** Rekordbox import validation needs a machine with Rekordbox (user)
- **Chunk 1.2 / 5.4:** Supabase account + production project (user)

---

## How to Use This Plan

1. **Before starting a chunk:** verify prerequisites are complete.
2. **During implementation:** follow the task list in order; verify acceptance criteria as you go.
3. **After a chunk:** run its test criteria, mark complete, update the plan if scope shifted.
4. **At phase boundaries:** run the completion checklist and re-review the risk register.
