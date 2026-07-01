# djmix — AI DJ Set Builder

Web app that turns a DJ's playlist into a professionally sequenced set. All audio analysis
runs **in the browser** (Web Workers + WASM) — raw audio never leaves the device; only
derived feature JSON is ever sent to the server.

See [PRD.md](./PRD.md) for the product spec and [plan.md](./plan.md) for the development plan.

## Stack

React + TypeScript + Vite SPA · Tailwind CSS · Essentia.js (WASM) in Web Workers ·
Supabase (auth, Postgres) · Vitest + Playwright

## Development

```bash
npm install
npm run dev        # dev server (with COOP/COEP headers, see below)
npm run test       # unit tests (Vitest)
npm run lint       # ESLint
npm run build      # type-check + production build
npm run preview    # serve the production build locally
```

## Why COOP/COEP headers?

The dev and preview servers (and production hosting) send:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These make the page **cross-origin isolated**, which is required for `SharedArrayBuffer` —
which in turn is required for multithreaded WASM. The audio analysis pipeline
(Essentia.js) runs in Web Workers and benefits from threading; without these headers,
`crossOriginIsolated` is `false` and threaded WASM silently degrades or fails.

Consequence to keep in mind: with COEP `require-corp`, every cross-origin resource the
page loads (scripts, images, fonts) must send `Cross-Origin-Resource-Policy` or CORS
headers. Prefer self-hosting assets. Production hosting (Cloudflare Pages / Vercel) must
be configured to send the same two headers.

## Source layout

```
src/
  analysis/    in-browser audio analysis pipeline (workers, WASM)
  sequencing/  transition scoring + set optimizer (pure TS)
  ingestion/   file pickers, metadata tags, content hashing
  ui/          React components
  state/       app state (Zustand)
  storage/     IndexedDB + Supabase persistence
  export/      M3U8 / Rekordbox XML / set sheet writers
```
