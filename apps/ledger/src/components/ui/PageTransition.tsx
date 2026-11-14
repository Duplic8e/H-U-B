import React from 'react'
import { useLocation } from 'react-router-dom'

/** A fade on route change. Was AnimatePresence + motion.div; the exit half of
 *  that was never visible, because the router unmounts the old route before
 *  the animation could run. A keyed fade-in is what actually shipped.
 *  min-h-full is load-bearing, not decorative: a fixed height here clips
 *  page content that grows past the viewport behind the bottom nav. */
export const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation()
  return (
    <div key={location.pathname} className="min-h-full animate-fade-in">
      {children}
    </div>
  )
}
