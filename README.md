# mixbuilder — AI DJ Set Builder

Web app that turns a DJ's playlist into a professionally sequenced set. All audio analysis
runs **in the browser** (Web Workers + WASM) — raw audio never leaves the device. Analysis
results, saved sets and manual BPM/key corrections are stored in the browser's IndexedDB.
The only backend is a small Cloudflare Worker + D1 that stores sets users explicitly share.

## Stack

React + TypeScript + Vite SPA · Tailwind CSS · Essentia.js (WASM) in Web Workers ·
IndexedDB · Cloudflare Workers + D1 (share links) · Vitest + Playwright

## License

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0) — see
[LICENSE](./LICENSE). Running a modified version as a network service obliges you
to offer users the corresponding source (AGPL §13); the app links to this repo
from its footer to satisfy that.

The project is AGPL because it depends on
**[Essentia.js](https://github.com/MTG/essentia.js)** (AGPL-3.0) for tempo, key,
and spectral analysis.

## Development

```bash
npm install
npm run dev        # dev server (with COOP/COEP headers, see below)
npm run test       # unit tests (Vitest)
npm run lint       # ESLint
npm run build      # type-check + production build
npm run preview    # serve the production build locally
```

## Storage

Everything is stored locally in IndexedDB (`src/storage/idb-cache.ts`): `features`
(analysis by content hash), `sets` and `overrides`. The sets/overrides records are
sync-ready — client-generated UUIDs, `createdAt`/`updatedAt` timestamps, and
self-describing track refs — so a cloud library can be layered behind
`src/storage/sets-store.ts` later without migrating data.

## Share links (Cloudflare Worker + D1)

"Share" uploads a snapshot of a set (titles, artists, BPM, key, energy, content
hashes — never audio or file names) and returns a `mixbuilder.io/s/<id>` link that
anyone can open. Links never expire.

- `worker/` — the Worker (`POST /sets`, `GET /sets/:id`), D1 migrations and config.
  Creation is rate-limited per IP; payloads are validated by `src/share/schema.ts`,
  which the app shares with the Worker.
- `npm run worker:dev` runs it locally on port 8787 with a local D1 (apply
  migrations first: `npx wrangler d1 migrations apply mixbuilder --local -c worker/wrangler.jsonc`);
  point the app at it with `VITE_SHARE_API_URL=http://localhost:8787` in `.env.local`.
- `npm run worker:deploy` applies migrations to the remote D1 and deploys.
- Vercel rewrites `/s/:id` to the SPA (`vercel.json`).

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
  storage/     IndexedDB persistence (features, sets, overrides)
  export/      M3U8 / Rekordbox XML / set sheet writers
```
