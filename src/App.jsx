import { useState, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { Play, Trash2, Database as DbIcon, PanelRight, LogIn, LogOut, Server, Monitor, FilePlus2, BookOpen, FileCode2, Maximize2, Minimize2, X } from 'lucide-react'
import CodeEditor from './components/Editor.jsx'
import Console from './components/Console.jsx'
import TableViewer from './components/TableViewer.jsx'
import ExampleSidebar from './components/ExampleSidebar.jsx'
import ClientWorkspace from './components/ClientWorkspace.jsx'
import AuthModal from './components/AuthModal.jsx'
import PlaygroundsBar from './components/PlaygroundsBar.jsx'
import LogoMark from './components/LogoMark.jsx'
import { runScript, getDatabase, resetDatabase } from './engine/runtime.js'
import { EXAMPLES, DEFAULT_CODE, DEFAULT_CLIENT_CODE, DEFAULT_PRODUCER_CODE } from './data/examples.js'

const STORAGE_KEY = 'glidescript-playground-code'
const CUSTOM_STORAGE_KEY = 'glidescript-playground-custom-code'
const CLIENT_STORAGE_KEY = 'glidescript-playground-client-code'
const PRODUCER_STORAGE_KEY = 'glidescript-playground-producer-code'
const ALL_EXAMPLES = EXAMPLES.flatMap((group) => group.items)
const DEFAULT_CUSTOM_CODE = `// Custom GlideScript scratchpad.
// Write any server-side script here and run it against the mock database.

var gr = new GlideRecord('incident');
gr.addActiveQuery();
gr.query();

gs.info('Active incidents: ' + gr.getRowCount());
`

export default function App() {
  const [code, setCode] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_CODE)
  const [customCode, setCustomCode] = useState(() => localStorage.getItem(CUSTOM_STORAGE_KEY) || DEFAULT_CUSTOM_CODE)
  const [clientCode, setClientCode] = useState(() => localStorage.getItem(CLIENT_STORAGE_KEY) || DEFAULT_CLIENT_CODE)
  const [producerCode, setProducerCode] = useState(() => localStorage.getItem(PRODUCER_STORAGE_KEY) || DEFAULT_PRODUCER_CODE)
  const [page, setPage] = useState('lessons')
  const [mode, setMode] = useState('server')
  const [entries, setEntries] = useState([])
  const [status, setStatus] = useState(null)
  const [activeExample, setActiveExample] = useState('gr-basic')
  const [rightTab, setRightTab] = useState('console')
  const [dbVersion, setDbVersion] = useState(0)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [editorExpanded, setEditorExpanded] = useState(false)
  const [running, setRunning] = useState(false)
  const [session, setSession] = useState({ loading: true, authenticated: false, user: null, provider: 'none' })
  const [authOpen, setAuthOpen] = useState(false)
  const [playgrounds, setPlaygrounds] = useState([])
  const [pgBusy, setPgBusy] = useState(false)
  const codeRef = useRef(code)
  const clientWorkspaceRef = useRef(null)
  codeRef.current = page === 'custom' && mode === 'server' ? customCode : code

  useEffect(() => {
    let alive = true

    async function loadSession() {
      // Plain Vite dev does not serve the Pages Functions, so /api/session is
      // only available in production or via `npm run dev:full`.
      try {
        const response = await fetch('/api/session', { headers: { accept: 'application/json' } })
        const type = response.headers.get('content-type') || ''
        if (!type.includes('application/json')) throw new Error('No Cloudflare session endpoint')
        const cloudSession = await response.json()
        if (alive) setSession({ ...cloudSession, loading: false })
      } catch {
        if (alive) setSession({ loading: false, authenticated: false, user: null, provider: 'none' })
      }
    }

    loadSession()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    setRightTab((tab) => (mode === 'server' ? (tab === 'preview' ? 'console' : tab) : tab === 'console' ? 'preview' : tab))
    // Output is mode-specific; don't carry one mode's results into another.
    setEntries([])
    setStatus(null)
  }, [mode])

  const run = useCallback(() => {
    setRunning(true)
    requestAnimationFrame(() => {
      if (mode !== 'server') {
        clientWorkspaceRef.current?.run()
        setRightTab('preview')
        setRightPanelOpen(true)
        setRunning(false)
        return
      }

      const result = runScript(codeRef.current)
      setEntries(result.output)
      setDbVersion((v) => v + 1)
      const errs = result.output.filter((e) => e.level === 'error').length
      setStatus({
        ok: !result.error && errs === 0,
        text: result.error
          ? `Failed - ${result.error.name}`
          : `Ran in ${result.durationMs.toFixed(1)}ms - ${result.output.length} line${result.output.length === 1 ? '' : 's'}${
              errs ? ` - ${errs} error${errs === 1 ? '' : 's'}` : ''
            }`,
      })
      setRightTab('console')
      setRightPanelOpen(true)
      setRunning(false)
    })
  }, [mode])

  const handleCodeChange = useCallback((v) => {
    if (page === 'custom' && mode === 'server') {
      setCustomCode(v)
      localStorage.setItem(CUSTOM_STORAGE_KEY, v)
    } else if (mode === 'server') {
      setCode(v)
      localStorage.setItem(STORAGE_KEY, v)
    } else if (mode === 'client') {
      setClientCode(v)
      localStorage.setItem(CLIENT_STORAGE_KEY, v)
    } else {
      setProducerCode(v)
      localStorage.setItem(PRODUCER_STORAGE_KEY, v)
    }
  }, [mode, page])

  function pickExample(item) {
    setPage('lessons')
    setMode('server')
    setCode(item.code)
    localStorage.setItem(STORAGE_KEY, item.code)
    setActiveExample(item.id)
  }

  function clearConsole() {
    setEntries([])
    setStatus(null)
  }

  function reseed() {
    resetDatabase()
    setDbVersion((v) => v + 1)
    setStatus({ ok: true, text: 'Database reseeded to defaults' })
  }

  function signIn() {
    setAuthOpen(true)
  }

  function onAuthed(data) {
    setSession({ ...data, loading: false })
    setAuthOpen(false)
  }

  async function signOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore network errors; clear the UI either way
    }
    setSession({ loading: false, authenticated: false, user: null, provider: 'none' })
    setPlaygrounds([])
  }

  // Load the signed-in user's saved scripts whenever they become authenticated.
  useEffect(() => {
    if (!session.authenticated) {
      setPlaygrounds([])
      return
    }
    let alive = true
    fetch('/api/playgrounds', { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : { snapshots: [] }))
      .then((d) => {
        if (alive) setPlaygrounds(d.snapshots || [])
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [session.authenticated])

  async function refreshPlaygrounds() {
    try {
      const r = await fetch('/api/playgrounds', { headers: { accept: 'application/json' } })
      if (r.ok) {
        const d = await r.json()
        setPlaygrounds(d.snapshots || [])
      }
    } catch {
      // ignore
    }
  }

  async function savePlayground(name) {
    setPgBusy(true)
    try {
      const res = await fetch('/api/playgrounds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, data: { page, mode, code, customCode, clientCode, producerCode, activeExample } }),
      })
      if (res.ok) {
        await refreshPlaygrounds()
        setStatus({ ok: true, text: `Saved "${name}" to your account` })
      } else {
        const d = await res.json().catch(() => ({}))
        setStatus({ ok: false, text: d.error || 'Could not save' })
      }
    } catch {
      setStatus({ ok: false, text: 'Could not save (are you online?)' })
    } finally {
      setPgBusy(false)
    }
  }

  function loadPlayground(snap) {
    const d = snap.data || {}
    if (typeof d.code === 'string') {
      setCode(d.code)
      localStorage.setItem(STORAGE_KEY, d.code)
    }
    if (typeof d.clientCode === 'string') {
      setClientCode(d.clientCode)
      localStorage.setItem(CLIENT_STORAGE_KEY, d.clientCode)
    }
    if (typeof d.producerCode === 'string') {
      setProducerCode(d.producerCode)
      localStorage.setItem(PRODUCER_STORAGE_KEY, d.producerCode)
    }
    if (d.activeExample) setActiveExample(d.activeExample)
    if (typeof d.customCode === 'string') {
      setCustomCode(d.customCode)
      localStorage.setItem(CUSTOM_STORAGE_KEY, d.customCode)
    }
    if (d.page) setPage(d.page)
    if (d.mode) setMode(d.mode)
    setStatus({ ok: true, text: `Loaded "${snap.name}"` })
  }

  async function deletePlayground(snap) {
    setPlaygrounds((list) => list.filter((p) => p.id !== snap.id))
    try {
      const res = await fetch(`/api/playgrounds?id=${encodeURIComponent(snap.id)}`, { method: 'DELETE' })
      if (!res.ok) await refreshPlaygrounds()
    } catch {
      refreshPlaygrounds()
    }
  }

  const db = getDatabase()
  const totalExamples = ALL_EXAMPLES.length
  const activeExampleItem = ALL_EXAMPLES.find((item) => item.id === activeExample)
  const editorValue = mode === 'server' ? (page === 'custom' ? customCode : code) : mode === 'client' ? clientCode : producerCode
  const editorTitle =
    mode === 'server'
      ? page === 'custom'
        ? 'Custom scratchpad'
        : activeExampleItem?.title || 'Lesson script'
      : mode === 'client'
        ? 'Client script'
        : 'Record producer'
  const fileName = mode === 'server' ? (page === 'custom' ? 'custom.js' : 'script.js') : mode === 'client' ? 'client_script.js' : 'record_producer.js'
  const previewLabel = mode === 'server' ? 'Console' : mode === 'client' ? 'Form' : 'Producer'
  const userEmail = session.user?.email || 'Account'
  const userInitial = userEmail.trim().charAt(0).toUpperCase() || 'U'
  const showRightPanel = rightPanelOpen && !editorExpanded
  const workbenchClass = `workbench-grid flex-1 min-h-0 ${
    editorExpanded ? 'workbench-grid-editor-expanded' : rightPanelOpen ? '' : 'workbench-grid-panel-closed'
  }`

  return (
    <div className="flex min-h-screen flex-col bg-stone-100 text-slate-950 md:h-screen md:overflow-hidden">
      <header className="shrink-0 border-b border-now-700 bg-gradient-to-r from-now-900 via-now-800 to-now-900 text-white shadow-glow">
        <div className="flex min-h-16 flex-col gap-3 px-4 py-3 md:flex-row md:flex-wrap md:items-center xl:h-16 xl:flex-nowrap xl:px-5 xl:py-0">
          <div className="flex min-w-0 shrink-0 items-center gap-3 md:w-[284px] 2xl:w-[340px]">
            <LogoMark />
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold tracking-normal text-white">
                GlideScript <span className="text-cyan-300">Playground</span>
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-300/80">
                <span className="hidden 2xl:inline">{totalExamples} examples</span>
                <span className="hidden h-1 w-1 rounded-full bg-white/25 2xl:inline-block" />
                <span className="hidden 2xl:inline">{db.tableNames().length} mock tables</span>
                <span className="hidden h-1 w-1 rounded-full bg-white/25 2xl:inline-block" />
                <AnimatePresence mode="wait">
                  <motion.span
                    key={status?.text || 'Ready'}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16 }}
                    className={status?.ok === false ? 'text-red-300' : status?.ok ? 'text-cyan-300' : 'text-slate-300/80'}
                  >
                    {status?.text || 'Ready'}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 md:w-72 lg:hidden">
            <span className="text-xs font-medium text-slate-300">Example</span>
            <select
              value={activeExample}
              onChange={(event) => {
                const item = ALL_EXAMPLES.find((candidate) => candidate.id === event.target.value)
                if (item) pickExample(item)
              }}
              className="min-w-0 flex-1 rounded-md border border-white/15 bg-white/10 px-2.5 py-2 text-sm text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
            >
              {EXAMPLES.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <LayoutGroup>
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/15 bg-white/5 p-1 lg:ml-1 xl:shrink-0 xl:flex-nowrap 2xl:ml-2">
              <ModeBtn layoutId="active-page" active={page === 'lessons'} onClick={() => setPage('lessons')} icon={BookOpen} label="Lessons" />
              <ModeBtn
                layoutId="active-page"
                active={page === 'custom'}
                onClick={() => {
                  setPage('custom')
                  setMode('server')
                  setEntries([])
                  setStatus(null)
                }}
                icon={FileCode2}
                label="Custom"
              />
            </div>
          </LayoutGroup>

          <LayoutGroup>
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/15 bg-white/5 p-1 lg:ml-1 xl:shrink-0 xl:flex-nowrap 2xl:ml-2">
              <ModeBtn layoutId="active-mode" active={mode === 'server'} onClick={() => setMode('server')} icon={Server} label="Server" />
              <ModeBtn layoutId="active-mode" active={mode === 'client'} onClick={() => setMode('client')} icon={Monitor} label="Client" />
              <ModeBtn layoutId="active-mode" active={mode === 'producer'} onClick={() => setMode('producer')} icon={FilePlus2} label="Producer" />
            </div>
          </LayoutGroup>

          <div className="flex min-w-0 flex-wrap items-center gap-1.5 lg:ml-auto xl:shrink-0 xl:flex-nowrap">
            {session.authenticated && (
              <PlaygroundsBar
                playgrounds={playgrounds}
                onSave={savePlayground}
                onLoad={loadPlayground}
                onDelete={deletePlayground}
                busy={pgBusy}
              />
            )}
            {session.authenticated ? (
              <motion.button
                onClick={signOut}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                title={`Signed in as ${userEmail}. Sign out`}
                className="inline-flex h-9 min-w-0 shrink-0 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-cyan-300/15 font-mono text-[11px] font-bold text-cyan-200 ring-1 ring-cyan-300/25">
                  {userInitial}
                </span>
                <LogOut className="h-4 w-4 shrink-0" />
              </motion.button>
            ) : (
              <motion.button
                onClick={signIn}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </motion.button>
            )}
            <motion.button
              onClick={clearConsole}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              title="Clear console"
              aria-label="Clear console"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white 2xl:px-3"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden 2xl:inline">Clear</span>
            </motion.button>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={run}
              disabled={running}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-gradient-to-br from-cyan-400 to-cyan-600 px-4 text-sm font-semibold text-now-900 shadow-[0_4px_14px_-4px_rgba(30,180,90,0.7)] transition-all hover:brightness-110 disabled:cursor-wait disabled:opacity-65"
            >
              <Play className="h-4 w-4 fill-current" />
              Run
            </motion.button>
          </div>
        </div>
      </header>

      <div className={workbenchClass}>
        {!editorExpanded && (
          <motion.aside
            className="hidden min-h-0 border-r border-slate-300/80 bg-stone-50 lg:flex lg:flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {page === 'lessons' ? <ExampleSidebar onPick={pickExample} activeId={activeExample} /> : <CustomSidebar />}
          </motion.aside>
        )}

        <motion.main
          className={`flex ${editorExpanded ? 'h-[calc(100vh-4rem)]' : 'h-[560px]'} min-w-0 flex-col border-r border-slate-300/80 bg-[#0f1720] md:h-auto md:min-h-0`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <div className="flex h-11 shrink-0 items-center gap-3 border-b border-slate-800 bg-[#111923] px-4">
            <div className="min-w-0">
              <div className="font-mono text-xs font-medium text-slate-200">{fileName}</div>
              <div className="hidden truncate text-[11px] text-slate-500 sm:block">{editorTitle}</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {!showRightPanel && !editorExpanded && (
                <IconButton title="Open output panel" onClick={() => setRightPanelOpen(true)} icon={PanelRight} />
              )}
              <IconButton
                title={editorExpanded ? 'Restore editor layout' : 'Expand editor'}
                onClick={() => setEditorExpanded((value) => !value)}
                icon={editorExpanded ? Minimize2 : Maximize2}
              />
              <span className="rounded border border-slate-700 px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-slate-400">
                {mode === 'server' ? 'GlideScript' : mode === 'client' ? 'g_form' : 'Producer'}
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <CodeEditor value={editorValue} onChange={handleCodeChange} onRun={run} />
          </div>
        </motion.main>

        {showRightPanel && (
          <motion.section
            className="flex h-[440px] min-w-0 flex-col bg-white md:h-auto md:min-h-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
          <div className="flex h-11 shrink-0 items-center border-b border-slate-300/80 bg-stone-50 px-2">
            <TabBtn active={rightTab === 'console' || rightTab === 'preview'} onClick={() => setRightTab(mode === 'server' ? 'console' : 'preview')} icon={PanelRight} label={previewLabel} count={entries.length} />
            <TabBtn active={rightTab === 'database'} onClick={() => setRightTab('database')} icon={DbIcon} label="Database" />
            <button
              type="button"
              onClick={() => setRightPanelOpen(false)}
              title="Close output panel"
              aria-label="Close output panel"
              className="ml-auto grid h-8 w-8 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${rightTab}-${mode}`}
                className="h-full"
                initial={{ opacity: 0, y: 8, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.995 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {rightTab === 'database' ? (
                  <TableViewer db={db} onReset={reseed} onChange={() => setDbVersion((v) => v + 1)} />
                ) : mode === 'server' ? (
                  <Console entries={entries} status={status} />
                ) : (
                  <ClientWorkspace
                    ref={clientWorkspaceRef}
                    mode={mode}
                    db={db}
                    code={editorValue}
                    entries={entries}
                    onOutput={setEntries}
                    onStatus={setStatus}
                    onDbChange={() => setDbVersion((v) => v + 1)}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          </motion.section>
        )}
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthed={onAuthed} />
    </div>
  )
}

function CustomSidebar() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-300/80 px-4">
        <FileCode2 className="h-4 w-4 text-now-600" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">Custom workspace</span>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="font-mono text-xs font-semibold uppercase tracking-wide text-now-700">custom.js</div>
          <h2 className="mt-2 text-sm font-semibold text-slate-950">Write your own script</h2>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            This page is separate from the lessons. Your scratch code is saved locally and will not be replaced when you browse examples.
          </p>
        </motion.div>
      </div>
    </div>
  )
}

function ModeBtn({ active, onClick, icon: Icon, label, layoutId }) {
  return (
    <motion.button
      onClick={onClick}
      title={label}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      className={`relative inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-semibold transition-colors ${
        active ? 'text-now-900' : 'text-slate-300 hover:text-white'
      }`}
    >
      {active && <motion.span layoutId={layoutId} className="absolute inset-0 rounded bg-gradient-to-br from-cyan-300 to-cyan-500" transition={{ type: 'spring', stiffness: 520, damping: 34 }} />}
      <Icon className="relative h-3.5 w-3.5" />
      <span className={`relative ${active ? '' : 'hidden 2xl:inline'}`}>{label}</span>
    </motion.button>
  )
}

function IconButton({ title, onClick, icon: Icon }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      title={title}
      aria-label={title}
      className="grid h-7 w-7 place-items-center rounded border border-slate-700 text-slate-400 transition-colors hover:border-slate-500 hover:bg-slate-800 hover:text-slate-100"
    >
      <Icon className="h-3.5 w-3.5" />
    </motion.button>
  )
}

function TabBtn({ active, onClick, icon: Icon, label, count }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className={`relative flex h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold transition-colors ${
        active ? 'text-slate-950' : 'text-slate-500 hover:text-slate-900'
      }`}
    >
      {active && <motion.span layoutId="active-tab" className="absolute inset-0 rounded-md bg-white shadow-sm ring-1 ring-slate-300" transition={{ type: 'spring', stiffness: 520, damping: 34 }} />}
      <Icon className="relative h-3.5 w-3.5" />
      <span className="relative">{label}</span>
      {count != null && count > 0 && (
        <span className="relative rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 ring-1 ring-slate-200">{count}</span>
      )}
    </motion.button>
  )
}
