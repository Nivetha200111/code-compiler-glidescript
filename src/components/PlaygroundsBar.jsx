import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Save, FolderOpen, Trash2, Loader2, Check, FileCode } from 'lucide-react'

function timeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso.replace(' ', 'T') + 'Z').getTime()
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function PlaygroundsBar({ playgrounds, onSave, onLoad, onDelete, busy }) {
  const [saveOpen, setSaveOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [name, setName] = useState('')
  const [justSaved, setJustSaved] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setSaveOpen(false)
        setListOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  async function submitSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    await onSave(name.trim())
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1600)
    setSaveOpen(false)
    setName('')
  }

  return (
    <div ref={wrapRef} className="flex items-center gap-2">
      {/* Save */}
      <div className="relative">
        <motion.button
          onClick={() => {
            setSaveOpen((v) => !v)
            setListOpen(false)
          }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
        >
          {justSaved ? <Check className="h-4 w-4 text-cyan-300" /> : <Save className="h-4 w-4" />}
          <span className="hidden sm:inline">{justSaved ? 'Saved' : 'Save'}</span>
        </motion.button>

        <AnimatePresence>
          {saveOpen && (
            <motion.form
              onSubmit={submitSave}
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.14 }}
              className="absolute right-0 top-11 z-50 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-xl"
            >
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Save script as</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My GlideRecord query"
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15"
              />
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-br from-cyan-400 to-cyan-600 px-3 py-2 text-sm font-semibold text-now-900 transition-all hover:brightness-110 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save to my account
              </button>
              <p className="mt-1.5 text-[11px] text-slate-400">Same name overwrites the existing one.</p>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* My scripts */}
      <div className="relative">
        <motion.button
          onClick={() => {
            setListOpen((v) => !v)
            setSaveOpen(false)
          }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
        >
          <FolderOpen className="h-4 w-4" />
          <span className="hidden sm:inline">My scripts</span>
          {playgrounds.length > 0 && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-200">{playgrounds.length}</span>
          )}
        </motion.button>

        <AnimatePresence>
          {listOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.14 }}
              className="absolute right-0 top-11 z-50 max-h-80 w-72 overflow-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl"
            >
              {playgrounds.length === 0 ? (
                <div className="flex flex-col items-center gap-1 px-3 py-6 text-center">
                  <FileCode className="h-5 w-5 text-slate-300" />
                  <p className="text-sm font-medium text-slate-500">No saved scripts yet</p>
                  <p className="text-[11px] text-slate-400">Hit Save to keep one in your account.</p>
                </div>
              ) : (
                playgrounds.map((pg) => (
                  <div
                    key={pg.id}
                    className="group flex items-center gap-2 rounded-md px-2.5 py-2 transition-colors hover:bg-slate-50"
                  >
                    <button
                      onClick={() => {
                        onLoad(pg)
                        setListOpen(false)
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-[13px] font-medium text-slate-800">{pg.name}</span>
                      <span className="block text-[11px] text-slate-400">{timeAgo(pg.updated_at)}</span>
                    </button>
                    <button
                      onClick={() => onDelete(pg)}
                      className="rounded p-1 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
