import { createContext } from 'react'

/** The element in Layout's phone top bar that PageHeader portals a page's
 *  title and main action into. Null outside Layout (page tests render pages
 *  on their own) and for the first render, before Layout's ref attaches. */
export const TopBarSlotContext = createContext<HTMLElement | null>(null)
