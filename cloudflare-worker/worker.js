/**
 * Attendance Leaderboard Proxy Worker
 * ===================================
 * Sits between the browser script and the GitHub Gist registry so that the
 * GitHub PAT never lives in client code. Enforces server-side rules that
 * the client cannot bypass (blocklist, sticky flag, rate limits, admin gate).
 *
 * ─── Endpoints ───────────────────────────────────────────────────────────
 *   GET  /registry          → returns current gist JSON (no auth, gist is public)
 *   PATCH /registry         → write full registry  (requires CLIENT_KEY)
 *   POST /admin/rollback    → admin-only player edit (requires ADMIN_KEY)
 *   POST /admin/blocklist   → add clientId to blocklist (requires ADMIN_KEY)
 *
 * ─── Required Secrets (set via `wrangler secret put NAME` or dashboard) ──
 *   GIST_PAT      — the GitHub fine-grained PAT with `gist:write` scope
 *   CLIENT_KEY    — shared key the browser script sends; rotate periodically
 *   ADMIN_KEY     — your personal admin key (never put in client script)
 *
 * ─── Required Vars (set in wrangler.toml [vars] or dashboard) ────────────
 *   GIST_ID       — e.g. b97357da4f32cfea822c9db36cd48088
 *   GIST_FILE     — e.g. attendance_widget_registry.json
 *
 * ─── Optional KV namespace ───────────────────────────────────────────────
 *   BLOCKLIST     — KV namespace storing { clientId: { reason, addedAt } }
 *                   If unbound, the hardcoded BLOCKLIST_FALLBACK is used.
 *
 * ─── Deploy ──────────────────────────────────────────────────────────────
 *   npm i -g wrangler
 *   wrangler login
 *   wrangler init   (or copy this file to src/index.js of an existing worker)
 *   wrangler secret put GIST_PAT
 *   wrangler secret put CLIENT_KEY
 *   wrangler secret put ADMIN_KEY
 *   wrangler kv:namespace create BLOCKLIST   (optional)
 *   wrangler deploy
 */

const BLOCKLIST_FALLBACK = new Set([
  'a74c2f27-8824-42e3-8c59-4427ea5c8ad1' // abbassii
]);

// Max XP gain allowed per minute since the previous registry record.
// Used to reject obviously-inflated PATCH payloads.
const MAX_XP_GAIN_PER_MINUTE = 50;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-client-key, x-admin-key',
  'Access-Control-Max-Age': '86400'
};

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...corsHeaders, ...(init.headers || {}) }
  });
}

async function loadBlocklist(env) {
  if (!env.BLOCKLIST) return BLOCKLIST_FALLBACK;
  const list = await env.BLOCKLIST.list();
  const set = new Set(BLOCKLIST_FALLBACK);
  for (const k of list.keys) set.add(k.name);
  return set;
}

