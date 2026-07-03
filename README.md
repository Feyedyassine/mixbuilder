# mixbuilder — AI DJ Set Builder

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

## Supabase setup

1. Copy `.env.example` to `.env.local` and fill `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` from your project's **Project Settings → API**.
2. Apply the schema: run `supabase/migrations/20260702000000_schema_v1.sql` against
   your project (Supabase **SQL Editor**, or `supabase link` + `supabase db push`).
3. Enable auth providers in **Authentication → Providers**: Email is on by default;
   for Google, add your Google Cloud OAuth client ID/secret and set the redirect URL.
4. (Optional) Verify row-level security with `supabase/tests/rls_checks.sql` after
   creating two test users.
5. Regenerate typed schema after any migration:
   `npx supabase gen types typescript --linked > src/lib/database.types.ts`.

The app runs without Supabase configured (the auth panel shows a setup hint), so
analysis and sequencing work offline; sign-in and cross-device sync need the above.

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
