import React, { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useMarketDataStore } from '../../store/useMarketDataStore'
import { useIsDesktop } from '../../hooks/useMediaQuery'

/** Compact key-status pill, rendered by SettingsSheet in the card header. */
export const MarketDataStatusBadge: React.FC = () => {
  const apiKey = useMarketDataStore((s) => s.apiKey)
  return apiKey ? (
    <span className="text-meta px-2 py-0.5 rounded-full bg-accent/15 text-accent whitespace-nowrap">
      Key Active …{apiKey.slice(-3)}
    </span>
  ) : (
    <span className="text-meta px-2 py-0.5 rounded-full bg-bg-primary/50 text-text-secondary whitespace-nowrap">
      No Key
    </span>
  )
}

/** Alpha Vantage key management, rendered inside the Settings sheet. */
export const MarketDataSection: React.FC = () => {
  const { apiKey, setApiKey, clearApiKey } = useMarketDataStore()
  const [input, setInput] = useState('')
  const isDesktop = useIsDesktop()

  const handleSave = () => {
    setApiKey(input)
    setInput('')
  }

  const handleRemove = () => {
    clearApiKey()
    setInput('')
  }

  return (
    <div className={`flex flex-col ${isDesktop ? 'gap-3' : 'gap-0'}`}>
      <div className="flex gap-2">
        <label htmlFor="market-data-api-key" className="sr-only">
          Alpha Vantage API Key
        </label>
        <input
          id="market-data-api-key"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={apiKey ? 'Replace API Key…' : 'Paste API Key…'}
          className="flex-1 min-w-0 px-3 py-2 rounded-md border border-border bg-bg-primary/50 text-text-primary text-sm placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        />
        <button
          onClick={handleSave}
          className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-[var(--color-accent)] text-[var(--color-bg-primary)] hover:opacity-90 transition-opacity"
        >
          Save
        </button>
        {apiKey && (
          <button
            onClick={handleRemove}
            className="px-3 py-1.5 rounded-md text-[13px] border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      <details className="text-[13px] group">
        <summary className="flex items-center gap-1 cursor-pointer text-accent hover:underline list-none [&::-webkit-details-marker]:hidden select-none">
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
          How to Get a Free Key
        </summary>
        <ol className="mt-2 text-text-secondary list-decimal list-inside flex flex-col gap-1.5">
          <li>
            Open the free key page:{' '}
            <a
              href="https://www.alphavantage.co/support/#api-key"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              Get a free API key
            </a>
          </li>
          <li>Enter your name and email, click &quot;GET FREE API KEY&quot; - the key appears instantly on the page.</li>
          <li>Paste it above and hit Save. The free plan allows 25 lookups per day, so prices refresh automatically at most once every 4 hours.</li>
        </ol>
      </details>

      {isDesktop && <p className="text-[12px] text-text-secondary/80">Your key is stored only on this device.</p>}
    </div>
  )
}
