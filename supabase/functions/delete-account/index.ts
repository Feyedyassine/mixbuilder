// Supabase Edge Function (Deno) — deletes the caller's own account.
//
// The client can't delete an auth user with the anon key, so this runs with the
// service role (auto-injected as SUPABASE_SERVICE_ROLE_KEY). It verifies the
// caller's JWT itself, then deletes that user; profiles/sets/user_tracks are
// removed by their ON DELETE CASCADE foreign keys. The anonymous shared cache
// (track_features / track_metadata) has no user_id and is intentionally kept.
//
// Deploy:  supabase functions deploy delete-account --no-verify-jwt
// (JWT is verified in-function so the CORS preflight isn't blocked at the gateway.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(401, { error: 'Missing Authorization header' })
  const jwt = authHeader.replace(/^Bearer\s+/i, '')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json(500, { error: 'Server not configured' })

  const admin = createClient(supabaseUrl, serviceKey)

  // Identify the caller from their own JWT.
  const { data, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !data.user) return json(401, { error: 'Invalid or expired session' })

  // Delete the auth user; user-scoped rows cascade away via FK constraints.
  const { error: delErr } = await admin.auth.admin.deleteUser(data.user.id)
  if (delErr) return json(500, { error: delErr.message })

  return json(200, { success: true })
})
