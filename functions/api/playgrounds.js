import { getSessionUser, json } from '../../worker/auth.js'

export async function onRequestGet({ env, request }) {
  if (!env.DB) return json({ error: 'Database is not configured' }, 501)

  const user = await getSessionUser(request, env)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const { results } = await env.DB.prepare(
    'select id, name, data, created_at, updated_at from playground_snapshots where user_email = ? order by updated_at desc limit 50',
  )
    .bind(user.email)
    .all()

  return json({
    snapshots: results.map((row) => ({
      ...row,
      data: safeParseData(row.data),
    })),
  })
}

export async function onRequestPost({ env, request }) {
  if (!env.DB) return json({ error: 'Database is not configured' }, 501)

  const user = await getSessionUser(request, env)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const body = await request.json().catch(() => ({}))
  const name = String(body.name || 'Untitled playground').trim().slice(0, 120) || 'Untitled playground'
  const data = JSON.stringify(body.data || {})

  // Upsert by (user, name) so re-saving the same name updates instead of
  // creating duplicates. If older duplicates already exist, keep the newest
  // row and remove the rest during the save.
  const existingRows = await env.DB.prepare(
    'select id from playground_snapshots where user_email = ? and name = ? order by updated_at desc',
  )
    .bind(user.email, name)
    .all()
  const existing = existingRows.results?.[0]

  if (existing) {
    const batch = [
      env.DB.prepare('update playground_snapshots set data = ?, updated_at = datetime("now") where id = ?').bind(data, existing.id),
    ]
    for (const duplicate of existingRows.results.slice(1)) {
      batch.push(env.DB.prepare('delete from playground_snapshots where id = ? and user_email = ?').bind(duplicate.id, user.email))
    }
    await env.DB.batch(batch)
    return json({ id: existing.id, name, updated: true })
  }

  const id = crypto.randomUUID()
  await env.DB.prepare(
    'insert into playground_snapshots (id, user_email, name, data, created_at, updated_at) values (?, ?, ?, ?, datetime("now"), datetime("now"))',
  )
    .bind(id, user.email, name, data)
    .run()

  return json({ id, name, updated: false }, 201)
}

export async function onRequestDelete({ env, request }) {
  if (!env.DB) return json({ error: 'Database is not configured' }, 501)

  const user = await getSessionUser(request, env)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return json({ error: 'Missing id' }, 400)

  await env.DB.prepare('delete from playground_snapshots where id = ? and user_email = ?').bind(id, user.email).run()
  return json({ ok: true })
}

function safeParseData(value) {
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}
