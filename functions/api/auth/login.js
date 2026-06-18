import { verifyPassword, issueToken, sessionCookie, json, isEmail } from '../../../worker/auth.js'

export async function onRequestPost({ env, request }) {
  if (!env.DB) return json({ error: 'Database is not configured' }, 501)
  if (!env.SESSION_SECRET) return json({ error: 'SESSION_SECRET is not set' }, 501)

  const body = await request.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')

  if (!isEmail(email) || !password) return json({ error: 'Enter your email and password' }, 400)

  const row = await env.DB.prepare('select id, email, password_hash, name from users where email = ?').bind(email).first()
  // Always run a verify to keep timing uniform whether or not the user exists.
  const ok = row ? await verifyPassword(password, row.password_hash) : await verifyPassword(password, 'pbkdf2$1$AAAA$AAAA')
  if (!row || !ok) return json({ error: 'Incorrect email or password' }, 401)

  const user = { id: row.id, email: row.email, name: row.name }
  const token = await issueToken(user, env)
  return json({ authenticated: true, provider: 'password', user }, 200, { 'Set-Cookie': sessionCookie(token) })
}
