import { hashPassword, issueToken, sessionCookie, json, isEmail } from '../../../worker/auth.js'

export async function onRequestPost({ env, request }) {
  if (!env.DB) return json({ error: 'Database is not configured' }, 501)
  if (!env.SESSION_SECRET) return json({ error: 'SESSION_SECRET is not set' }, 501)

  const body = await request.json().catch(() => ({}))
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const name = String(body.name || '').trim() || email.split('@')[0]

  if (!isEmail(email)) return json({ error: 'Enter a valid email address' }, 400)
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)

  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(password)

  try {
    await env.DB.prepare('insert into users (id, email, password_hash, name, created_at) values (?, ?, ?, ?, datetime("now"))')
      .bind(id, email, passwordHash, name)
      .run()
  } catch (err) {
    const message = String(err && err.message ? err.message : err)
    if (message.includes('UNIQUE')) return json({ error: 'That email is already registered' }, 409)
    return json({ error: 'Could not create account. Please try again.' }, 500)
  }

  const user = { id, email, name }
  const token = await issueToken(user, env)
  return json({ authenticated: true, provider: 'password', user }, 201, { 'Set-Cookie': sessionCookie(token) })
}
