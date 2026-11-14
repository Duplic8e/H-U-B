import React, { Suspense, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { SettingsSheet } from './settings/SettingsSheet'
import { PageTransition } from './ui/PageTransition'
import { UpdateToast } from './ui/UpdateToast'
import { UndoToast } from './ui/UndoToast'
import { CommandPalette } from './CommandPalette'
import { ShortcutsHelp } from './ui/ShortcutsHelp'
import { ErrorBoundary } from './ErrorBoundary'
import { TopBarSlotContext } from './topBarSlot'
import { LayoutDashboard, Wallet, TrendingUp, Briefcase, Calculator, Settings, Search, LayoutGrid } from 'lucide-react'
import { LedgerMark } from './ui/LedgerMark'
import { shouldShowWhatsNew, LAST_SEEN_VERSION_KEY } from '../utils/whatsNew'
import { useSWUpdate } from '../hooks/useSWUpdate'
import { DisclaimerModal } from './ui/DisclaimerModal'
import { DISCLAIMER_ACK_KEY } from '../utils/disclaimer'
import { isDemoActive, subscribeDemoActive } from '../utils/demoData'
import { isAutoSyncEnabled, autoSyncAction } from '../utils/autoSync'
import { previewPush, previewPull, performPush, performPull } from '../utils/syncService'
import { getCachedToken } from '../utils/driveAuth'
import { useSyncStore } from '../store/useSyncStore'
import { useViewportHeight } from '../hooks/useViewportHeight'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useHubAutoSync } from '../hooks/useHubSync'
import { HUB_URL } from '../utils/hubSync'

// CHANGELOG.md is imported raw by the modal, so the modal is split out of the entry chunk.
const WhatsNewModal = React.lazy(() => import('./ui/WhatsNewModal').then((m) => ({ default: m.WhatsNewModal })))


