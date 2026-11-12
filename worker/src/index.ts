import { MAX_SHARE_BYTES, SHARE_ID_PATTERN, parseSharedSet } from '../../src/share/schema'

// mixbuilder share-links API (Cloudflare Worker + D1).
//
//   POST /sets      body: SharedSet JSON → 201 { id }
//   GET  /sets/:id  → 200 SharedSet JSON | 404
//
// Anonymous by design: no accounts, so creation is protected by validation, a
// body-size cap and a per-IP rate limit. Shared sets are immutable snapshots that
// never expire. CORS is open — the data is public to anyone holding a link.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...headers },
  })
}

/** 10 base62 chars ≈ 59 bits: unguessable, short enough for a link. */
function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  // 248 is the largest multiple of 62 below 256; re-roll above it to avoid bias.
  let id = ''
  for (const b of bytes) id += b < 248 ? ID_ALPHABET[b % 62] : ''
  return id.length === 10 ? id : newId()
}

async function createSet(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const { success } = await env.SHARE_LIMITER.limit({ key: ip })
  if (!success) return json({ error: 'Too many shares — try again in a minute.' }, 429)

  const declared = Number(request.headers.get('Content-Length') ?? 0)
  if (declared > MAX_SHARE_BYTES) return json({ error: 'Set is too large to share.' }, 413)
  const body = await request.text()
  if (new TextEncoder().encode(body).length > MAX_SHARE_BYTES) {
    return json({ error: 'Set is too large to share.' }, 413)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return json({ error: 'Invalid JSON.' }, 400)
  }
  const set = parseSharedSet(parsed)
  if (!set) return json({ error: 'Invalid set.' }, 400)

  const payload = JSON.stringify(set)
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = newId()
    const { meta } = await env.DB.prepare(
      'INSERT INTO shared_sets (id, payload) VALUES (?, ?) ON CONFLICT(id) DO NOTHING',
    )
      .bind(id, payload)
      .run()
    if (meta.changes === 1) return json({ id }, 201)
  }
  return json({ error: 'Could not create a link — try again.' }, 500)
}

async function getSet(id: string, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!SHARE_ID_PATTERN.test(id)) return json({ error: 'Not found.' }, 404)
  const row = await env.DB.prepare('SELECT payload FROM shared_sets WHERE id = ?')
    .bind(id)
    .first<{ payload: string }>()
  if (!row) return json({ error: 'Not found.' }, 404)
  ctx.waitUntil(
    env.DB.prepare('UPDATE shared_sets SET views = views + 1 WHERE id = ?').bind(id).run(),
  )
  return new Response(row.payload, {
    headers: {
      'Content-Type': 'application/json',
      // Snapshots never change, so browsers can keep them.
      'Cache-Control': 'public, max-age=3600',
      ...CORS,
    },
  })
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

    if (pathname === '/sets' && request.method === 'POST') return createSet(request, env)
    const match = /^\/sets\/([^/]+)$/.exec(pathname)
    if (match && request.method === 'GET') return getSet(match[1]!, env, ctx)

    return json({ error: 'Not found.' }, 404)
  },
} satisfies ExportedHandler<Env>
