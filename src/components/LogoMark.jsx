import { motion } from 'framer-motion'

export default function LogoMark({ className = 'h-10 w-10', textClassName = 'text-[13px]' }) {
  return (
    <motion.div
      className={`relative shrink-0 overflow-hidden rounded-lg bg-now-950 shadow-[0_8px_22px_-10px_rgba(34,211,238,0.85)] ring-1 ring-cyan-300/25 ${className}`}
      whileHover={{ y: -1, rotate: -1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      aria-label="GlideScript Playground"
    >
      <span className="absolute inset-0 bg-gradient-to-br from-cyan-300 via-cyan-400 to-emerald-500" />
      <span className="absolute inset-[5px] grid place-items-center overflow-hidden rounded-md bg-now-950/90">
        <span className={`font-mono font-black leading-none text-cyan-200 ${textClassName}`}>GS</span>
      </span>
      <span className="absolute bottom-1 left-1 right-1 h-[2px] rounded-full bg-cyan-200/70" />
    </motion.div>
  )
}
