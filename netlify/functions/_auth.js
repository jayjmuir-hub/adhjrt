// netlify/functions/_auth.js
//
// Shared helpers for the account system — not an HTTP endpoint itself,
// just required by the functions that are. Handles:
//   - the Netlify Blobs "accounts" store (one JSON list of every
//     organizer + manager account, across both roles)
//   - password hashing/verification (bcrypt)
//   - signing/verifying session tokens (HMAC-SHA256, stateless — no
//     session table needed; anyone holding a valid token is trusted
//     for whatever role/ageGroupId is embedded in it)
//
// Requires the SESSION_SECRET environment variable — any long random
// string. Set it once in Netlify (Site configuration -> Environment
// variables) before any signup/login function is used; changing it
// later invalidates every existing session (forces re-login), which is
// fine and sometimes useful (e.g. if you ever suspect it leaked).

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getStore } = require('@netlify/blobs');

// Netlify is supposed to auto-inject Blobs config (site ID + token) into
// every function's environment, but on some sites/deploys that auto-wiring
// doesn't kick in and getStore('name') throws MissingBlobsEnvironmentError.
// Falling back to explicit siteID/token (from env vars you set once in
// Netlify — see README note below) works around that unconditionally.
//
// ONE-TIME SETUP (only needed if you see MissingBlobsEnvironmentError in a
// function's log): in Netlify -> Project configuration -> General ->
// Project information, copy "Project ID". Then User settings (click your
// avatar) -> Applications -> Personal access tokens -> New access token,
// generate one. Add both as environment variables:
//   BLOBS_SITE_ID = (the Project ID)
//   BLOBS_TOKEN   = (the personal access token)
function blobStore(name) {
  if (process.env.BLOBS_SITE_ID && process.env.BLOBS_TOKEN) {
    return getStore({ name, siteID: process.env.BLOBS_SITE_ID, token: process.env.BLOBS_TOKEN });
  }
  return getStore(name);
}

function accountsStore() {
  return blobStore('accounts');
}

async function loadAccounts() {
  const store = accountsStore();
  const list = await store.get('list', { type: 'json' });
  return list || [];
}

async function saveAccounts(list) {
  const store = accountsStore();
  await store.setJSON('list', list);
}

function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function sign(payload) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret || !token) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
}

function getBearerToken(event) {
  const h = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const m = h.match(/^Bearer (.+)$/);
  return m ? m[1] : null;
}

// True if a decoded session token may edit/submit for the given age group.
// Organizers (full access to everything) and the special "admin" manager
// invite code (ageGroupId === '*') can act on any age group; an ordinary
// manager only on their own.
function hasAgeGroupAccess(session, ageGroupId) {
  if (!session) return false;
  if (session.role === 'organizer') return true;
  if (session.role === 'manager') return session.ageGroupId === '*' || session.ageGroupId === ageGroupId;
  return false;
}

module.exports = { loadAccounts, saveAccounts, hashPassword, verifyPassword, sign, verify, getBearerToken, hasAgeGroupAccess, blobStore };
