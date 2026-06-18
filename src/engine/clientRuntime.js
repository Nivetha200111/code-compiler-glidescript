import { FIELD_ORDER } from './database.js'
import { makeGlideRecord, makeGlideAggregate, makeGlideSystem } from './glide.js'

export function getFields(db, table) {
  const rows = db.all(table)
  const inferred = rows[0] ? Object.keys(rows[0]).filter((key) => key !== 'sys_id') : []
  return FIELD_ORDER[table] || inferred
}

export function makeFormState(db, table, sysId) {
  const rows = db.all(table)
  const record = rows.find((row) => row.sys_id === sysId) || rows[0] || {}
  const fields = getFields(db, table)
  const values = {}
  for (const field of fields) values[field] = record[field] == null ? '' : String(record[field])

  return {
    table,
    sysId: record.sys_id || null,
    fields,
    values,
    mandatory: {},
    readOnly: {},
    visible: Object.fromEntries(fields.map((field) => [field, true])),
    messages: [],
  }
}

export function runClientScript({ code, scriptType, fieldName, oldValue, newValue, isLoading, formState }) {
  const output = []
  const started = performance.now()
  const emit = (level, text) => output.push({ level, text: String(text), t: performance.now() - started })
  const nextForm = cloneForm(formState)

  const gForm = {
    getTableName: () => nextForm.table,
    getUniqueValue: () => nextForm.sysId || '',
    getValue: (field) => nextForm.values[field] || '',
    setValue(field, value) {
      ensureField(nextForm, field)
      nextForm.values[field] = value == null ? '' : String(value)
      emit('debug', `[g_form.setValue] ${field} = ${nextForm.values[field]}`)
    },
    getDisplayValue: (field) => nextForm.values[field] || '',
    setMandatory(field, value) {
      ensureField(nextForm, field)
      nextForm.mandatory[field] = Boolean(value)
      emit('debug', `[g_form.setMandatory] ${field} = ${Boolean(value)}`)
    },
    isMandatory: (field) => Boolean(nextForm.mandatory[field]),
    setReadOnly(field, value) {
      ensureField(nextForm, field)
      nextForm.readOnly[field] = Boolean(value)
      emit('debug', `[g_form.setReadOnly] ${field} = ${Boolean(value)}`)
    },
    isReadOnly: (field) => Boolean(nextForm.readOnly[field]),
    setVisible(field, value) {
      ensureField(nextForm, field)
      nextForm.visible[field] = Boolean(value)
      emit('debug', `[g_form.setVisible] ${field} = ${Boolean(value)}`)
    },
    isVisible: (field) => nextForm.visible[field] !== false,
    addInfoMessage(message) {
      nextForm.messages.push({ level: 'info', text: String(message) })
      emit('message-info', message)
    },
    addErrorMessage(message) {
      nextForm.messages.push({ level: 'error', text: String(message) })
      emit('message-error', message)
    },
    showFieldMsg(field, message, type = 'info') {
      nextForm.messages.push({ level: type === 'error' ? 'error' : 'info', field, text: String(message) })
      emit(type === 'error' ? 'message-error' : 'message-info', `${field}: ${message}`)
    },
    clearMessages() {
      nextForm.messages = []
      emit('debug', '[g_form.clearMessages]')
    },
  }

  const gUser = {
    userName: 'admin',
    firstName: 'System',
    lastName: 'Administrator',
    userID: 'admin',
    hasRole: () => true,
  }

  let error = null
  let returnValue
  try {
    const call = scriptType === 'onChange' ? 'onChange(control, oldValue, newValue, isLoading)' : `${scriptType}()`
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      'g_form',
      'g_user',
      'control',
      'oldValue',
      'newValue',
      'isLoading',
      `${code}\nif (typeof ${scriptType} === 'function') return ${call};`,
    )
    returnValue = fn(gForm, gUser, { name: fieldName }, oldValue, newValue, Boolean(isLoading))
    emit('info', `${scriptType} completed${returnValue === false ? ' with return false' : ''}`)
  } catch (e) {
    error = e
    emit('error', `${e.name}: ${e.message}`)
  }

  return {
    formState: nextForm,
    output,
    error,
    returnValue,
    durationMs: performance.now() - started,
  }
}

export function runProducerScript({ db, code, targetTable, producerValues }) {
  const output = []
  const started = performance.now()
  const emit = (entry) => output.push({ ...entry, t: performance.now() - started })
  const gs = makeGlideSystem(db, emit)
  const GlideRecord = makeGlideRecord(db, gs)
  const GlideAggregate = makeGlideAggregate(db)
  const currentValues = {}

  const current = new Proxy(
    {
      getTableName: () => targetTable,
      getValue: (field) => currentValues[field] || '',
      setValue: (field, value) => {
        currentValues[field] = value == null ? '' : String(value)
      },
    },
    {
      get(target, prop) {
        if (typeof prop !== 'string' || prop in target) return target[prop]
        return currentValues[prop] || ''
      },
      set(target, prop, value) {
        if (typeof prop !== 'string' || prop in target) {
          target[prop] = value
        } else {
          currentValues[prop] = value == null ? '' : String(value)
        }
        return true
      },
    },
  )

  let error = null
  let row = null
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('producer', 'current', 'gs', 'GlideRecord', 'GlideAggregate', `'use strict';\n${code}`)
    fn({ ...producerValues }, current, gs, GlideRecord, GlideAggregate)
    row = db.insertRow(targetTable, currentValues)
    emit({ level: 'debug', text: `[record producer] created ${targetTable}: ${row.sys_id}` })
  } catch (e) {
    error = e
    emit({ level: 'error', text: `${e.name}: ${e.message}` })
  }

  return {
    output,
    error,
    row,
    durationMs: performance.now() - started,
  }
}

function cloneForm(form) {
  return {
    ...form,
    fields: [...form.fields],
    values: { ...form.values },
    mandatory: { ...form.mandatory },
    readOnly: { ...form.readOnly },
    visible: { ...form.visible },
    messages: [...form.messages],
  }
}

function ensureField(form, field) {
  if (!form.fields.includes(field)) form.fields.push(field)
  if (!Object.prototype.hasOwnProperty.call(form.values, field)) form.values[field] = ''
  if (!Object.prototype.hasOwnProperty.call(form.visible, field)) form.visible[field] = true
}
