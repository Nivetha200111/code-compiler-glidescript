import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Database, Plus, RotateCcw, Rows3 } from 'lucide-react'
import { FIELD_ORDER } from '../engine/database.js'

export default function TableViewer({ db, onReset, onChange }) {
  const names = db.tableNames()
  const [active, setActive] = useState(names[0])
  const [tableName, setTableName] = useState('')
  const [tableFields, setTableFields] = useState('number, short_description, active')
  const [fieldName, setFieldName] = useState('')
  const [rowDraft, setRowDraft] = useState({})
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!names.includes(active)) setActive(names[0])
  }, [active, names])

  const rows = db.all(active)
  const cols = useMemo(() => {
    const inferred = rows[0] ? Object.keys(rows[0]).filter((key) => key !== 'sys_id') : []
    return FIELD_ORDER[active] || inferred
  }, [active, rows])

  function commit(work) {
    try {
      const result = work()
      setMessage('')
      onChange?.()
      return result
    } catch (error) {
      setMessage(error.message)
      return null
    }
  }

  function createTable(event) {
    event.preventDefault()
    const fields = tableFields.split(',').map((field) => field.trim())
    const created = commit(() => db.createTable(tableName, fields))
    if (!created) return
    setActive(created)
    setTableName('')
    setTableFields('number, short_description, active')
    setRowDraft({})
  }

  function addField(event) {
    event.preventDefault()
    const created = commit(() => db.addField(active, fieldName))
    if (!created) return
    setFieldName('')
    setRowDraft((draft) => ({ ...draft, [created]: '' }))
  }

  function addRow(event) {
    event.preventDefault()
    commit(() => db.insertRow(active, rowDraft))
    setRowDraft({})
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-200 px-3">
        <Database className="h-4 w-4 text-cyan-700" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">Mock database</span>
        <motion.button
          onClick={onReset}
          whileHover={{ y: -1, rotate: -1 }}
          whileTap={{ scale: 0.98 }}
          className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-950"
          title="Reseed all tables"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reseed
        </motion.button>
      </div>

      <motion.div className="shrink-0 border-b border-slate-200 bg-stone-50 px-3 py-3" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        <form onSubmit={createTable} className="grid gap-2 sm:grid-cols-[minmax(8rem,1fr)_minmax(11rem,1.4fr)_auto]">
          <input
            value={tableName}
            onChange={(event) => setTableName(event.target.value)}
            placeholder="table_name"
            className="h-8 min-w-0 rounded-md border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15"
          />
          <input
            value={tableFields}
            onChange={(event) => setTableFields(event.target.value)}
            placeholder="field_one, field_two"
            className="h-8 min-w-0 rounded-md border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15"
          />
          <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white transition-colors hover:bg-cyan-800">
            <Plus className="h-3.5 w-3.5" />
            Table
          </motion.button>
        </form>
        <AnimatePresence>
          {message && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="mt-2 text-xs font-medium text-red-700">
              {message}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 px-3 py-2">
        {names.map((name) => (
          <motion.button
            key={name}
            onClick={() => {
              setActive(name)
              setRowDraft({})
              setMessage('')
            }}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className={`relative whitespace-nowrap rounded-md px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
              active === name ? 'text-slate-950' : 'text-slate-500 hover:bg-white hover:text-slate-900'
            }`}
          >
            {active === name && <motion.span layoutId="active-db-table" className="absolute inset-0 rounded-md bg-white shadow-sm ring-1 ring-slate-300" transition={{ type: 'spring', stiffness: 520, damping: 34 }} />}
            <span className="relative">{name}</span>
            <span className="relative ml-1.5 text-slate-400">{db.all(name).length}</span>
          </motion.button>
        ))}
      </div>

      <motion.div key={active} className="shrink-0 border-b border-slate-200 px-3 py-3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        <form onSubmit={addField} className="mb-2 flex gap-2">
          <input
            value={fieldName}
            onChange={(event) => setFieldName(event.target.value)}
            placeholder="new_field"
            className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15"
          />
          <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950">
            <Plus className="h-3.5 w-3.5" />
            Field
          </motion.button>
        </form>

        <form onSubmit={addRow} className="space-y-2">
          <div className="grid max-h-28 grid-cols-1 gap-2 overflow-auto sm:grid-cols-2">
            {cols.map((col) => (
              <motion.label key={col} className="min-w-0" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }}>
                <span className="mb-1 block font-mono text-[10px] text-slate-500">{col}</span>
                <input
                  value={rowDraft[col] || ''}
                  onChange={(event) => setRowDraft((draft) => ({ ...draft, [col]: event.target.value }))}
                  className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15"
                />
              </motion.label>
            ))}
          </div>
          <motion.button
            disabled={cols.length === 0}
            whileHover={cols.length === 0 ? undefined : { y: -1 }}
            whileTap={cols.length === 0 ? undefined : { scale: 0.98 }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Rows3 className="h-3.5 w-3.5" />
            Row
          </motion.button>
        </form>
      </motion.div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(203,213,225,1)]">
            <tr>
              {cols.map((col) => (
                <th key={col} className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-slate-600">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <motion.tbody>
            {rows.map((row) => (
              <motion.tr
                key={row.sys_id}
                className="border-b border-slate-100 hover:bg-cyan-50/45"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                layout
              >
                {cols.map((col) => (
                  <td key={col} className="max-w-[260px] truncate px-3 py-2 text-slate-800" title={String(row[col] ?? '')}>
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </motion.tr>
            ))}
            {rows.length === 0 && (
              <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <td colSpan={Math.max(cols.length, 1)} className="px-3 py-8 text-center text-slate-400">
                  {cols.length ? 'Empty table' : 'Add a field to start this table'}
                </td>
              </motion.tr>
            )}
          </motion.tbody>
        </table>
      </div>
    </div>
  )
}
