import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Loader2, Mail, Lock, User, Zap } from 'lucide-react'

export default function AuthModal({ open, onClose, onAuthed }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function switchMode(next) {
    setMode(next)
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/auth/${mode === 'signup' ? 'signup' : 'login'}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mode === 'signup' ? { email, password, name } : { email, password }),
      })
      const type = res.headers.get('content-type') || ''
      if (!type.includes('application/json')) {
        throw new Error('Accounts only work on the deployed site, not local dev.')
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      onAuthed(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-now-900/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative bg-gradient-to-r from-now-900 via-now-800 to-now-900 px-5 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600">
                  <Zap className="h-4 w-4 text-now-900" strokeWidth={2.6} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
                  <p className="text-[11px] text-slate-300/80">{mode === 'signup' ? 'Save and sync your playgrounds' : 'Sign in to your playgrounds'}</p>
                </div>
              </div>
              <button onClick={onClose} className="absolute right-3 top-3 rounded-md p-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-3 px-5 py-5">
              {mode === 'signup' && (
                <Field icon={User} label="Name" value={name} onChange={setName} type="text" placeholder="Your name" autoComplete="name" />
              )}
              <Field icon={Mail} label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" autoComplete="email" required />
              <Field
                icon={Lock}
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
                placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
              />

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={busy}
                whileTap={{ scale: 0.98 }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-now-900 shadow-[0_4px_14px_-4px_rgba(30,180,90,0.7)] transition-all hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === 'signup' ? 'Create account' : 'Sign in'}
              </motion.button>

              <p className="pt-1 text-center text-xs text-slate-500">
                {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button type="button" onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')} className="font-semibold text-cyan-700 hover:text-cyan-800">
                  {mode === 'signup' ? 'Sign in' : 'Sign up'}
                </button>
              </p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Field({ icon: Icon, label, value, onChange, type, placeholder, autoComplete, required }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition-colors focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15"
        />
      </div>
    </label>
  )
}
