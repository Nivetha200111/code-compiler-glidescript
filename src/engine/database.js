// In-memory ServiceNow-style database.
// Records are plain objects keyed by field name. Values are stored as strings
// (the way ServiceNow stores them) and coerced when needed.

let counter = 1000
function guid() {
  // 32-char hex, ServiceNow sys_id style
  let s = ''
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16)
  return s
}
function seq() {
  return ++counter
}

// ---- Choice / label maps (used by getDisplayValue) -------------------------
export const CHOICES = {
  incident: {
    priority: { 1: '1 - Critical', 2: '2 - High', 3: '3 - Moderate', 4: '4 - Low', 5: '5 - Planning' },
    impact: { 1: '1 - High', 2: '2 - Medium', 3: '3 - Low' },
    urgency: { 1: '1 - High', 2: '2 - Medium', 3: '3 - Low' },
    state: { 1: 'New', 2: 'In Progress', 3: 'On Hold', 6: 'Resolved', 7: 'Closed', 8: 'Canceled' },
  },
  change_request: {
    priority: { 1: '1 - Critical', 2: '2 - High', 3: '3 - Moderate', 4: '4 - Low' },
    risk: { 2: 'High', 3: 'Moderate', 4: 'Low' },
    state: { '-5': 'New', '-4': 'Assess', '-3': 'Authorize', '-2': 'Scheduled', '-1': 'Implement', 0: 'Review', 3: 'Closed' },
  },
}

// Reference fields: field -> { table, display } where display is the field on
// the referenced table used as the display value.
export const REFERENCES = {
  incident: {
    assigned_to: { table: 'sys_user', display: 'name' },
    caller_id: { table: 'sys_user', display: 'name' },
    assignment_group: { table: 'sys_user_group', display: 'name' },
  },
  change_request: {
    assigned_to: { table: 'sys_user', display: 'name' },
    assignment_group: { table: 'sys_user_group', display: 'name' },
  },
  sys_user: {
    department: { table: 'sys_user_group', display: 'name' },
  },
}

function buildSeed() {
  const groups = [
    { sys_id: guid(), name: 'Network', description: 'Network operations', active: 'true' },
    { sys_id: guid(), name: 'Hardware', description: 'Hardware support', active: 'true' },
    { sys_id: guid(), name: 'Software', description: 'Application support', active: 'true' },
    { sys_id: guid(), name: 'Service Desk', description: 'Tier 1 support', active: 'true' },
  ]
  const g = (name) => groups.find((x) => x.name === name).sys_id

  const users = [
    { sys_id: guid(), user_name: 'admin', name: 'System Administrator', email: 'admin@example.com', active: 'true', vip: 'false', department: g('Service Desk') },
    { sys_id: guid(), user_name: 'abel.tuter', name: 'Abel Tuter', email: 'abel.tuter@example.com', active: 'true', vip: 'false', department: g('Network') },
    { sys_id: guid(), user_name: 'bow.ruggeri', name: 'Bow Ruggeri', email: 'bow.ruggeri@example.com', active: 'true', vip: 'true', department: g('Hardware') },
    { sys_id: guid(), user_name: 'fred.luddy', name: 'Fred Luddy', email: 'fred.luddy@example.com', active: 'true', vip: 'false', department: g('Software') },
    { sys_id: guid(), user_name: 'beth.anglin', name: 'Beth Anglin', email: 'beth.anglin@example.com', active: 'false', vip: 'false', department: g('Service Desk') },
  ]
  const u = (uname) => users.find((x) => x.user_name === uname).sys_id

  function inc(num, fields) {
    return {
      sys_id: guid(),
      number: num,
      sys_created_on: fields.sys_created_on || '2026-06-10 09:00:00',
      ...fields,
    }
  }
  const incidents = [
    inc('INC0010001', { short_description: 'Email server is down', priority: '1', impact: '1', urgency: '1', state: '2', active: 'true', category: 'inquiry', caller_id: u('abel.tuter'), assigned_to: u('fred.luddy'), assignment_group: g('Network') }),
    inc('INC0010002', { short_description: 'Cannot connect to VPN', priority: '2', impact: '2', urgency: '2', state: '1', active: 'true', category: 'network', caller_id: u('bow.ruggeri'), assigned_to: u('abel.tuter'), assignment_group: g('Network') }),
    inc('INC0010003', { short_description: 'Laptop will not power on', priority: '2', impact: '2', urgency: '1', state: '2', active: 'true', category: 'hardware', caller_id: u('fred.luddy'), assigned_to: u('bow.ruggeri'), assignment_group: g('Hardware') }),
    inc('INC0010004', { short_description: 'Password reset request', priority: '4', impact: '3', urgency: '3', state: '6', active: 'true', category: 'inquiry', caller_id: u('beth.anglin'), assigned_to: u('admin'), assignment_group: g('Service Desk') }),
    inc('INC0010005', { short_description: 'Printer offline on 3rd floor', priority: '3', impact: '3', urgency: '2', state: '2', active: 'true', category: 'hardware', caller_id: u('abel.tuter'), assigned_to: u('bow.ruggeri'), assignment_group: g('Hardware') }),
    inc('INC0010006', { short_description: 'Application throwing 500 errors', priority: '1', impact: '1', urgency: '2', state: '2', active: 'true', category: 'software', caller_id: u('bow.ruggeri'), assigned_to: u('fred.luddy'), assignment_group: g('Software') }),
    inc('INC0010007', { short_description: 'Request new monitor', priority: '5', impact: '3', urgency: '3', state: '7', active: 'false', category: 'hardware', caller_id: u('fred.luddy'), assigned_to: u('admin'), assignment_group: g('Service Desk') }),
    inc('INC0010008', { short_description: 'Shared drive access denied', priority: '3', impact: '2', urgency: '3', state: '1', active: 'true', category: 'software', caller_id: u('abel.tuter'), assigned_to: u('fred.luddy'), assignment_group: g('Software') }),
  ]

  const changes = [
    { sys_id: guid(), number: 'CHG0030001', short_description: 'Upgrade core router firmware', priority: '2', risk: '2', state: '-2', type: 'normal', active: 'true', assigned_to: u('abel.tuter'), assignment_group: g('Network') },
    { sys_id: guid(), number: 'CHG0030002', short_description: 'Patch database servers', priority: '1', risk: '2', state: '-1', type: 'emergency', active: 'true', assigned_to: u('fred.luddy'), assignment_group: g('Software') },
    { sys_id: guid(), number: 'CHG0030003', short_description: 'Replace failed disk in array', priority: '3', risk: '4', state: '3', type: 'standard', active: 'false', assigned_to: u('bow.ruggeri'), assignment_group: g('Hardware') },
  ]

  return {
    sys_user_group: groups,
    sys_user: users,
    incident: incidents,
    change_request: changes,
  }
}

