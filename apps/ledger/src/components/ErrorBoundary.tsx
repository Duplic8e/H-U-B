import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** 'page' fills the viewport with a recovery card (the app-level default).
   *  'widget' degrades to a single card's worth of space so one broken widget
   *  leaves the rest of the page usable. */
  variant?: 'page' | 'widget'
  /** Widget title, used in the console message so a report names the culprit. */
  label?: string
}

interface ErrorBoundaryState {
  hasError: boolean
}

// App-level error boundary. Catches render-time throws (e.g. a malformed
// persisted record reaching a component that assumes well-formed data) so a
// single bad page doesn't white-screen the entire SPA. Keyed by the caller
// (Layout uses `key={location.pathname}`) so navigating away from the broken
// page resets this boundary automatically.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error(`ErrorBoundary caught an error${this.props.label ? ` in ${this.props.label}` : ''}:`, error, errorInfo)
  }

  handleTryAgain = () => {
    this.setState({ hasError: false })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError && this.props.variant === 'widget') {
      return (
        <div className="flex flex-col items-start gap-2 py-4">
          <p className="text-[13px] text-text-secondary">
            This widget could not be displayed, most likely from unexpected data.
          </p>
          <button
            type="button"
            onClick={this.handleTryAgain}
            className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            Try again
          </button>
        </div>
      )
    }

    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] p-6">
          <div className="themed-card rounded-lg p-8 max-w-md w-full text-center">
            <h2 className="text-xl font-semibold text-text-primary mb-2">Something went wrong.</h2>
            <p className="text-sm text-text-secondary mb-6">
              This page hit an unexpected error, likely from corrupted or malformed data.
            </p>
            <div className="flex items-center justify-center gap-3 mb-6">
              <button
                type="button"
                onClick={this.handleTryAgain}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border text-text-secondary hover:text-text-primary hover:bg-bg-primary/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              >
                Reload app
              </button>
            </div>
            <p className="text-xs text-text-secondary">
              If the problem persists after reloading, restoring a known-good backup or clearing this site's data will recover the app.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
