import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ClipboardList, FilePlus2 } from 'lucide-react'
import { getFields, makeFormState, runClientScript, runProducerScript } from '../engine/clientRuntime.js'

const PRODUCER_FIELDS = ['requested_for', 'short_description', 'category', 'urgency']

const ClientWorkspace = forwardRef(function ClientWorkspace({ mode, db, code, entries, onOutput, onStatus, onDbChange }, ref) {
  const names = db.tableNames()
  const [table, setTable] = useState('incident')
  const [recordId, setRecordId] = useState('')
  const [scriptType, setScriptType] = useState('onLoad')
  const [changeField, setChangeField] = useState('priority')
  const [lastChange, setLastChange] = useState({ field: 'priority', oldValue: '', newValue: '' })
  const [formState, setFormState] = useState(() => makeFormState(db, 'incident'))
  const [producerTarget, setProducerTarget] = useState('incident')
  const [producerValues, setProducerValues] = useState({
    requested_for: 'Abel Tuter',
    short_description: 'Need access to payroll reports',
    category: 'inquiry',
    urgency: '3',
  })

  const rows = db.all(table)
  const fields = useMemo(() => getFields(db, table), [db, table])

  useEffect(() => {
    const first = db.all(table)[0]?.sys_id || ''
    setRecordId(first)
    setFormState(makeFormState(db, table, first))
    setChangeField(getFields(db, table)[0] || '')
  }, [db, table])

  useImperativeHandle(ref, () => ({
    run() {
      return mode === 'producer' ? runProducer() : runClient()
    },
  }))

  function updateField(field, value) {
    setFormState((current) => {
      const oldValue = current.values[field] || ''
      setLastChange({ field, oldValue, newValue: value })
      setChangeField(field)
      return { ...current, values: { ...current.values, [field]: value } }
    })
  }

  function selectRecord(sysId) {
    setRecordId(sysId)
    setFormState(makeFormState(db, table, sysId))
  }

  function runClient() {
    const change = scriptType === 'onChange' ? lastChange : { field: changeField, oldValue: '', newValue: formState.values[changeField] || '' }
    const result = runClientScript({
      code,
      scriptType,
      fieldName: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      isLoading: scriptType === 'onLoad',
      formState,
    })
    setFormState(result.formState)
    onOutput(result.output)
    onStatus({
      ok: !result.error && result.returnValue !== false,
      text: result.error
        ? `Client script failed - ${result.error.name}`
        : `${scriptType} ran in ${result.durationMs.toFixed(1)}ms${result.returnValue === false ? ' - blocked submit' : ''}`,
    })
    return result
  }

  function runProducer() {
    const result = runProducerScript({ db, code, targetTable: producerTarget, producerValues })
    onOutput(result.output)
    onStatus({
      ok: !result.error,
      text: result.error
        ? `Producer failed - ${result.error.name}`
        : `Producer created ${producerTarget} in ${result.durationMs.toFixed(1)}ms`,
    })
    onDbChange?.()
    return result
  }

  if (mode === 'producer') {
    return (
      <div className="flex h-full flex-col bg-white">
        <PanelHeader icon={FilePlus2} title="Record producer" />
        <motion.div className="border-b border-slate-200 bg-stone-50 px-3 py-3" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Target table</label>
          <select
            value={producerTarget}
            onChange={(event) => setProducerTarget(event.target.value)}
            className="mt-1 h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15"
          >
            {names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </motion.div>
        <div className="flex-1 overflow-auto p-3">
          <div className="grid gap-3">
            {PRODUCER_FIELDS.map((field) => (
              <motion.label
                key={field}
                className="block"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                whileHover={{ y: -1 }}
              >
                <span className="mb-1 block font-mono text-[11px] text-slate-500">{field}</span>
                <input
                  value={producerValues[field] || ''}
                  onChange={(event) => setProducerValues((values) => ({ ...values, [field]: event.target.value }))}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15"
                />
              </motion.label>
            ))}
          </div>
        </div>
        <OutputPane entries={entries} />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <PanelHeader icon={ClipboardList} title="Client form" />
      <motion.div className="grid shrink-0 gap-2 border-b border-slate-200 bg-stone-50 px-3 py-3 sm:grid-cols-2" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Table</span>
          <select
            value={table}
            onChange={(event) => setTable(event.target.value)}
            className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15"
          >
            {names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Script type</span>
          <select
            value={scriptType}
            onChange={(event) => setScriptType(event.target.value)}
            className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15"
          >
            <option value="onLoad">onLoad</option>
            <option value="onChange">onChange</option>
            <option value="onSubmit">onSubmit</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Record</span>
          <select
            value={recordId}
            onChange={(event) => selectRecord(event.target.value)}
            className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15"
          >
            {rows.map((row) => (
              <option key={row.sys_id} value={row.sys_id}>
                {row.number || row.name || row.user_name || row.sys_id}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Change field</span>
          <select
            value={changeField}
            onChange={(event) => setChangeField(event.target.value)}
            className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15"
          >
            {fields.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
        </label>
      </motion.div>

      <div className="flex-1 overflow-auto p-3">
        <AnimatePresence initial={false}>
          {formState.messages.length > 0 && (
          <motion.div className="mb-3 space-y-2" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            {formState.messages.map((message, index) => (
              <motion.div
                key={`${message.text}-${index}`}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.16 }}
                className={`rounded-md border px-3 py-2 text-sm ${
                  message.level === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-cyan-200 bg-cyan-50 text-cyan-800'
                }`}
              >
                {message.field && <span className="font-mono text-xs">{message.field}: </span>}
                {message.text}
              </motion.div>
            ))}
          </motion.div>
          )}
        </AnimatePresence>

        <motion.div className="grid gap-3" layout>
          {formState.fields.map((field) => {
            const hidden = formState.visible[field] === false
            if (hidden) {
              return (
                <motion.div key={field} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="rounded-md border border-dashed border-slate-200 px-3 py-2 font-mono text-xs text-slate-400">
                  {field} hidden
                </motion.div>
              )
            }

            return (
              <motion.label
                key={field}
                className="block"
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                whileHover={{ y: -1 }}
              >
                <span className="mb-1 flex items-center gap-2 font-mono text-[11px] text-slate-500">
                  {field}
                  <AnimatePresence>
                    {formState.mandatory[field] && (
                      <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                        required
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <AnimatePresence>
                    {formState.readOnly[field] && (
                      <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                        readonly
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <input
                  value={formState.values[field] || ''}
                  readOnly={Boolean(formState.readOnly[field])}
                  onChange={(event) => updateField(field, event.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15 read-only:bg-slate-50 read-only:text-slate-500"
                />
              </motion.label>
            )
          })}
        </motion.div>
      </div>
      <OutputPane entries={entries} />
    </div>
  )
})

function PanelHeader({ icon: Icon, title }) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-200 px-3">
      <Icon className="h-4 w-4 text-cyan-700" />
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</span>
    </div>
  )
}

function OutputPane({ entries }) {
  return (
    <div className="max-h-36 shrink-0 overflow-auto border-t border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px]">
      <AnimatePresence mode="wait">
        {entries.length === 0 ? (
        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-slate-400">
          Run output appears here.
        </motion.div>
        ) : (
        <motion.div key="entries" className="space-y-1" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
          {entries.map((entry, index) => (
            <motion.div
              key={`${entry.level}-${index}`}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.16, delay: Math.min(index * 0.025, 0.12) }}
              className={entry.level === 'error' || entry.level === 'message-error' ? 'text-red-700' : 'text-slate-700'}
            >
              <span className="mr-2 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500 ring-1 ring-slate-200">
                {entry.level}
              </span>
              {entry.text}
            </motion.div>
          ))}
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ClientWorkspace
