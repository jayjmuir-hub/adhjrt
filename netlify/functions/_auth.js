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

function accountsStore() {
  return getStore('accounts');
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

module.exports = { loadAccounts, saveAccounts, hashPassword, verifyPassword, sign, verify, getBearerToken };