export const Layout: React.FC = () => {
  const location = useLocation()
  const demoActive = useSyncExternalStore(subscribeDemoActive, isDemoActive, () => false)
  const swUpdate = useSWUpdate()
  useViewportHeight()
  const routeName = useDocumentTitle()
  useHubAutoSync()

  // <main> is the scroll container, not the document, so the browser has no
  // reason to reset it between routes: switching from a long page used to
  // land the next page partway down. A layout effect, so the old offset is
  // never painted. Keyed on pathname only: a ?tab= switch inside a page
  // keeps the user where they are.
  const mainRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [location.pathname])

  // PageHeader portals the page title and main action into this element on
  // a phone. State, not a ref, so pages re-render once it exists.
  const [topBarSlot, setTopBarSlot] = useState<HTMLElement | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  // Captured once at mount: the last-seen-version effect below overwrites the key.
  const [shouldShowNews] = useState(() =>
    shouldShowWhatsNew(localStorage.getItem(LAST_SEEN_VERSION_KEY), __APP_VERSION__)
  )
  const [disclaimerAcked, setDisclaimerAcked] = useState(() => localStorage.getItem(DISCLAIMER_ACK_KEY) !== null)
  const [disclaimerOpen, setDisclaimerOpen] = useState(!disclaimerAcked)
  // What's New waits until the disclaimer has been acknowledged.
  const [whatsNewOpen, setWhatsNewOpen] = useState(shouldShowNews && disclaimerAcked)
  // Mounted from the first time it opens and then kept, so the sheet still animates closed.
  const [whatsNewMounted, setWhatsNewMounted] = useState(whatsNewOpen)
  if (whatsNewOpen && !whatsNewMounted) setWhatsNewMounted(true)

  const closeDisclaimer = () => {
    setDisclaimerOpen(false)
    if (!disclaimerAcked) {
      localStorage.setItem(DISCLAIMER_ACK_KEY, new Date().toISOString())
      setDisclaimerAcked(true)
      if (shouldShowNews) setWhatsNewOpen(true)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }
      // Do not hijack "?" while the user is typing into a field.
      const el = e.target as HTMLElement | null
      const typing =
        !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (e.key === '?' && !typing) {
        e.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, __APP_VERSION__)
  }, [])

  // Automatic Drive sync: only runs when the user opted in, only acts on
  // unambiguous decisions, and only uses a token already cached from an
  // earlier manual connect. It never prompts for consent itself, so it never
  // pops a sign-in window without a click. The ref guard means a rapid tab
  // switch (several visibilitychange events in a row) cannot start a second
  // sync while one is still in flight. Errors are swallowed: a failed
  // background attempt just leaves the sync chip stale, which is already the
  // honest signal, rather than surfacing a toast on every transient failure.
  const autoSyncInFlight = useRef(false)
  useEffect(() => {
    const runAutoSync = async () => {
      if (autoSyncInFlight.current) return
      if (!isAutoSyncEnabled()) return
      const { clientId, folderId } = useSyncStore.getState()
      if (!clientId) return
      const cachedToken = getCachedToken()
      if (!cachedToken) return

      autoSyncInFlight.current = true
      try {
        const [push, pull] = await Promise.all([previewPush(cachedToken), previewPull(cachedToken)])
        const action = autoSyncAction({ enabled: true, connected: true, push, pull })
        if (action === 'pull' && pull.kind === 'clean') {
          await performPull(cachedToken, pull.remote)
        } else if (action === 'push' && push.kind === 'clean') {
          const currentFolderId = folderId ?? useSyncStore.getState().folderId
          if (!currentFolderId) return
          await performPush(cachedToken, currentFolderId, push.nextRevision, push.baseRevision)
        }
        useSyncStore.getState().clearAutoFailures()
      } catch (err) {
        console.error('Automatic Drive sync failed:', err)
        useSyncStore.getState().recordAutoFailure()
      } finally {
        autoSyncInFlight.current = false
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      void runAutoSync()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Budgeting', path: '/budget', icon: Wallet },
    { name: 'Investments', path: '/investments', icon: TrendingUp },
    { name: 'Planner', path: '/planner', icon: Calculator },
    // "Compensation" is the full name everywhere except the mobile tab bar:
    // at 320px five equal-width tabs give it 64px, and even with ellipsis
    // that clipped the word. shortName keeps the tab bar readable without
    // shortening the desktop sidebar label or the route name.
    { name: 'Compensation', shortName: 'Comp', path: '/compensation', icon: Briefcase },
  ]

  return (
    <div className="flex h-dvh bg-transparent text-text-primary overflow-hidden relative">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-bg-secondary focus:px-4 focus:py-2 focus:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
      >
        Skip to content
      </a>

      {/* Sidebar Navigation */}
      {/* overflow-x-hidden is not redundant next to overflow-y-auto. CSS
          computes a `visible` overflow on one axis to `auto` when the other
          axis is not visible, so overflow-y-auto alone silently made this a
          horizontal scroll container too. On a display at fractional device
          pixel ratio (1.5, i.e. 150% scaling) the 1px border-r rasterises to
          0.667px, clientWidth lands on 255.33 while scrollWidth rounds to
          256, and that sub-pixel phantom overflow was enough to paint an 8px
          horizontal scrollbar across the bottom of the sidebar. There is no
          horizontally scrollable content here and there should never be. */}
      <nav className="hidden desktop:flex w-64 shrink-0 relative border-r border-transparent bg-bg-secondary/70 backdrop-blur-[var(--card-blur)] flex-col justify-between overflow-y-auto overflow-x-hidden transition-all duration-300 z-10">
        {/* The divider fades in from the top rather than starting at a hard
            edge with nothing meeting it. Its lower end is already anchored by
            the settings dock's border-t. Absolutely positioned, so it stays
            out of the flex flow; the transparent border-r above preserves the
            1px the solid border used to occupy. */}
        <div
          aria-hidden="true"
          data-testid="sidebar-divider"
          className="pointer-events-none absolute inset-y-0 -right-px w-px"
          style={{ background: 'linear-gradient(to bottom, transparent 0px, var(--border-color) 150px)' }}
        />
        <div>
          <div className="p-6 pb-3 flex items-center gap-2.5">
            <LedgerMark size={26} className="text-accent shrink-0" />
            <span className="text-2xl font-bold tracking-tighter text-accent font-display">Ledger</span>
            {HUB_URL && (
              <a
                href={HUB_URL}
                aria-label="Back to Hub"
                title="Back to Hub"
                className="ml-auto flex items-center justify-center w-8 h-8 rounded-md text-text-secondary hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              >
                <LayoutGrid className="w-4 h-4" />
              </a>
            )}
          </div>

          <div className="px-4">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border control-border text-sm text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              <Search className="w-4 h-4" /> Search
              {/* Not text-text-secondary/80: at 80% over the search field this composited
                  to #6d7581 in the geometric theme, 4.35:1 against a 4.5 requirement.
                  Full strength is 7.06:1 and reads no louder at this size. */}
              <kbd className="ml-auto text-micro px-1.5 py-0.5 rounded border border-border text-text-secondary">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
            </button>
          </div>

          <div className="px-4 space-y-2 mt-4">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center px-4 py-3 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                    isActive
                      ? 'bg-accent/10 text-accent font-semibold border-l-2 border-accent rounded-l-none'
                      : 'text-text-secondary hover:bg-bg-primary/50 hover:text-text-primary'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Settings Dock */}
        {/* The scrim and blur are theme tokens rather than fixed utilities.
            This used to be a flat bg-bg-primary/20, which is nearly
            transparent, and that was fine while nothing was drawn behind it.
            Gilded Bloom draws a floral up the sidebar, and at 20% the stems
            ran straight under "Settings" and the version number. Every theme
            but Gilded Bloom sets --dock-bg to exactly its own bg-primary at
            20% and --dock-blur to none, so all five render as they always
            did. Gilded Bloom raises the scrim and frosts it, so the artwork
            reads as passing behind a solid footer instead of through it. */}
        <div
          className="p-4 border-t border-border flex items-center justify-between"
          style={{
            backgroundColor: 'var(--dock-bg)',
            backdropFilter: 'var(--dock-blur)',
            WebkitBackdropFilter: 'var(--dock-blur)',
          }}
        >
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-primary/50 transition-colors"
          >
            <Settings className="w-4 h-4" /> Settings
          </button>
          <button
            onClick={() => setWhatsNewOpen(true)}
            title="What's New"
            aria-label={`Version ${__APP_VERSION__}. Open What's New`}
            className="text-meta text-text-secondary hover:text-accent transition-colors pr-2"
          >
            v{__APP_VERSION__}
          </button>
        </div>
      </nav>

      {/* Main Content Area. Wrapped in a column so the demo banner sits in
          normal document flow above <main> rather than floating fixed over
          it, which used to cover the sidebar brand area and page content. */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative z-10">
        {/* Mobile top bar. The sidebar's brand, search and settings have no
            home on a phone: the command palette had no touch entry point at
            all, and settings was crowding the tab bar into six slots that
            truncated "Compensation". Both live here now, and the bar below
            keeps five roomy tabs. */}
        <header
          data-testid="mobile-topbar"
          className="desktop:hidden shrink-0 flex items-center gap-2 pl-4 pr-2 min-h-[52px] bg-bg-primary"
          // iOS large-title bar: sits below the status bar and Dynamic Island.
          style={{ paddingTop: 'var(--safe-top)', boxSizing: 'content-box' }}
        >
          {/* Hidden by the rule in src/index.css while a page fills the slot:
              the page title takes the brand's place, and at 320px the mark,
              a title like "Compensation" and three 44px buttons do not fit
              on one line together. */}
          <span data-topbar-brand className="flex items-center gap-2 shrink-0">
            <LedgerMark size={24} className="text-accent shrink-0" />
            <span className="text-[28px] font-bold tracking-tight text-text-primary font-display">Ledger</span>
          </span>
          <div ref={setTopBarSlot} data-topbar-slot className="flex-1 min-w-0 flex items-center gap-2" />
          {HUB_URL && (
            <a
              href={HUB_URL}
              aria-label="Back to Hub"
              className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-accent transition-opacity active:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              <LayoutGrid className="w-[22px] h-[22px]" />
            </a>
          )}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            className={`${HUB_URL ? '-ml-2 ' : ''}flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-accent transition-opacity active:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent`}
          >
            <Search className="w-[22px] h-[22px]" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="-ml-2 flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-accent transition-opacity active:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            <Settings className="w-[22px] h-[22px]" />
          </button>
        </header>

        {demoActive && (
          <div
            role="status"
            className="shrink-0 bg-accent/15 border-b border-accent/40 px-4 py-1.5 text-center text-[12px] text-text-primary"
          >
            Demo data is loaded. It is excluded from backups and Drive sync.
          </div>
        )}

        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="phone-no-scrollbar flex-1 min-w-0 overflow-auto overscroll-contain overflow-x-hidden px-4 pt-4 sm:px-8 sm:pt-8 pb-[calc(50px+var(--safe-bottom)+20px)] desktop:pb-8"
        >
          {/* Polite, not assertive: a route change should be announced after
              whatever the user was already hearing, not interrupt it. */}
          <p aria-live="polite" className="sr-only">{routeName}</p>
          <TopBarSlotContext.Provider value={topBarSlot}>
          <ErrorBoundary key={location.pathname}>
            <Suspense
              fallback={
                <div
                  role="status"
                  aria-label="Loading page"
                  className="flex items-center justify-center py-24 text-[13px] text-text-secondary"
                >
                  Loading...
                </div>
              }
            >
              <PageTransition>
                <Outlet />
              </PageTransition>
            </Suspense>
          </ErrorBoundary>
          </TopBarSlotContext.Provider>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="desktop:hidden fixed bottom-0 inset-x-0 z-20 flex border-t-[0.5px] border-border"
        // The iOS tab bar: translucent material over the content scrolling beneath it,
        // with the home indicator's inset below the items.
        style={{ backgroundColor: 'var(--bar-bg)', backdropFilter: 'var(--bar-blur)', WebkitBackdropFilter: 'var(--bar-blur)', paddingBottom: 'var(--safe-bottom)' }}
        aria-label="Primary"
      >
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 min-w-0 flex flex-col items-center justify-start pt-1.5 gap-[3px] min-h-[50px] text-micro font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent ${
                isActive ? 'text-accent' : 'text-text-secondary'
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.25 : 1.75} />
              <span className="max-w-full truncate px-0.5 tracking-tight">{item.shortName ?? item.name}</span>
            </Link>
          )
        })}
      </nav>

      <UpdateToast needRefresh={swUpdate.needRefresh} onRefresh={swUpdate.refresh} />
      {whatsNewMounted && (
        <Suspense fallback={null}>
          <WhatsNewModal isOpen={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} onOpenDisclaimer={() => setDisclaimerOpen(true)} swUpdate={swUpdate} />
        </Suspense>
      )}
      <DisclaimerModal isOpen={disclaimerOpen} requireAck={!disclaimerAcked} onClose={closeDisclaimer} />
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenWhatsNew={() => setWhatsNewOpen(true)}
        onOpenDisclaimer={() => setDisclaimerOpen(true)}
      />
      <UndoToast />
    </div>
  )
}
