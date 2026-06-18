import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, BookOpen } from 'lucide-react'
import { EXAMPLES } from '../data/examples.js'

export default function ExampleSidebar({ onPick, activeId }) {
  const [open, setOpen] = useState(() => EXAMPLES.map((g) => g.group))

  function toggle(group) {
    setOpen((o) => (o.includes(group) ? o.filter((x) => x !== group) : [...o, group]))
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-300/80 px-4">
        <BookOpen className="h-4 w-4 text-cyan-700" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">Examples</span>
      </div>

      <div className="flex-1 overflow-auto py-2">
        {EXAMPLES.map((group) => {
          const isOpen = open.includes(group.group)
          return (
            <motion.section key={group.group} className="mb-1" layout>
              <motion.button
                onClick={() => toggle(group.group)}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.99 }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:text-slate-900"
              >
                <motion.span animate={{ rotate: isOpen ? 0 : -90 }} transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </motion.span>
                <span className="truncate">{group.group}</span>
              </motion.button>

              <AnimatePresence initial={false}>
                {isOpen && (
                <motion.div
                  className="space-y-0.5 overflow-hidden px-2"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  {group.items.map((item) => {
                    const active = activeId === item.id
                    return (
                      <motion.button
                        key={item.id}
                        onClick={() => onPick(item)}
                        layout
                        whileHover={{ x: 3, scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                        className={`relative w-full overflow-hidden rounded-md px-3 py-2 text-left transition-colors ${
                          active ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-300' : 'text-slate-700 hover:bg-white/70'
                        }`}
                      >
                        {active && <motion.span layoutId="active-example-bg" className="absolute inset-0 rounded-md bg-white" transition={{ type: 'spring', stiffness: 520, damping: 34 }} />}
                        <div className="flex items-start gap-2">
                          <motion.span
                            className={`relative mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-cyan-700' : 'bg-slate-300'}`}
                            animate={active ? { scale: [1, 1.45, 1] } : { scale: 1 }}
                            transition={{ duration: 0.35 }}
                          />
                          <span className="relative min-w-0">
                            <span className="block truncate text-[13px] font-medium">{item.title}</span>
                            <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-slate-500">{item.desc}</span>
                          </span>
                        </div>
                      </motion.button>
                    )
                  })}
                </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          )
        })}
      </div>
    </div>
  )
}
