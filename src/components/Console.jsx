import { motion, AnimatePresence } from 'framer-motion'
import { Info, AlertTriangle, XCircle, Bug, Terminal, CornerDownRight, MessageSquare } from 'lucide-react'

const STYLES = {
  info: { icon: Info, color: 'text-cyan-700', tag: 'INFO', tagBg: 'bg-cyan-50 text-cyan-800 ring-cyan-100' },
  print: { icon: Terminal, color: 'text-emerald-700', tag: 'PRINT', tagBg: 'bg-emerald-50 text-emerald-800 ring-emerald-100' },
  log: { icon: Terminal, color: 'text-slate-700', tag: 'LOG', tagBg: 'bg-slate-100 text-slate-700 ring-slate-200' },
  warn: { icon: AlertTriangle, color: 'text-amber-700', tag: 'WARN', tagBg: 'bg-amber-50 text-amber-800 ring-amber-100' },
  error: { icon: XCircle, color: 'text-red-700', tag: 'ERROR', tagBg: 'bg-red-50 text-red-800 ring-red-100' },
  debug: { icon: Bug, color: 'text-violet-700', tag: 'DEBUG', tagBg: 'bg-violet-50 text-violet-800 ring-violet-100' },
  return: { icon: CornerDownRight, color: 'text-sky-700', tag: 'RETURN', tagBg: 'bg-sky-50 text-sky-800 ring-sky-100' },
  'message-info': { icon: MessageSquare, color: 'text-cyan-700', tag: 'MSG', tagBg: 'bg-cyan-50 text-cyan-800 ring-cyan-100' },
  'message-error': { icon: MessageSquare, color: 'text-red-700', tag: 'MSG', tagBg: 'bg-red-50 text-red-800 ring-red-100' },
}

export default function Console({ entries, status }) {
  const normalizedEntries = entries.map(normalizeEntry)

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex-1 overflow-auto px-3 py-3 font-mono text-[12.5px] leading-relaxed">
        {normalizedEntries.length === 0 ? (
          <div className="flex h-full min-h-56 flex-col items-center justify-center text-slate-400">
            <div className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 bg-slate-50">
              <Terminal className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-500">No output</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {normalizedEntries.map((entry, i) => {
              const style = STYLES[entry.level] || STYLES.log
              const Icon = style.icon

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.12 }}
                  className="group relative grid grid-cols-[1rem_4.25rem_minmax(0,1fr)] items-start gap-2 border-b border-slate-100 px-1 py-2 last:border-b-0 hover:bg-slate-50"
                >
                  <Icon className={`mt-[3px] h-3.5 w-3.5 ${style.color}`} />
                  <span className={`rounded px-1.5 py-0.5 text-center text-[10px] font-semibold tracking-wide ring-1 ${style.tagBg}`}>
                    {style.tag}
                  </span>
                  <span className={`whitespace-pre-wrap break-words ${style.color}`}>{entry.text}</span>
                  <span className="absolute right-1 top-2 rounded bg-white/90 pl-2 text-[10px] tabular-nums text-slate-400 opacity-0 group-hover:opacity-100">
                    {entry.t != null ? `${entry.t.toFixed(1)}ms` : ''}
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      {status && (
        <div
          className={`flex min-h-9 items-center gap-2 border-t px-4 py-2 text-xs font-medium ${
            status.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.ok ? 'bg-emerald-600' : 'bg-red-600'}`} />
          <span className="truncate">{status.text}</span>
        </div>
      )}
    </div>
  )
}

function normalizeEntry(entry) {
  if (entry == null) return { level: 'log', text: '' }
  if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
    return { level: 'log', text: String(entry) }
  }

  const level = String(entry.level || entry.type || 'log').toLowerCase()
  const text =
    entry.text ??
    entry.message ??
    entry.value ??
    entry.output ??
    (entry.args ? entry.args.map(String).join(' ') : '')

  return {
    ...entry,
    level,
    text: text == null ? '' : String(text),
  }
}
