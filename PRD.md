# PRD — djmix: AI DJ Set Builder

**Status:** Draft v1
**Date:** 2026-07-01
**Owner:** Yassine Fayed

---

## 1. Vision

A web-based tool that turns a DJ's playlist into a professionally sequenced set. The DJ selects tracks from their device; djmix analyzes them **entirely in the browser** — rhythm, key, energy arc, structure, spikes, and instrumentation profile — and produces an ordered set that shapes momentum across the night, with transition guidance for every track pair. No installs, no track uploads.

**One-liner:** "Drop in your playlist, get back a set that flows."

## 2. Problem

Sequencing a set well requires knowing, for every track, its BPM grid, key, energy curve, intro/outro character, and vocal placement — then solving a global ordering problem against a desired energy arc. DJs do this by memory and trial-and-error. Existing tools (DJ.Studio, Mixgraph, SetFlow) reduce each track to a handful of scalars (one BPM, one key, one energy number) and score transitions greedily, pairwise. None of them:

- analyze tracks **per-section** (a track's outro is what mixes into the next track's intro — not its "average");
- model **instrumentation** (vocal clash, percussion-led vs. melodic handoffs, bass weight conflicts);
- optimize the set as a **global arc** (warm-up → peak → cool-down) rather than a chain of locally-good transitions;
- work without uploading the DJ's audio files (a privacy and copyright concern, especially for unreleased promos and edits).

## 3. Target users

- **Primary:** club/event DJs (electronic genres: house, techno, and adjacent) preparing sets on a laptop, typically with Rekordbox or Serato libraries.
- **Secondary:** hobbyist DJs and radio/mix-show curators who want a coherent 1–2 hour mix order.

Assume desktop/laptop Chrome or Edge as the primary environment (DJs prep on laptops; File System Access API support is strongest there).

## 4. Core principles

1. **Audio never leaves the device.** All signal analysis runs client-side (Web Workers + WASM). Only extracted feature JSON (a few KB per track) is sent to the server.
2. **Per-section, not per-track.** Every feature is computed over time and summarized per structural section (intro / build / drop-chorus / breakdown / outro).
3. **Honest features only.** Expose signals we can compute reliably (vocal presence, percussiveness, bass weight, brightness, density). Never claim specific-instrument identification ("has saxophone") — known to be unreliable in dense electronic mixes.
4. **The DJ stays in control.** The generated order is a starting point: fully editable, with visible reasoning for every placement and transition score.

## 5. Scope

### In scope (MVP)

Local audio files only (MP3, WAV, FLAC, AAC/M4A). Beatport/streaming integrations are explicitly deferred.

**F1 — Track ingestion**

- Select files or folders via File System Access API; fallback to `<input type="file" multiple>` for other browsers.
- Read ID3/metadata tags (title, artist, existing BPM/key tags if present) for display; never trust tags for analysis.
- Content-hash each file (e.g., first+last N MB + size) to key the feature cache.

**F2 — In-browser analysis pipeline** (Web Workers, WASM — Essentia.js as the core DSP/ML library)

- Decode via OfflineAudioContext, downmix to mono at analysis sample rate.
- **Rhythm:** beat tracking → BPM (with confidence), beat grid, onset density.
- **Key:** key + scale → Camelot code (with confidence).
- **Energy curve:** RMS/loudness over time, normalized 0–1, plus a per-track 1–10 energy score.
- **Spikes:** onset/novelty peaks — drops, impacts, major transitions.
- **Structure segmentation:** section boundaries labeled intro / build / drop / breakdown / outro (novelty + self-similarity based).
- **Instrumentation profile, per section:**
  - vocal presence (voice/instrumental classifier; small pre-trained model, few-MB download) + intensity
  - percussiveness ratio (HPSS-based)
  - bass weight (sub/low band energy share)
  - brightness (spectral centroid)
  - layer density (spectral flatness/entropy)
- Progress UI: per-track status, overall ETA; parallelize across workers (target ≤ 3 s/track on a mid-range laptop; ~80-track playlist in a few minutes cold, near-instant when cached).

**F3 — Feature cache**

- Server-side cache of feature JSON keyed by content hash. Any track analyzed once — by any user — never re-analyzes. (Features are non-recoverable to audio; no copyright exposure.)
- Local cache (IndexedDB) so a returning user's library is instant even offline.

**F4 — Set sequencing engine**

