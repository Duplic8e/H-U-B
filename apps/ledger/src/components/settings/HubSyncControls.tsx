import React, { useState } from 'react'
import { Cloud, AlertTriangle } from 'lucide-react'
import { HUB_URL, readHubConfig, runHubSync, type HubResolution } from '../../utils/hubSync'
import { useHubSyncStatus } from '../../hooks/useHubSync'

function whenText(iso?: string): string {
  if (!iso) return 'not yet'
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const BUTTON =
  'flex-1 min-h-[44px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-border text-[13px] text-text-secondary hover:text-accent hover:border-accent transition-colors disabled:opacity-50'

/** Hub cloud backup. Rendered only when this copy of Ledger is served from
 *  the Hub, or the Hub has saved a cloud connection on this origin. */
export const HubSyncControls: React.FC = () => {
  const status = useHubSyncStatus()
  const config = readHubConfig()
  const [busy, setBusy] = useState(false)

  if (!HUB_URL && !config) return null

  if (!config) {
    return (
      <div className="flex flex-col gap-2 w-full pb-3 mb-3 border-b border-border" data-testid="hub-sync">
        <p className="flex items-center gap-1.5 text-[13px] text-text-primary font-medium">
          <Cloud className="w-4 h-4" /> Hub cloud backup is off
        </p>
        <p className="text-[12px] text-text-secondary">
          Connect your private data repo once in the Hub settings, and Ledger backs itself up there automatically.
        </p>
        {HUB_URL && (
          <a href={`${HUB_URL}#settings`} className={BUTTON}>Open Hub settings</a>
        )}
      </div>
    )
  }

  const act = async (resolve?: HubResolution) => {
    setBusy(true)
    try {
      const result = await runHubSync(resolve ? { resolve } : {})
      if (result === 'pulled') window.location.reload()
    } catch {
      // The status line shows the error.
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full pb-3 mb-3 border-b border-border" data-testid="hub-sync">
      <p className="flex items-center gap-1.5 text-[13px] text-text-primary font-medium">
        <Cloud className="w-4 h-4" /> Hub cloud backup
      </p>
      <p className="text-[12px] text-text-secondary" role="status">
        {status.state === 'syncing' && 'Syncing…'}
        {status.state === 'idle' && `Backed up to ${config.owner}/${config.repo}. Last sync: ${whenText(status.lastSyncedAt)}.`}
        {status.state === 'off' && 'Not connected.'}
        {status.state === 'error' && `${status.message} Last good sync: ${whenText(status.lastSyncedAt)}.`}
        {status.state === 'conflict' && `This device and ${status.remoteDevice} both changed since the last sync.`}
      </p>

      {status.state === 'conflict' ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-2">
          <p className="flex items-start gap-1.5 text-[12px] text-text-primary">
            <AlertTriangle className="w-4 h-4 shrink-0 text-accent" />
            Pick the copy to keep. The other one stays in the data repo's history, so nothing is lost for good.
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void act('keep-this-device')} className={BUTTON}>
              Keep this device's
            </button>
            <button type="button" disabled={busy} onClick={() => void act('use-cloud')} className={BUTTON}>
              Use cloud copy ({whenText(status.remoteAt)})
            </button>
          </div>
        </div>
      ) : (
        <button type="button" disabled={busy || status.state === 'syncing'} onClick={() => void act()} className={BUTTON}>
          Sync now
        </button>
      )}
    </div>
  )
}
