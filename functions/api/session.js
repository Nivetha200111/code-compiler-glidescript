import { getSessionUser, json } from '../../worker/auth.js'

export async function onRequestGet({ env, request }) {
  const user = await getSessionUser(request, env)
  return json({ authenticated: Boolean(user), provider: user ? 'password' : 'none', user: user || null })
}