- Input: analyzed tracks + target set parameters (duration, energy arc **preset**: warm-up / peak-time / journey / flat). Free-drawn custom curves are a post-MVP fast-follow.
- Optional anchors: the DJ can designate a **start track** and/or **end track**; the optimizer treats them as fixed endpoints and sequences the rest between them.
- Pairwise transition scoring between track A's **outro section** and track B's **intro section**:
  - harmonic compatibility (Camelot distance)
  - BPM compatibility (incl. halftime/doubletime relations)
  - energy continuity vs. the target arc
  - vocal clash penalty (vocal outro → vocal intro)
  - percussive/melodic handoff match
  - bass-weight conflict penalty
  - brightness/density continuity
- Global optimization: order all (or a selected subset of) tracks to maximize total transition quality **and** fit to the target energy curve (TSP-style; heuristic search — e.g., beam search or simulated annealing — not exhaustive). **Runs client-side** (Web Worker) on feature JSON — keeps the offline story clean and server compute at zero; can move server-side later if heavier algorithms are wanted.
- **Anti-monotony (guard against convergence to a single BPM/key/texture).** Naive smoothness-maximization rewards sameness; the objective must treat _smoothness as a constraint, interest as the goal_:
  - arc templates include a **tempo arc** alongside the energy arc — BPM progression in the arc's direction is rewarded, not penalized;
  - **key-movement scoring**, not just key compatibility: monotony penalty for staying in the same key too many consecutive transitions; reward for +1/+2 Camelot "energy boost" moves at appropriate arc moments;
  - **diversity penalty** for windows of consecutive tracks with near-identical texture profiles (brightness, density, vocal character), even when each pairwise transition scores well.
- Output: ordered set + per-transition score breakdown + suggested mix point (time range in outgoing/incoming track) + flags ("key clash — consider skipping", "energy dip here").

**F5 — Set editor UI**

- Visual timeline: tracks as blocks showing their energy curve, section colors, vocal regions, and key/BPM.
- Overall set energy arc overlaid on the target arc.
- Drag-to-reorder with live re-scoring of affected transitions; lock tracks in place; mark "must open"/"must close"/"must include".
- Misfit indicators on flagged tracks (F8) with their reason on hover, plus the bench/reserve list alongside the timeline.
- Transition inspector: click any junction to see the score breakdown and the recommended mix window.
- Local audio preview: play the outro→intro junction from the local files (files are still on device — use them).

**F6 — Export**

- M3U8 playlist (universal).
- Rekordbox XML (ordered playlist; include analyzed BPM/key as info).
- Printable/exportable set sheet (PDF or markdown): order, keys, BPMs, mix points, warnings.

**F7 — Accounts & persistence**

- Real accounts from day one: email + OAuth (Google) login.
- Saved sets and saved analysis (feature JSON only) persisted server-side per user — cross-device access to sets and library features. A set is small — persist freely.
- IndexedDB remains as the local/offline cache layer; server is the source of truth once signed in.
- Requires a privacy policy (easy to state honestly: we never receive audio, only derived features and set orderings).

**F8 — Track fit, misfit flags & bench**

- **Fit score per track**, relative to the current playlist — not to a genre taxonomy. Computed two ways:
  - pre-optimization: statistical distance from the playlist's feature centroid (BPM vs. set median, vocal density, percussiveness, bass weight, brightness, energy);
  - post-optimization: best-achievable inbound/outbound transition scores for the track's placement.
- **Misfit flag** when a track falls outside the playlist's distribution, with a plain-language, feature-based reason (e.g., "88 BPM vs. set median 124; vocal-heavy vs. mostly instrumental set"). No genre labels — detection is honest feature distance; the DJ supplies the genre interpretation.
- Outliers are **never dropped silently** — they may be intentional (genre pivots, halftime switches). The DJ chooses per flagged track:
  - **Keep** — optimizer does its best; suggest half/double-time mixing as a bridge where the BPM relation allows;
  - **Bench** — move to a visible reserve list, excluded from sequencing but one click from re-inclusion;
  - **Swap** — see library swap suggestions below.
- **Swap suggestions from the user's library** _(MVP-stretch / fast-follow)_: because analysis is persisted per account (F7), every previously analyzed track is queryable. Suggest "you have N tracks in your library that fit this slot better" via feature-JSON queries — no re-analysis needed. Requires a "library" browsing surface (new UI).
- Swap candidates are ranked by **fit to the slot** (arc position + the two neighboring tracks), never by proximity to the playlist centroid — centroid-ranking would homogenize the DJ's music over time.

### Out of scope (MVP) — deferred, not rejected

