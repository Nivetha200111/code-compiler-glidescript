import { motion } from 'framer-motion'

const logoSrc = '/glidescript-logo.png'

export default function LogoMark({ className = 'h-10 w-10' }) {
  return (
    <motion.div
      className={`relative shrink-0 overflow-hidden rounded-lg bg-stone-100 shadow-[0_8px_22px_-10px_rgba(34,211,238,0.85)] ring-1 ring-cyan-300/25 ${className}`}
      whileHover={{ y: -1, rotate: -1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      aria-label="GlideScript Playground"
    >
      <img src={logoSrc} alt="" className="h-full w-full object-cover" draggable="false" />
    </motion.div>
  )
}
