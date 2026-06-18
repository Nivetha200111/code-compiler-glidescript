import { clearCookie, json } from '../../../worker/auth.js'

export async function onRequestPost() {
  return json({ authenticated: false, provider: 'none', user: null }, 200, { 'Set-Cookie': clearCookie() })
}