- Beatport / streaming-service playlist linking (Phase 2 — requires partner API access; metadata + preview-clip analysis tier).
- Beatport-sourced swap suggestions ("tracks on Beatport that fit this gap") — Phase 2, flagged as a natural monetization candidate (affiliate/partnership).
- Server-side stem separation (Demucs) on intro/outro excerpts as a premium deep-analysis tier (Phase 3).
- Automatic rendered mixes (audio output with crossfades/EQ). This tool plans sets; it does not perform them.
- Mobile-first experience; live/real-time performance features; social/sharing features.

## 6. Non-functional requirements

- **Privacy:** raw audio never transmitted; state this prominently. Feature JSON contains no reconstructable audio.
- **Performance:** analysis ≤ ~3 s/track; sequencing of 100 tracks ≤ 10 s; UI responsive during analysis (workers only, never main thread).
- **Browser support:** Chrome/Edge full experience; Firefox/Safari functional via file-input fallback (no directory picking).
- **Offline-tolerant:** analysis and sequencing work without a server connection (server adds cache + persistence, not core function).
- **Accuracy targets:** BPM within ±0.1 on 4/4 electronic material ≥ 95%; key agreement with Mixed In Key–style references ≥ 85%; vocal presence detection ≥ 90% segment accuracy. Show confidence, allow manual override of BPM/key per track.

## 7. Success metrics

- A DJ can go from file selection to an exported, sequenced 20-track set in under 10 minutes cold (under 2 minutes with warm cache).
- ≥ 70% of generated orderings require moving fewer than 5 tracks before the user exports (proxy: count of manual reorders before export).
- Repeat usage: users returning with new playlists within 30 days.

## 8. Risks & mitigations

| Risk                                                     | Mitigation                                                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Structure segmentation is wrong on unconventional tracks | Show section boundaries visually; allow manual adjustment; degrade gracefully to whole-track features |
| Analysis too slow on low-end machines                    | Feature cache (community + local), analyze-on-add incrementally, coarse-then-refine passes            |
| Key/BPM detection errors poison sequencing               | Confidence scores, per-track manual override, respect user-corrected values in cache                  |
| Browsers without File System Access API                  | File-input fallback covers all; document Chrome/Edge as recommended                                   |
| WASM/model download size bloats first load               | Lazy-load analysis bundle after UI; keep classifier models to few-MB variants                         |

## 9. Phasing

- **Phase 1 (MVP):** F1–F8, including full accounts. Free — no payments or paywalls; monetization decided later once Phase 2/3 features exist as natural premium candidates. Within F8, fit scores/misfit flags/bench are core MVP; library swap suggestions are the stretch item (first fast-follow if cut).
- **Phase 2:** Beatport playlist linking (metadata + preview analysis tier), Beatport-sourced swap suggestions (monetization candidate), shared/community feature cache hardening.
- **Phase 3:** Server-side stem-based deep analysis (premium), rendered mix preview at junctions, additional exports (Serato, Engine DJ).

## 10. Technical stack (decided)

- **Frontend:** React + TypeScript + Vite SPA. Zustand (app state), TanStack Query (server sync), Tailwind CSS. Timeline/waveform visualizations in Canvas 2D (WebGL only if performance demands later).
- **Analysis layer:** Web Audio API `OfflineAudioContext` for decoding; **Essentia.js** (WASM) for DSP (beat tracking, key, spectral features, HPSS) and its TensorFlow.js voice/instrumental model for vocal detection; Web Workers via Comlink for the per-track pipeline and the sequencing optimizer (plain TypeScript). Note: multithreaded WASM requires SharedArrayBuffer → COOP/COEP headers; configure from day one.
- **Backend:** **Supabase** — email + Google OAuth auth, Postgres (feature cache + saved sets; feature JSON in `jsonb` powers F8 swap queries), row-level security.
- **Hosting:** Cloudflare Pages or Vercel for the frontend (COOP/COEP header support), Supabase hosted backend.
- **Testing:** Vitest + Playwright, plus a reference-track suite (known BPM/key ground truth) as an analysis-accuracy regression harness.

## 11. Resolved decisions

- **Sequencing runs client-side** (Web Worker on feature JSON). Server-side "deep optimize" is a possible later addition, not MVP.
- **Energy arc UX: presets only in MVP** (warm-up / peak-time / journey / flat). Free-drawn curve is a fast-follow.
- **Accounts from day one** — email + Google OAuth, sets and features persisted server-side per user.
- **MVP is free.** Monetization decided post-launch; Beatport tier and stem-based deep analysis (Phases 2–3) are the natural premium candidates.
