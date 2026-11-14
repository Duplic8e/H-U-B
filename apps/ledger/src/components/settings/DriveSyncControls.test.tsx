import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DriveSyncControls } from './DriveSyncControls'
import { useSyncStore } from '../../store/useSyncStore'

vi.mock('../../utils/driveAuth', () => ({
  requestAccessToken: vi.fn(() => Promise.resolve('tok')),
  getCachedToken: vi.fn(() => 'tok'),
  clearCachedToken: vi.fn(),
  DRIVE_SCOPE: 'https://www.googleapis.com/auth/drive.file',
}))

vi.mock('../../utils/syncService', () => ({
  previewPush: vi.fn(),
  previewPull: vi.fn(),
  performPush: vi.fn(() => Promise.resolve()),
  performPull: vi.fn(() => Promise.resolve()),
}))

const service = await import('../../utils/syncService')
const auth = await import('../../utils/driveAuth')

const remote = {
  fileId: 'f5', name: 'r5.json', createdTime: '2026-08-12T10:00:00.000Z',
  revision: 5, deviceId: 'dev-b', deviceName: 'Phone',
}

describe('DriveSyncControls', () => {
  beforeEach(() => {
    vi.mocked(service.previewPush).mockReset()
    vi.mocked(service.previewPull).mockReset()
    vi.mocked(service.performPush).mockReset().mockResolvedValue(undefined as never)
    vi.mocked(service.performPull).mockReset().mockResolvedValue(undefined)
    vi.mocked(auth.clearCachedToken).mockReset()
    useSyncStore.setState({
      clientId: 'client-1',
      folderId: 'folder-1',
      lastSyncedRevision: 3,
      lastSyncedHash: 'h',
      consecutiveAutoFailures: 0,
    })
    vi.stubGlobal('location', { ...window.location, reload: vi.fn() })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks for a client id when none is configured', () => {
    useSyncStore.setState({ clientId: undefined })
    render(<DriveSyncControls />)
    expect(screen.getByLabelText(/google client id/i)).toBeInTheDocument()
  })

  it('shows push and pull once a client id is configured', () => {
    render(<DriveSyncControls />)
    expect(screen.getByRole('button', { name: /push to drive/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pull from drive/i })).toBeInTheDocument()
  })

  it('lets the user rename this device so conflict warnings are recognisable', () => {
    render(<DriveSyncControls />)
    const input = screen.getByLabelText(/this device/i)
    fireEvent.change(input, { target: { value: 'Work laptop' } })
    fireEvent.blur(input)
    expect(useSyncStore.getState().deviceName).toBe('Work laptop')
  })

  it('pushes without a dialog when there is no divergence', async () => {
    vi.mocked(service.previewPush).mockResolvedValue({ kind: 'clean', nextRevision: 4, baseRevision: 3 })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /push to drive/i }))
    await waitFor(() => expect(service.performPush).toHaveBeenCalledWith('tok', 'folder-1', 4, 3))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('reports when there is nothing to push', async () => {
    vi.mocked(service.previewPush).mockResolvedValue({ kind: 'nothing-to-push' })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /push to drive/i }))
    await waitFor(() => expect(screen.getByText(/already up to date/i)).toBeInTheDocument())
    expect(service.performPush).not.toHaveBeenCalled()
  })

  it('warns before overwriting a newer snapshot from another device', async () => {
    vi.mocked(service.previewPush).mockResolvedValue({ kind: 'diverged', remote, nextRevision: 6, baseRevision: 3 })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /push to drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText(/Phone/)).toBeInTheDocument()
    expect(screen.getByText('Another device has newer data')).toBeInTheDocument()
    expect(service.performPush).not.toHaveBeenCalled()
  })

  it('pushes anyway when the user confirms the overwrite', async () => {
    vi.mocked(service.previewPush).mockResolvedValue({ kind: 'diverged', remote, nextRevision: 6, baseRevision: 3 })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /push to drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /overwrite/i }))
    await waitFor(() => expect(service.performPush).toHaveBeenCalledWith('tok', 'folder-1', 6, 3))
  })

  it('cancels the push when the user backs out', async () => {
    vi.mocked(service.previewPush).mockResolvedValue({ kind: 'diverged', remote, nextRevision: 6, baseRevision: 3 })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /push to drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(service.performPush).not.toHaveBeenCalled()
  })

  it('warns before a pull would discard unpushed local edits', async () => {
    vi.mocked(service.previewPull).mockResolvedValue({ kind: 'would-lose-local', remote })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /pull from drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText(/unpushed changes/i)).toBeInTheDocument()
    expect(screen.getByText('This will discard your local changes')).toBeInTheDocument()
    expect(service.performPull).not.toHaveBeenCalled()
  })

  it('warns when two devices pushed the same revision', async () => {
    vi.mocked(service.previewPull).mockResolvedValue({ kind: 'collision', remote })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /pull from drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText(/at the same time/i)).toBeInTheDocument()
    expect(screen.getByText('Two devices pushed the same revision')).toBeInTheDocument()
    expect(service.performPull).not.toHaveBeenCalled()
  })

  it('surfaces Drive errors', async () => {
    vi.mocked(service.previewPull).mockRejectedValue(new Error('Google Drive access expired. Connect again and retry.'))
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /pull from drive/i }))
    await waitFor(() => expect(screen.getByText(/access expired/i)).toBeInTheDocument())
  })

  it('reconnects and retries once when the token has expired, and succeeds', async () => {
    vi.mocked(service.previewPull)
      .mockRejectedValueOnce(new Error('Google Drive access expired. Connect again and retry.'))
      .mockResolvedValueOnce({ kind: 'up-to-date' })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /pull from drive/i }))
    await waitFor(() => expect(screen.getByText(/already up to date/i)).toBeInTheDocument())
    expect(auth.clearCachedToken).toHaveBeenCalled()
    expect(service.previewPull).toHaveBeenCalledTimes(2)
  })

  it('does not retry a non-expiry error', async () => {
    vi.mocked(service.previewPull).mockRejectedValue(new Error('Network unreachable.'))
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /pull from drive/i }))
    await waitFor(() => expect(screen.getByText(/network unreachable/i)).toBeInTheDocument())
    expect(auth.clearCachedToken).not.toHaveBeenCalled()
    expect(service.previewPull).toHaveBeenCalledTimes(1)
  })

  it('discards local changes and pulls when the user confirms', async () => {
    vi.mocked(service.previewPull).mockResolvedValue({ kind: 'would-lose-local', remote })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /pull from drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /discard local and pull/i }))
    await waitFor(() => expect(service.performPull).toHaveBeenCalledWith('tok', remote))
  })

  it('pulls the chosen snapshot when the user confirms a collision', async () => {
    vi.mocked(service.previewPull).mockResolvedValue({ kind: 'collision', remote })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /pull from drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /pull this one/i }))
    await waitFor(() => expect(service.performPull).toHaveBeenCalledWith('tok', remote))
  })

  it('cancels the pull when the user backs out of a conflict dialog', async () => {
    vi.mocked(service.previewPull).mockResolvedValue({ kind: 'would-lose-local', remote })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /pull from drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(service.performPull).not.toHaveBeenCalled()
  })

  it('tells the user to push from another device first when Drive has no snapshots', async () => {
    vi.mocked(service.previewPull).mockResolvedValue({ kind: 'nothing-remote' })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /pull from drive/i }))
    await waitFor(() => expect(screen.getByText(/push from one device first/i)).toBeInTheDocument())
    expect(service.performPull).not.toHaveBeenCalled()
  })

  it('reports when this device is already up to date', async () => {
    vi.mocked(service.previewPull).mockResolvedValue({ kind: 'up-to-date' })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /pull from drive/i }))
    await waitFor(() => expect(screen.getByText(/already up to date/i)).toBeInTheDocument())
    expect(service.performPull).not.toHaveBeenCalled()
  })

  it('reconnects and retries once when confirming an overwrite push, and succeeds', async () => {
    vi.mocked(service.previewPush).mockResolvedValue({ kind: 'diverged', remote, nextRevision: 6, baseRevision: 3 })
    vi.mocked(service.performPush)
      .mockRejectedValueOnce(new Error('Google Drive access expired. Connect again and retry.'))
      .mockResolvedValueOnce(undefined as never)
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /push to drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /overwrite/i }))
    await waitFor(() => expect(screen.getByText(/overwriting the newer snapshot/i)).toBeInTheDocument())
    expect(auth.clearCachedToken).toHaveBeenCalled()
    expect(service.performPush).toHaveBeenCalledTimes(2)
    expect(service.performPush).toHaveBeenLastCalledWith('tok', 'folder-1', 6, 3)
  })

  it('reconnects and retries once when confirming a pull conflict, and succeeds', async () => {
    vi.mocked(service.previewPull).mockResolvedValue({ kind: 'would-lose-local', remote })
    vi.mocked(service.performPull)
      .mockRejectedValueOnce(new Error('Google Drive access expired. Connect again and retry.'))
      .mockResolvedValueOnce(undefined)
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /pull from drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /discard local and pull/i }))
    await waitFor(() => expect(service.performPull).toHaveBeenCalledTimes(2))
    expect(auth.clearCachedToken).toHaveBeenCalled()
    expect(service.performPull).toHaveBeenLastCalledWith('tok', remote)
  })

  it('does not retry a non-expiry error when confirming an overwrite push', async () => {
    vi.mocked(service.previewPush).mockResolvedValue({ kind: 'diverged', remote, nextRevision: 6, baseRevision: 3 })
    vi.mocked(service.performPush).mockRejectedValue(new Error('Network unreachable.'))
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /push to drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /overwrite/i }))
    await waitFor(() => expect(screen.getByText(/network unreachable/i)).toBeInTheDocument())
    expect(auth.clearCachedToken).not.toHaveBeenCalled()
    expect(service.performPush).toHaveBeenCalledTimes(1)
  })

  it('does not retry a non-expiry error when confirming a pull conflict', async () => {
    vi.mocked(service.previewPull).mockResolvedValue({ kind: 'would-lose-local', remote })
    vi.mocked(service.performPull).mockRejectedValue(new Error('Network unreachable.'))
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /pull from drive/i }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /discard local and pull/i }))
    await waitFor(() => expect(screen.getByText(/network unreachable/i)).toBeInTheDocument())
    expect(auth.clearCachedToken).not.toHaveBeenCalled()
    expect(service.performPull).toHaveBeenCalledTimes(1)
  })

  it('pulls without a dialog when there is no conflict', async () => {
    vi.mocked(service.previewPull).mockResolvedValue({ kind: 'clean', remote })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /pull from drive/i }))
    await waitFor(() => expect(service.performPull).toHaveBeenCalledWith('tok', remote))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows a Disconnect control once a client id is configured', () => {
    render(<DriveSyncControls />)
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
  })

  it('disconnecting clears the cached token and returns to the client id form', async () => {
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }))
    expect(auth.clearCachedToken).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByLabelText(/google client id/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /push to drive/i })).not.toBeInTheDocument()
  })

  it('disconnecting resets the sync bookmark so a fresh Drive is not mistaken for an up-to-date one', async () => {
    useSyncStore.setState({ lastSyncedRevision: 4, lastSyncedHash: 'abc12345' })
    render(<DriveSyncControls />)
    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }))
    await waitFor(() => {
      expect(useSyncStore.getState().lastSyncedRevision).toBe(0)
      expect(useSyncStore.getState().lastSyncedHash).toBe('')
    })
  })

  it('shows a short disconnect explainer instead of a long paragraph', () => {
    render(<DriveSyncControls />)
    expect(screen.getByText('Forgets the Drive link only. Nothing is deleted.')).toBeInTheDocument()
  })

  // The auto sync caveats used to be three sentences inline in the checkbox
  // label, which rendered as a five line paragraph. They moved behind a
  // disclosure. None of them may be quietly dropped in the process: the API
  // key sentence is a privacy disclosure and has to stay reachable.
  it('keeps the auto sync label to one line and the caveats behind a disclosure', () => {
    render(<DriveSyncControls />)

    const label = screen.getByText('Sync automatically when there is nothing to resolve')
    expect(label).toBeInTheDocument()

    const details = screen.getByText('What automatic sync does').closest('details')!
    expect(details.open).toBe(false)

    // Present in the DOM, collapsed rather than removed, so each caveat is
    // still reachable and still findable by a text search of the panel.
    expect(details).toHaveTextContent('Conflicts still wait for you in this panel.')
    expect(details).toHaveTextContent('does not stay primed across a reload')
    expect(details).toHaveTextContent('including any market data API key you have entered')
  })

  it('warns after three consecutive automatic sync failures', () => {
    useSyncStore.setState({ consecutiveAutoFailures: 3 })
    render(<DriveSyncControls />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Automatic sync has failed 3 times in a row.',
    )
  })

  it('names the sync controls in the automatic sync failure warning', () => {
    useSyncStore.setState({ consecutiveAutoFailures: 3 })
    render(<DriveSyncControls />)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Try Push to Drive or Pull from Drive, or reconnect.',
    )
  })

  it('says nothing after one failure', () => {
    useSyncStore.setState({ consecutiveAutoFailures: 1 })
    render(<DriveSyncControls />)
    expect(screen.queryByText(/times in a row/)).not.toBeInTheDocument()
  })

  // clearStorage() only deletes the localStorage entry; it does not touch
  // the already-hydrated in-memory store, so it alone would prove nothing
  // about the fallback. The real exercise of a persisted blob genuinely
  // missing the field, via persist.rehydrate(), lives in
  // useSyncStore.test.ts. This test covers the visible consequence: a
  // fresh install with nothing (or a pre-Task-22 blob) persisted must not
  // show the warning.
  it('an install with no persisted counter starts at zero', () => {
    useSyncStore.setState({ consecutiveAutoFailures: 0 })
    useSyncStore.persist.clearStorage()
    render(<DriveSyncControls />)
    expect(useSyncStore.getState().consecutiveAutoFailures).toBe(0)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

})
