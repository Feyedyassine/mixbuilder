import { parseSharedSet, type SharedSet } from './schema'

// Client for the share-links Worker (worker/). Called cross-origin with CORS,
// which is allowed under our COEP require-corp policy. Override the endpoint with
// VITE_SHARE_API_URL (e.g. http://localhost:8799 with `npm run worker:dev`).

const API_URL = import.meta.env.VITE_SHARE_API_URL ?? 'https://mixbuilder-api.caragency.workers.dev'

export function shareUrl(id: string): string {
  return `${window.location.origin}/s/${id}`
}

/** Upload a set snapshot; resolves to its share id. */
export async function createShare(set: SharedSet): Promise<string> {
  const res = await fetch(`${API_URL}/sets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(set),
  })
  const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
  if (!res.ok || !body.id) throw new Error(body.error ?? 'Could not create a link — try again.')
  return body.id
}

/** Fetch a shared set; null when it doesn't exist. Throws on network errors. */
export async function fetchShare(id: string): Promise<SharedSet | null> {
  const res = await fetch(`${API_URL}/sets/${encodeURIComponent(id)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Share API error ${res.status}`)
  return parseSharedSet(await res.json())
}
