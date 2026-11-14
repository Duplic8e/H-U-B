import React from 'react'

interface TabPanelProps<T extends string> {
  /** Matches the `Tabs` item id: the panel gets id={`panel-${id}`} and is
   *  labelled by the tab with id={`tab-${id}`}, per the WAI-ARIA tabs pattern. */
  id: T
  className?: string
  children: React.ReactNode
}

/** The one place a tab panel is rendered. Every panel needs tabIndex={0} so
 *  a keyboard user tabbing off the tab strip lands somewhere instead of
 *  falling through to whatever comes after the tabs in the DOM, but a panel
 *  must NOT suppress the outline that lands gives it: eight panels across
 *  Budgeting and Investments once carried `focus-visible:outline-none` with
 *  no replacement ring, which used to be harmless (the old universal
 *  :focus-visible rule always won regardless) and became a real WCAG 2.4.7
 *  failure the moment that rule was scoped to read a component's own
 *  suppression. Panels take the plain default outline: no suppression here. */
export function TabPanel<T extends string>({ id, className = '', children }: TabPanelProps<T>) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0} className={className}>
      {children}
    </div>
  )
}