export class Database {
  constructor() {
    this.reset()
  }
  reset() {
    this.tables = buildSeed()
  }
  has(table) {
    return Object.prototype.hasOwnProperty.call(this.tables, table)
  }
  ensure(table) {
    if (!this.has(table)) this.tables[table] = []
    return this.tables[table]
  }
  all(table) {
    return this.ensure(table)
  }
  newGuid() {
    return guid()
  }
  nextNumber(prefix) {
    return prefix + String(seq()).padStart(7, '0')
  }
  tableNames() {
    return Object.keys(this.tables)
  }
  createTable(name, fields = []) {
    const table = normalizeName(name)
    if (!table) throw new Error('Table name is required')
    if (this.has(table)) throw new Error(`Table "${table}" already exists`)

    const cleanFields = unique(fields.map(normalizeName).filter(Boolean).filter((field) => field !== 'sys_id'))
    this.tables[table] = []
    FIELD_ORDER[table] = cleanFields
    return table
  }
  addField(tableName, fieldName, defaultValue = '') {
    const table = normalizeName(tableName)
    const field = normalizeName(fieldName)
    if (!this.has(table)) throw new Error(`Table "${table}" does not exist`)
    if (!field || field === 'sys_id') throw new Error('Field name is required')

    FIELD_ORDER[table] = unique([...(FIELD_ORDER[table] || inferFields(this.tables[table])), field])
    for (const row of this.tables[table]) {
      if (!Object.prototype.hasOwnProperty.call(row, field)) row[field] = String(defaultValue ?? '')
    }
    return field
  }
  insertRow(tableName, values = {}) {
    const table = normalizeName(tableName)
    if (!this.has(table)) throw new Error(`Table "${table}" does not exist`)

    const orderedFields = FIELD_ORDER[table] || inferFields(this.tables[table])
    const row = { sys_id: guid() }
    for (const field of orderedFields) row[field] = values[field] == null ? '' : String(values[field])
    for (const [field, value] of Object.entries(values)) {
      const cleanField = normalizeName(field)
      if (!cleanField || cleanField === 'sys_id') continue
      if (!orderedFields.includes(cleanField)) this.addField(table, cleanField)
      row[cleanField] = value == null ? '' : String(value)
    }
    this.tables[table].push(row)
    return row
  }
}

export const FIELD_ORDER = {
  incident: ['number', 'short_description', 'priority', 'state', 'category', 'caller_id', 'assigned_to', 'assignment_group', 'active'],
  change_request: ['number', 'short_description', 'priority', 'risk', 'state', 'type', 'assigned_to', 'active'],
  sys_user: ['user_name', 'name', 'email', 'department', 'vip', 'active'],
  sys_user_group: ['name', 'description', 'active'],
}

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function unique(items) {
  return [...new Set(items)]
}

function inferFields(rows) {
  return rows[0] ? Object.keys(rows[0]).filter((key) => key !== 'sys_id') : []
}
