// netlify/functions/_hubAuth.js
//
// Verifies an access token minted by the Quins Club Hub's Supabase Auth, so
// the tournament site can trust "who this is" without holding a password
// or a secret of its own. Spec: claude/specs/spec-club-hub-sign-in-sep-2026.md
//
// HOW IT WORKS, IN PLAIN TERMS. The club hub signs every session token with a
// private key that never leaves Supabase. Supabase publishes the matching
// PUBLIC key at a well-known address. Anyone holding the public key can check
// that a token was really signed by the club hub and has not been altered,
// but cannot forge one. That is what makes this safe to do from a public
// repo with no environment variable: there is nothing here to leak.
//
// Measured 8 Sep 2026: the club hub's JWKS answers one EC P-256 key,
// alg ES256, use sig, with a kid. If Supabase ever rotates to a new key the
// kid changes; the cache below refetches ONCE on an unknown kid, which is how
// rotation is meant to be handled.
//
// ⚠️ THE ISSUER IS A CONSTANT, NOT AN ENVIRONMENT VARIABLE. There is exactly
// one club and its project ref is public (it is in every URL the club hub's
// own front end calls). Making it configurable would be a second place for it
// to be wrong. ⚠️ THE OTHER PROJECT REF, nnlfjbnoiyqcvxwbwsjf (adhjrt-app),
// was an empty trial and was deleted on 8 Sep 2026 — see the spec's tombstone.
//
// ⚠️ NO DEPENDENCY. Node's built-in crypto reads a JWK and verifies ES256
// natively; a JWT signature is the raw r||s pair, which is what
// dsaEncoding: 'ieee-p1363' means. The site has no package.json
// dependencies and this file must not be the first.

const crypto = require('crypto');

const HUB_PROJECT_REF = 'lusmshimxdcxpnrktlgz';
const HUB_ISSUER = `https://${HUB_PROJECT_REF}.supabase.co/auth/v1`;
const HUB_JWKS_URL = `${HUB_ISSUER}/.well-known/jwks.json`;
const HUB_AUDIENCE = 'authenticated';

/* Module-scope cache: one fetch per warm function instance, keyed by kid.
   Reset by _resetCacheForTests() only. */
let cache = { byKid: new Map(), fetchedAt: 0 };

function b64urlDecode(s) {
  return Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function fetchJwks(fetchImpl) {
  const res = await fetchImpl(HUB_JWKS_URL);
  if (!res || !res.ok) throw new Error(`JWKS fetch failed (${res && res.status})`);
  const body = await res.json();
  const byKid = new Map();
  for (const k of (body && Array.isArray(body.keys) ? body.keys : [])) {
    if (k && k.kid && k.kty === 'EC' && k.crv === 'P-256') byKid.set(k.kid, k);
  }
  cache = { byKid, fetchedAt: Date.now() };
  return cache;
}

/* Returns the JWK for a kid, refetching ONCE if it is not in the cache. A kid
   that is still unknown after a fresh fetch is simply not the club hub's key. */
async function keyFor(kid, fetchImpl) {
  if (cache.byKid.has(kid)) return cache.byKid.get(kid);
  await fetchJwks(fetchImpl);
  return cache.byKid.get(kid) || null;
}

/* verifyHubToken(token, opts) -> { ok: true, payload } | { ok: false, reason }
   Every refusal names its own reason so the caller can say the right sentence
   and a test can tell one refusal from another. Nothing here throws on bad
   input; a malformed token is a refusal, not a 500. */
async function verifyHubToken(token, opts = {}) {
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  try {
    if (typeof token !== 'string') return { ok: false, reason: 'malformed' };
    const parts = token.split('.');
    if (parts.length !== 3) return { ok: false, reason: 'malformed' };
    const [h, p, s] = parts;

    let header, payload;
    try {
      header = JSON.parse(b64urlDecode(h).toString('utf8'));
      payload = JSON.parse(b64urlDecode(p).toString('utf8'));
    } catch (e) {
      return { ok: false, reason: 'malformed' };
    }
    if (!header || header.alg !== 'ES256' || !header.kid) return { ok: false, reason: 'alg' };

    const jwk = await keyFor(header.kid, fetchImpl);
    if (!jwk) return { ok: false, reason: 'unknown-key' };

    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const verified = crypto.verify(
      'sha256',
      Buffer.from(`${h}.${p}`),
      { key, dsaEncoding: 'ieee-p1363' },
      b64urlDecode(s)
    );
    if (!verified) return { ok: false, reason: 'signature' };

    if (payload.iss !== HUB_ISSUER) return { ok: false, reason: 'issuer' };
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(HUB_AUDIENCE)) return { ok: false, reason: 'audience' };
    if (!Number.isFinite(payload.exp) || payload.exp * 1000 <= now) return { ok: false, reason: 'expired' };

    /* An anonymous Supabase session has no person behind it, and a token whose
       role is not 'authenticated' (e.g. service_role) is not a sign-in. The
       club hub confirms email addresses before it issues a session at all, so
       a session token IS the confirmation; the explicit false is the one shape
       that says otherwise. */
    if (payload.is_anonymous === true) return { ok: false, reason: 'anonymous' };
    if (payload.role !== HUB_AUDIENCE) return { ok: false, reason: 'role' };
    const email = String(payload.email || '').trim().toLowerCase();
    if (!email.includes('@')) return { ok: false, reason: 'no-email' };
    const meta = payload.user_metadata || {};
    if (meta.email_verified === false) return { ok: false, reason: 'unconfirmed' };
    if (!payload.sub) return { ok: false, reason: 'no-sub' };

    const name = String(meta.full_name || meta.name || meta.display_name || '').trim();
    return { ok: true, payload: { sub: String(payload.sub), email, name } };
  } catch (err) {
    console.error('hub token verify error:', err && err.message);
    return { ok: false, reason: 'error' };
  }
}

function _resetCacheForTests() { cache = { byKid: new Map(), fetchedAt: 0 }; }

module.exports = { verifyHubToken, HUB_ISSUER, HUB_JWKS_URL, HUB_AUDIENCE, HUB_PROJECT_REF, _resetCacheForTests };
