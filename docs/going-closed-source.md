# Going closed-source (Path B): replacing Essentia.js

**Status:** not active. mixbuilder currently ships under **AGPL-3.0** (Path A) —
the repo is public and the app links to its source. This doc is the plan for *if*
we later need a proprietary/closed license.

## Why this exists

mixbuilder is AGPL only because it depends on **Essentia.js**, which is AGPL-3.0.
AGPL's copyleft reaches any code combined with it and — because the WASM is shipped
to the browser — that includes our analysis **client**. To keep the client code
proprietary, Essentia.js has to go.

### When to revisit (the triggers)

Do this only when one of these is actually true — not preemptively:

1. **The paid differentiator becomes the *analysis itself*** — e.g. proprietary
   detection, stem separation, vocal AI, smarter auto-cues computed client-side.
   Then the engine *is* the product and wants to be closed.
2. **Fundraising or acquisition** where AGPL-in-the-stack is a diligence problem.
3. A concrete need to stop competitors forking the analysis client.

### What does NOT require this

Monetizing library sync, cue storage, and prep features does **not** require going
closed. Those are **server-side** data/services; AGPL only forces the analysis
*client* open, not a separate backend it talks to over an API, and it never forces
the hosted service to be free. Open-core + paid cloud works fine under AGPL. Keep
premium logic **server-side** so copyleft doesn't reach it.

### No lock-in

Choosing AGPL now costs us nothing later. We own our code and can relicense it;
only Essentia.js is sticky. Replacing it is the **same amount of work whenever** we
do it — so we defer until a trigger fires and we have revenue + validation data.

## Blast radius: what Essentia actually does for us

Only three things depend on Essentia. Everything else (energy curve, sections,
spikes, sequencing, export) is already our own code and is untouched.

| Use | Where | Essentia calls |
| --- | --- | --- |
| BPM + beat grid | `src/analysis/essentia-analyzer.ts` | `RhythmExtractor2013` |
| Key / scale / Camelot | `src/analysis/essentia-analyzer.ts` | `KeyExtractor` (profile `bgate`) |
| FFT + spectral descriptors | `src/analysis/spectral.ts` | `Windowing`, `Spectrum`, `Centroid`, `Flatness`, `EnergyBandRatio` |

All three sit on top of one primitive: an **FFT**.

## Replacement plan, per component

### 0. The FFT foundation (pick first)

- **`fft.js`** — MIT, fast pure-JS radix-2 FFT. Simplest; some slowdown vs WASM.
- **`pffft` / `kissfft`** — BSD C libraries compiled to **WASM**. Recovers
  near-native speed. More build setup. **Recommended if performance parity matters.**
- Avoid Web Audio `AnalyserNode` for this — it's real-time-oriented, not offline batch.

### 1. Spectral descriptors (`spectral.ts`) — easy

Reimplement directly over FFT magnitudes; these are textbook one-liners:
- **Spectral centroid** (brightness) = Σ(f·mag) / Σ(mag), normalized by Nyquist.
- **Spectral flatness** = geometric mean / arithmetic mean of the magnitude spectrum.
- **Band-energy ratio** (bass weight) = Σ energy in [20–250 Hz] / total energy.
- Hann window before the FFT, same as today.
Output is essentially identical to Essentia's.

### 2. Key detection — moderate

Standard method (this is what `KeyExtractor` does internally, so no accuracy loss
expected vs today — key detection is already the least-reliable feature):
- Build a **chroma / HPCP** (12-bin pitch-class profile) from the FFT frames.
- **Correlate** the averaged chroma against **key-profile templates** for all 24
  keys; pick the best. Krumhansl–Schmuckler / Temperley profiles are published
  academic number arrays (not copyrighted code) — safe to embed. Keep the option
  to try `bgate`/`edma`-style profiles like the current experiment.
- Map winning key → Camelot via existing `src/analysis/camelot.ts`.
- Shortcut: **Meyda** (MIT) can produce the chroma if we don't want to hand-roll it.

### 3. BPM + beat grid — hardest, the real risk

- **Libraries:** `web-audio-beat-detector` (MIT) or `realtime-bpm-analyzer` (MIT).
  Decent for steady 4/4 electronic tracks. **Do not use `aubio` — it's GPL** (same
  trap).
- **Custom:** onset envelope (spectral flux from our FFT) → autocorrelation / tempo
  histogram for BPM → phase estimation for the beat grid.
- ⚠️ **Accuracy risk:** `RhythmExtractor2013` is a genuinely strong beat tracker.
  Simpler methods make more half/double-time and weak-kick/non-4/4 errors, and the
  beat *phase* (used for mix-point + section snapping) is the fiddliest to match.
  The manual BPM override softens the impact but this is where a regression is most
  likely.

## Performance

Parity is achievable, with caveats:

- Energy / sections / spikes / sequencing: **unchanged** (already pure TS).
- **Key lever:** Essentia effectively runs the transform three times (spectral,
  key, beat internals). A from-scratch pipeline does **one FFT pass** and derives
  spectral descriptors + chroma + spectral-flux onset from the *same* frames —
  potentially leaner than three Essentia calls.
- **Cost:** pure-JS FFT is somewhat slower per track than Essentia's C++→WASM. A
  **permissive WASM FFT** (pffft/kissfft) closes the gap.
- Analysis already runs in **Web Workers with bounded concurrency**, so batch
  throughput (a whole folder) stays fine even if a single track is marginally slower.

**Verdict:** WASM FFT + shared single pass → roughly on par. Naive pure-JS FFT and
no sharing → noticeably slower on the key/spectral step.

## Validation (do not skip)

This is a DSP-core rewrite; treat correctness as the gate. Use the **accuracy
harness** (deferred task 2.4):
- Assemble reference tracks with known BPM/key (Beatport, Rekordbox, or hand-labeled).
- Compare new detectors vs the **current Essentia output** and vs ground truth.
- Gate the swap on hitting an agreed accuracy bar (esp. BPM), not vibes.

## Migration checklist

1. Pick the FFT (recommend a permissive WASM FFT for parity).
2. Reimplement `spectral.ts` descriptors on the new FFT; verify against Essentia.
3. Implement chroma + key-profile correlation; wire to `camelot.ts`.
4. Implement / integrate BPM + beat-grid; validate hardest here.
5. Delete Essentia usage: `essentia-analyzer.ts`, `spectral.ts` imports,
   `essentia.d.ts`, the `essentia.js` dependency, and the WASM asset handling.
6. Bump `FEATURE_SCHEMA_VERSION` (invalidates the cache; everything re-analyzes).
7. Run the accuracy harness; confirm the bar.
8. Relicense: replace `LICENSE` (AGPL) with the proprietary/chosen license, drop the
   AGPL notices, remove the footer **Source** link and README AGPL section.
9. Consider whether the repo goes private.

## Rough effort

The largest single item on the roadmap. Spectral + key are mostly mechanical (days);
BPM + beat-grid + validation is the bulk and the risk (the majority of the effort).
Budget for real tuning against reference tracks.
