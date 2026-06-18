// Mock implementations of the most-used ServiceNow Glide server-side APIs.
// These run entirely in the browser against the in-memory Database.

import { CHOICES, REFERENCES } from './database.js'

// ---------------------------------------------------------------------------
// GlideElement — what you get when you read gr.fieldName. Stringifies to the
// stored value, but also exposes getDisplayValue(), nil(), toString(), etc.
// ---------------------------------------------------------------------------
class GlideElement {
  constructor(value, displayValue) {
    this._value = value == null ? '' : String(value)
    this._display = displayValue == null ? this._value : String(displayValue)
  }
  toString() {
    return this._value
  }
  valueOf() {
    return this._value
  }
  getValue() {
    return this._value
  }
  getDisplayValue() {
    return this._display
  }
  nil() {
    return this._value === '' || this._value == null
  }
  changes() {
    return false
  }
  toJSON() {
    return this._value
  }
}

// Coerce a query value to a comparable. Numbers compare numerically when both
// sides look numeric.
function cmp(a, b) {
  const na = Number(a)
  const nb = Number(b)
  if (a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) {
    return na < nb ? -1 : na > nb ? 1 : 0
  }
  const sa = String(a)
  const sb = String(b)
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

function matchOperator(recVal, op, val) {
  const v = recVal == null ? '' : String(recVal)
  switch (op) {
    case '=':
      return cmp(v, val) === 0
    case '!=':
      return cmp(v, val) !== 0
    case '>':
      return cmp(v, val) > 0
    case '>=':
      return cmp(v, val) >= 0
    case '<':
      return cmp(v, val) < 0
    case '<=':
      return cmp(v, val) <= 0
    case 'LIKE':
      return v.toLowerCase().includes(String(val).toLowerCase())
    case 'STARTSWITH':
      return v.toLowerCase().startsWith(String(val).toLowerCase())
    case 'ENDSWITH':
      return v.toLowerCase().endsWith(String(val).toLowerCase())
    case 'IN':
      return String(val).split(',').map((s) => s.trim()).some((x) => cmp(v, x) === 0)
    case 'NOT IN':
      return !String(val).split(',').map((s) => s.trim()).some((x) => cmp(v, x) === 0)
    case 'ISEMPTY':
      return v === ''
    case 'ISNOTEMPTY':
      return v !== ''
    default:
      return cmp(v, val) === 0
  }
}

// Map encoded-query operator tokens to our operators (most common ones).
const ENCODED_OPS = [
  ['ISNOTEMPTY', (f) => ({ field: f, op: 'ISNOTEMPTY', value: '' })],
  ['ISEMPTY', (f) => ({ field: f, op: 'ISEMPTY', value: '' })],
]

function parseEncodedTerm(term) {
  // ISEMPTY / ISNOTEMPTY
  for (const [token, make] of ENCODED_OPS) {
    if (term.endsWith(token)) return make(term.slice(0, -token.length))
  }
  // ordered so multi-char operators win over single-char
  const ops = ['>=', '<=', '!=', 'LIKE', 'STARTSWITH', 'ENDSWITH', 'NOT IN', 'IN', '=', '>', '<']
  for (const op of ops) {
    const idx = term.indexOf(op)
    if (idx > 0) {
      return { field: term.slice(0, idx), op, value: term.slice(idx + op.length) }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// GlideRecord
// ---------------------------------------------------------------------------
export function makeGlideRecord(db, gs) {
  class GlideRecord {
    constructor(table) {
      this._table = table
      this._conditions = [] // AND groups; each group is an array of OR terms
      this._orderBy = []
      this._limit = null
      this._results = []
      this._cursor = -1
      this._current = null
      this._newRecord = null // pending insert via initialize()/newRecord()

      // Proxy so unknown property reads return a GlideElement for the current
      // record, mirroring `gr.short_description` in real GlideScript.
      return new Proxy(this, {
        get(target, prop, receiver) {
          if (typeof prop !== 'string' || prop in target || prop.startsWith('_')) {
            return Reflect.get(target, prop, receiver)
          }
          const rec = target._activeRecord()
          if (rec && Object.prototype.hasOwnProperty.call(rec, prop)) {
            return new GlideElement(rec[prop], target._displayFor(prop, rec[prop]))
          }
          return new GlideElement('')
        },
        set(target, prop, value, receiver) {
          if (typeof prop !== 'string' || prop in target || prop.startsWith('_')) {
            return Reflect.set(target, prop, value, receiver)
          }
          const rec = target._activeRecord()
          if (rec) rec[prop] = value == null ? '' : String(value)
          return true
        },
      })
    }

    _activeRecord() {
      return this._newRecord || this._current
    }

    _displayFor(field, value) {
      const choice = CHOICES[this._table] && CHOICES[this._table][field]
      if (choice && choice[value] != null) return choice[value]
      const ref = REFERENCES[this._table] && REFERENCES[this._table][field]
      if (ref && value) {
        const target = db.all(ref.table).find((r) => r.sys_id === String(value))
        if (target) return target[ref.display]
      }
      return value
    }

    // --- query building ---
    addQuery(field, opOrValue, maybeValue) {
      let op = '='
      let value = opOrValue
      if (maybeValue !== undefined) {
        op = opOrValue
        value = maybeValue
      }
      const term = { field, op, value: value == null ? '' : String(value) }
      this._conditions.push([term])
      return { addOrCondition: (f, o, v) => this._addOr(this._conditions.length - 1, f, o, v) }
    }
    _addOr(groupIndex, field, opOrValue, maybeValue) {
      let op = '='
      let value = opOrValue
      if (maybeValue !== undefined) {
        op = opOrValue
        value = maybeValue
      }
      this._conditions[groupIndex].push({ field, op, value: value == null ? '' : String(value) })
      return { addOrCondition: (f, o, v) => this._addOr(groupIndex, f, o, v) }
    }
    addEncodedQuery(encoded) {
      if (!encoded) return this
      // ^ = AND, ^OR = OR with previous term
      const terms = String(encoded).split('^')
      for (const raw of terms) {
        if (!raw) continue
        if (raw.startsWith('OR')) {
          const parsed = parseEncodedTerm(raw.slice(2))
          if (parsed && this._conditions.length) this._conditions[this._conditions.length - 1].push(parsed)
        } else {
          const parsed = parseEncodedTerm(raw)
          if (parsed) this._conditions.push([parsed])
        }
      }
      return this
    }
    addActiveQuery() {
      return this.addQuery('active', 'true')
    }
    addNotNullQuery(field) {
      return this.addQuery(field, 'ISNOTEMPTY', '')
    }
    addNullQuery(field) {
      return this.addQuery(field, 'ISEMPTY', '')
    }
    orderBy(field) {
      this._orderBy.push({ field, dir: 1 })
      return this
    }
    orderByDesc(field) {
      this._orderBy.push({ field, dir: -1 })
      return this
    }
    setLimit(n) {
      this._limit = Number(n)
      return this
    }

    _matches(rec) {
      // every AND group must have at least one OR term match
      return this._conditions.every((group) => group.some((t) => matchOperator(rec[t.field], t.op, t.value)))
    }

    // --- execution ---
    query() {
      let rows = db.all(this._table).filter((r) => this._matches(r))
      for (const o of [...this._orderBy].reverse()) {
        rows = rows.sort((a, b) => cmp(a[o.field], b[o.field]) * o.dir)
      }
      if (this._limit != null) rows = rows.slice(0, this._limit)
      this._results = rows
      this._cursor = -1
      this._current = null
      return this
    }
    next() {
      if (this._cursor + 1 < this._results.length) {
        this._cursor++
        this._current = this._results[this._cursor]
        return true
      }
      return false
    }
    hasNext() {
      return this._cursor + 1 < this._results.length
    }
    get(fieldOrSysId, value) {
      const field = value === undefined ? 'sys_id' : fieldOrSysId
      const val = value === undefined ? fieldOrSysId : value
      const rec = db.all(this._table).find((r) => String(r[field]) === String(val))
      if (rec) {
        this._current = rec
        this._results = [rec]
        this._cursor = 0
        return true
      }
      return false
    }
    getRowCount() {
      if (this._results.length === 0 && this._cursor === -1) this.query()
      return this._results.length
    }

    // --- field access helpers ---
    getValue(field) {
      const rec = this._activeRecord()
      if (!rec) return null
      const v = rec[field]
      return v === undefined ? null : String(v)
    }
    getDisplayValue(field) {
      const rec = this._activeRecord()
      if (!rec) return ''
      if (field === undefined) {
        // display value of the record: number or name if present
        const dv = rec.number || rec.name || rec.user_name || rec.sys_id
        return String(dv)
      }
      return String(this._displayFor(field, rec[field]))
    }
    getElement(field) {
      const rec = this._activeRecord()
      return new GlideElement(rec ? rec[field] : '', rec ? this._displayFor(field, rec[field]) : '')
    }
    setValue(field, value) {
      const rec = this._activeRecord()
      if (rec) rec[field] = value == null ? '' : String(value)
    }
    getTableName() {
      return this._table
    }
    getUniqueValue() {
      const rec = this._activeRecord()
      return rec ? rec.sys_id : null
    }
    isValidField(field) {
      const rows = db.all(this._table)
      return rows.length ? Object.prototype.hasOwnProperty.call(rows[0], field) : true
    }
    isValidRecord() {
      return !!this._activeRecord()
    }
    canRead() {
      return true
    }
    canWrite() {
      return true
    }

    // --- writes ---
    initialize() {
      this._newRecord = { sys_id: db.newGuid() }
      return this
    }
    newRecord() {
      return this.initialize()
    }
    insert() {
      if (!this._newRecord) this.initialize()
      const rec = this._newRecord
      // auto-number common tables
      if (!rec.number) {
        if (this._table === 'incident') rec.number = db.nextNumber('INC')
        else if (this._table === 'change_request') rec.number = db.nextNumber('CHG')
      }
      if (rec.active === undefined) rec.active = 'true'
      db.all(this._table).push(rec)
      this._current = rec
      this._newRecord = null
      gs._log('debug', `[insert] ${this._table}: ${rec.sys_id}`)
      return rec.sys_id
    }
    update() {
      const rec = this._activeRecord()
      if (this._newRecord) return this.insert()
      gs._log('debug', `[update] ${this._table}: ${rec ? rec.sys_id : '(none)'}`)
      return rec ? rec.sys_id : null
    }
    deleteRecord() {
      const rec = this._current
      if (!rec) return false
      const arr = db.all(this._table)
      const idx = arr.indexOf(rec)
      if (idx >= 0) {
        arr.splice(idx, 1)
        this._results.splice(this._cursor, 1)
        this._cursor--
        gs._log('debug', `[delete] ${this._table}: ${rec.sys_id}`)
        return true
      }
      return false
    }
    deleteMultiple() {
      this.query()
      const arr = db.all(this._table)
      let n = 0
      for (const rec of [...this._results]) {
        const idx = arr.indexOf(rec)
        if (idx >= 0) {
          arr.splice(idx, 1)
          n++
        }
      }
      gs._log('debug', `[deleteMultiple] ${this._table}: removed ${n}`)
      this._results = []
      this._cursor = -1
      return n
    }
    updateMultiple() {
      gs._log('debug', `[updateMultiple] ${this._table}`)
      return true
    }
  }
  return GlideRecord
}

// ---------------------------------------------------------------------------
// GlideAggregate
// ---------------------------------------------------------------------------
export function makeGlideAggregate(db) {
  class GlideAggregate {
    constructor(table) {
      this._table = table
      this._conditions = []
      this._groupBy = []
      this._aggregates = [] // {type, field}
      this._orderByAgg = null
      this._groups = []
      this._cursor = -1
    }
    addQuery(field, opOrValue, maybeValue) {
      let op = '='
      let value = opOrValue
      if (maybeValue !== undefined) {
        op = opOrValue
        value = maybeValue
      }
      this._conditions.push({ field, op, value: value == null ? '' : String(value) })
      return this
    }
    addEncodedQuery(encoded) {
      for (const raw of String(encoded || '').split('^')) {
        if (!raw) continue
        const parsed = parseEncodedTerm(raw.replace(/^OR/, ''))
        if (parsed) this._conditions.push(parsed)
      }
      return this
    }
    addAggregate(type, field) {
      this._aggregates.push({ type: String(type).toUpperCase(), field: field || null })
      return this
    }
    groupBy(field) {
      this._groupBy.push(field)
      return this
    }
    orderByAggregate(type, field) {
      this._orderByAgg = { type: String(type).toUpperCase(), field: field || null }
      return this
    }
    setLimit() {
      return this
    }
    query() {
      const rows = db.all(this._table).filter((r) => this._conditions.every((t) => matchOperator(r[t.field], t.op, t.value)))
      const map = new Map()
      for (const r of rows) {
        const key = this._groupBy.map((f) => r[f]).join('')
        if (!map.has(key)) map.set(key, { keyFields: this._groupBy.map((f) => r[f]), rows: [] })
        map.get(key).rows.push(r)
      }
      if (this._groupBy.length === 0) {
        this._groups = [{ keyFields: [], rows }]
      } else {
        this._groups = [...map.values()]
      }
      this._cursor = -1
      return this
    }
    next() {
      if (this._cursor + 1 < this._groups.length) {
        this._cursor++
        return true
      }
      return false
    }
    hasNext() {
      return this._cursor + 1 < this._groups.length
    }
    _group() {
      return this._groups[this._cursor]
    }
    getAggregate(type, field) {
      const g = this._group()
      if (!g) return '0'
      const t = String(type).toUpperCase()
      const nums = field ? g.rows.map((r) => Number(r[field])).filter((n) => !Number.isNaN(n)) : []
      switch (t) {
        case 'COUNT':
          return String(g.rows.length)
        case 'SUM':
          return String(nums.reduce((a, b) => a + b, 0))
        case 'AVG':
          return nums.length ? String(nums.reduce((a, b) => a + b, 0) / nums.length) : '0'
        case 'MIN':
          return nums.length ? String(Math.min(...nums)) : '0'
        case 'MAX':
          return nums.length ? String(Math.max(...nums)) : '0'
        default:
          return String(g.rows.length)
      }
    }
    getValue(field) {
      const g = this._group()
      if (!g) return ''
      const idx = this._groupBy.indexOf(field)
      return idx >= 0 ? String(g.keyFields[idx]) : ''
    }
    getDisplayValue(field) {
      const raw = this.getValue(field)
      const choice = CHOICES[this._table] && CHOICES[this._table][field]
      return choice && choice[raw] != null ? choice[raw] : raw
    }
    getRowCount() {
      return this._groups.length
    }
  }
  return GlideAggregate
}

// ---------------------------------------------------------------------------
// Date/Time classes (simplified)
// ---------------------------------------------------------------------------
function pad(n) {
  return String(n).padStart(2, '0')
}
function fmt(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export class GlideDateTime {
  constructor(value) {
    this._date = value ? new Date(String(value).replace(' ', 'T')) : new Date()
    if (Number.isNaN(this._date.getTime())) this._date = new Date()
  }
  getValue() {
    return fmt(this._date)
  }
  getDisplayValue() {
    return fmt(this._date)
  }
  getNumericValue() {
    return this._date.getTime()
  }
  toString() {
    return fmt(this._date)
  }
  addSeconds(s) {
    this._date = new Date(this._date.getTime() + s * 1000)
  }
  addDays(d) {
    this._date = new Date(this._date.getTime() + d * 86400000)
  }
  add(ms) {
    this._date = new Date(this._date.getTime() + Number(ms))
  }
  subtract(ms) {
    this._date = new Date(this._date.getTime() - Number(ms))
  }
  getDayOfWeek() {
    return this._date.getDay() === 0 ? 7 : this._date.getDay()
  }
  before(other) {
    return this.getNumericValue() < other.getNumericValue()
  }
  after(other) {
    return this.getNumericValue() > other.getNumericValue()
  }
}

export class GlideDate extends GlideDateTime {
  getValue() {
    return this.toString().slice(0, 10)
  }
  getDisplayValue() {
    return this.getValue()
  }
  toString() {
    return fmt(this._date).slice(0, 10)
  }
}

export class GlideDuration {
  constructor(ms) {
    this._ms = Number(ms) || 0
  }
  getDisplayValue() {
    const totalSec = Math.floor(this._ms / 1000)
    const days = Math.floor(totalSec / 86400)
    const h = Math.floor((totalSec % 86400) / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    return `${days} Days ${pad(h)}:${pad(m)}:${pad(s)}`
  }
  getNumericValue() {
    return this._ms
  }
  toString() {
    return this.getDisplayValue()
  }
}

// ---------------------------------------------------------------------------
// gs — GlideSystem
// ---------------------------------------------------------------------------
export function makeGlideSystem(db, emit) {
  function substitute(msg, args) {
    let out = String(msg)
    args.forEach((a, i) => {
      out = out.replace(new RegExp(`\\{${i}\\}`, 'g'), a == null ? '' : String(a))
    })
    return out
  }
  const gs = {
    _log(level, text) {
      emit({ level, text: String(text) })
    },
    info(msg, ...args) {
      emit({ level: 'info', text: substitute(msg, args) })
    },
    print(msg, ...args) {
      emit({ level: 'print', text: substitute(msg, args) })
    },
    log(msg) {
      emit({ level: 'info', text: String(msg) })
    },
    warn(msg, ...args) {
      emit({ level: 'warn', text: substitute(msg, args) })
    },
    error(msg, ...args) {
      emit({ level: 'error', text: substitute(msg, args) })
    },
    debug(msg, ...args) {
      emit({ level: 'debug', text: substitute(msg, args) })
    },
    addInfoMessage(msg) {
      emit({ level: 'message-info', text: String(msg) })
    },
    addErrorMessage(msg) {
      emit({ level: 'message-error', text: String(msg) })
    },
    getUserName() {
      return 'admin'
    },
    getUserID() {
      const u = db.all('sys_user').find((x) => x.user_name === 'admin')
      return u ? u.sys_id : ''
    },
    getUserDisplayName() {
      return 'System Administrator'
    },
    getProperty(name, def) {
      const props = {
        'glide.product.name': 'GlideScript Playground',
        'instance_name': 'dev-playground',
        'glide.servlet.uri': 'https://dev-playground.service-now.com/',
      }
      return props[name] != null ? props[name] : def !== undefined ? def : ''
    },
    nowDateTime() {
      return fmt(new Date())
    },
    now() {
      return fmt(new Date()).slice(11)
    },
    nowNoTZ() {
      return fmt(new Date())
    },
    beginningOfToday() {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      return fmt(d)
    },
    endOfToday() {
      const d = new Date()
      d.setHours(23, 59, 59, 0)
      return fmt(d)
    },
    daysAgo(n) {
      return fmt(new Date(Date.now() - n * 86400000))
    },
    daysAgoStart(n) {
      const d = new Date(Date.now() - n * 86400000)
      d.setHours(0, 0, 0, 0)
      return fmt(d)
    },
    generateGUID() {
      return db.newGuid()
    },
    getMessage(key) {
      return String(key)
    },
    eventQueue(name, record, p1, p2) {
      emit({ level: 'debug', text: `[eventQueue] ${name} (${p1 ?? ''}, ${p2 ?? ''})` })
    },
    sleep() {},
    hasRole() {
      return true
    },
    isInteractive() {
      return true
    },
    tableExists(t) {
      return db.has(t)
    },
    include() {
      return true
    },
  }
  return gs
}

export { GlideElement }
