// Shared auth helpers for the Pages Functions (Workers runtime).
// Password hashing uses PBKDF2-HMAC-SHA256 via WebCrypto; sessions are
// stateless HMAC-signed tokens carried in an HttpOnly cookie.

const enc = new TextEncoder()
const dec = new TextDecoder()
const COOKIE = 'gsp_session'
const SESSION_SECONDS = 60 * 60 * 24 * 14 // 14 days
const PBKDF2_ITERATIONS = 100_000

// --- base64 helpers ---
function b64(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
function unb64(str) {
  const bin = atob(str)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}
function b64url(bytes) {
  return b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64url(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return unb64(s)
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

// --- password hashing ---
async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256)
  return new Uint8Array(bits)
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(hash)}`
}

export async function verifyPassword(password, stored) {
  const [scheme, iterStr, saltB64, hashB64] = String(stored).split('$')
  if (scheme !== 'pbkdf2') return false
  const hash = await pbkdf2(password, unb64(saltB64), Number(iterStr))
  return timingSafeEqual(b64(hash), hashB64)
}

// --- signed session tokens ---
async function hmac(data, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return b64url(new Uint8Array(sig))
}

export async function signToken(payload, secret) {
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const sig = await hmac(body, secret)
  return `${body}.${sig}`
}

export async function verifyToken(token, secret) {
  if (!token || !secret) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = await hmac(body, secret)
  if (!timingSafeEqual(sig, expected)) return null
  try {
    const payload = JSON.parse(dec.decode(fromB64url(body)))
    if (payload.exp && Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

// --- cookies ---
export function sessionCookie(token) {
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`
}
export function clearCookie() {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}
function readCookie(request, name) {
  const header = request.headers.get('Cookie') || ''
  const found = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`))
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null
}

// Resolve the signed-in user (or null) from the request cookie.
export async function getSessionUser(request, env) {
  if (!env.SESSION_SECRET) return null
  const payload = await verifyToken(readCookie(request, COOKIE), env.SESSION_SECRET)
  return payload ? { id: payload.uid, email: payload.email, name: payload.name } : null
}

export async function issueToken(user, env) {
  return signToken(
    { uid: user.id, email: user.email, name: user.name, exp: Date.now() + SESSION_SECONDS * 1000 },
    env.SESSION_SECRET,
  )
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

export function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