async function fetchGist(env) {
  const r = await fetch(`https://api.github.com/gists/${env.GIST_ID}`, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${env.GIST_PAT}`,
      'User-Agent': 'attendance-leaderboard-worker'
    },
    cf: { cacheTtl: 0 }
  });
  if (!r.ok) throw new Error(`gist fetch ${r.status}`);
  const g = await r.json();
  const raw = g.files?.[env.GIST_FILE]?.content || '{"players":[]}';
  const start = raw.indexOf('{');
  const slice = start >= 0 ? raw.slice(start) : '{"players":[]}';
  try { return JSON.parse(slice); }
  catch { return { lastUpdated: new Date().toISOString(), players: [] }; }
}

async function writeGist(env, data) {
  const body = { files: { [env.GIST_FILE]: { content: JSON.stringify(data, null, 2) } } };
  const r = await fetch(`https://api.github.com/gists/${env.GIST_ID}`, {
    method: 'PATCH',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${env.GIST_PAT}`,
      'Content-Type': 'application/json',
      'User-Agent': 'attendance-leaderboard-worker'
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`gist patch ${r.status}`);
}

// ─── Validation ──────────────────────────────────────────────────────────
// Enforces server-side rules on an incoming registry payload by comparing it
// against the current authoritative state. Returns the sanitized object that
// should be written, or throws Error with a message for the client.
async function validateAndMerge(incoming, current, env) {
  if (!incoming || !Array.isArray(incoming.players)) {
    throw new Error('payload must have a players array');
  }

  const blocklist = await loadBlocklist(env);
  const currentById = new Map((current.players || []).map(p => [p.clientId, p]));
  const seenIds = new Set();
  const out = [];

  for (const p of incoming.players) {
    if (!p || typeof p.clientId !== 'string') continue;
    if (seenIds.has(p.clientId)) continue;   // dedupe
    seenIds.add(p.clientId);

    // Drop blocklisted players entirely
    if (blocklist.has(p.clientId)) continue;

    const prev = currentById.get(p.clientId);

    // Sticky flag: once flagged in the gist, the client can never remove it.
    // Only the admin endpoints can unflag.
    if (prev?.flagged) {
      p.flagged = true;
      p.flagReason = prev.flagReason ?? p.flagReason ?? null;
      p.flaggedAt = prev.flaggedAt ?? p.flaggedAt ?? null;
    }

    // XP rate-limit check vs. previous record
    if (prev && typeof p.totalXP === 'number' && typeof prev.totalXP === 'number') {
      const gain = p.totalXP - prev.totalXP;
      if (gain > 0) {
        const prevTime = Date.parse(prev.lastSync || prev.lastUpdated || 0) || 0;
        const elapsedMin = Math.max(1, (Date.now() - prevTime) / 60000);
        const maxAllowed = MAX_XP_GAIN_PER_MINUTE * elapsedMin;
        if (gain > maxAllowed) {
          // Auto-flag instead of rejecting outright so admins can review.
          p.flagged = true;
          p.flagReason = `xp_rate: +${gain} in ${elapsedMin.toFixed(1)}min (max ${Math.round(maxAllowed)})`;
          p.flaggedAt = new Date().toISOString();
        }
      }
      // Never let totalXP go down without an admin action.
      if (gain < 0 && !prev.flagged) {
        p.totalXP = prev.totalXP;
        p.level = prev.level ?? p.level;
        p.currentXP = prev.currentXP ?? p.currentXP;
      }
    }

    out.push(p);
  }

  // Preserve any flagged players that the client tried to drop entirely.
  // (Cheater can't un-flag themselves by simply omitting their record.)
  for (const [id, prev] of currentById) {
    if (prev.flagged && !seenIds.has(id) && !blocklist.has(id)) {
      out.push(prev);
    }
  }

  return {
    lastUpdated: new Date().toISOString(),
    players: out
  };
}

// ─── Router ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // GET /registry — public read
      if (request.method === 'GET' && path === '/registry') {
        const data = await fetchGist(env);
        const blocklist = await loadBlocklist(env);
        // Strip blocked players on read too, so even legacy gist state is hidden.
        data.players = (data.players || []).filter(p => !blocklist.has(p.clientId));
        return json(data);
      }

      // PATCH /registry — client write, validated
      if (request.method === 'PATCH' && path === '/registry') {
        if (request.headers.get('x-client-key') !== env.CLIENT_KEY) {
          return json({ error: 'bad client key' }, { status: 401 });
        }
        const incoming = await request.json();
        const current = await fetchGist(env);
        const merged = await validateAndMerge(incoming, current, env);
        await writeGist(env, merged);
        return json({ ok: true, players: merged.players.length });
      }

      // POST /admin/rollback — admin-only
      // Body: { clientId, overrides: { totalXP, level, ... } }
      if (request.method === 'POST' && path === '/admin/rollback') {
        if (request.headers.get('x-admin-key') !== env.ADMIN_KEY) {
          return json({ error: 'forbidden' }, { status: 403 });
        }
        const { clientId, overrides } = await request.json();
        if (!clientId || !overrides) return json({ error: 'bad body' }, { status: 400 });
        const current = await fetchGist(env);
        const idx = (current.players || []).findIndex(p => p.clientId === clientId);
        if (idx === -1) return json({ error: 'player not found' }, { status: 404 });
        current.players[idx] = { ...current.players[idx], ...overrides, lastAdminAction: new Date().toISOString() };
        current.lastUpdated = new Date().toISOString();
        await writeGist(env, current);
        return json({ ok: true, player: current.players[idx] });
      }

      // POST /admin/blocklist — add a clientId to the blocklist
      // Body: { clientId, reason }
      if (request.method === 'POST' && path === '/admin/blocklist') {
        if (request.headers.get('x-admin-key') !== env.ADMIN_KEY) {
          return json({ error: 'forbidden' }, { status: 403 });
        }
        const { clientId, reason } = await request.json();
        if (!clientId) return json({ error: 'bad body' }, { status: 400 });
        if (env.BLOCKLIST) {
          await env.BLOCKLIST.put(clientId, JSON.stringify({ reason: reason || '', addedAt: new Date().toISOString() }));
        }
        // Also strip them from the registry now
        const current = await fetchGist(env);
        current.players = (current.players || []).filter(p => p.clientId !== clientId);
        current.lastUpdated = new Date().toISOString();
        await writeGist(env, current);
        return json({ ok: true, kv: !!env.BLOCKLIST });
      }

      return json({ error: 'not found' }, { status: 404 });
    } catch (e) {
      return json({ error: e.message || String(e) }, { status: 500 });
    }
  }
};
