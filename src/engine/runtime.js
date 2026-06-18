// Executes a GlideScript snippet against the mock Glide APIs and collects output.

import { Database } from './database.js'
import {
  makeGlideRecord,
  makeGlideAggregate,
  makeGlideSystem,
  GlideDateTime,
  GlideDate,
  GlideDuration,
  GlideElement,
} from './glide.js'

// A persistent database so inserts/deletes from one run carry into the next,
// just like a real instance. Call resetDatabase() to reseed.
let db = new Database()

export function getDatabase() {
  return db
}
export function resetDatabase() {
  db = new Database()
  return db
}

export function runScript(code) {
  const output = []
  const started = performance.now()
  const emit = (entry) => output.push({ ...entry, t: performance.now() - started })

  const gs = makeGlideSystem(db, emit)
  const GlideRecord = makeGlideRecord(db, gs)
  const GlideAggregate = makeGlideAggregate(db)

  // console.* routes into the same output stream so console.log works too.
  const sandboxConsole = {
    log: (...a) => emit({ level: 'log', text: a.map(stringify).join(' ') }),
    info: (...a) => emit({ level: 'log', text: a.map(stringify).join(' ') }),
    warn: (...a) => emit({ level: 'warn', text: a.map(stringify).join(' ') }),
    error: (...a) => emit({ level: 'error', text: a.map(stringify).join(' ') }),
    debug: (...a) => emit({ level: 'debug', text: a.map(stringify).join(' ') }),
  }

  const globals = {
    gs,
    GlideRecord,
    GlideAggregate,
    GlideDateTime,
    GlideDate,
    GlideDuration,
    GlideElement,
    console: sandboxConsole,
  }

  let error = null
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...Object.keys(globals), `'use strict';\n${code}`)
    const ret = fn(...Object.values(globals))
    if (ret !== undefined) emit({ level: 'return', text: stringify(ret) })
  } catch (e) {
    error = e
    emit({ level: 'error', text: `${e.name}: ${e.message}` })
  }

  return {
    output,
    error,
    durationMs: performance.now() - started,
  }
}

function stringify(v) {
  if (v == null) return String(v)
  if (typeof v === 'string') return v
  if (v instanceof GlideElement) return v.getValue()
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2)
    } catch {
      return String(v)
    }
  }
  return String(v)
}
