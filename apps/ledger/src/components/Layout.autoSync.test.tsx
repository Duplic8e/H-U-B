import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../hooks/useSWUpdate', () => ({
  useSWUpdate: () => ({
    needRefresh: false,
    refresh: () => {},
    checkStatus: 'idle',
    checkForUpdates: () => {},
  }),
}))

vi.mock('../utils/driveAuth', () => ({
  getCachedToken: vi.fn(() => 'cached-token'),
  clearCachedToken: vi.fn(),
  requestAccessToken: vi.fn(),
}))

const previewPush = vi.fn()
const previewPull = vi.fn()
const performPush = vi.fn()
const performPull = vi.fn()
vi.mock('../utils/syncService', () => ({
  previewPush: (...args: unknown[]) => previewPush(...args),
  previewPull: (...args: unknown[]) => previewPull(...args),
  performPush: (...args: unknown[]) => performPush(...args),
  performPull: (...args: unknown[]) => performPull(...args),
}))

const { Layout } = await import('./Layout')
const { getCachedToken } = await import('../utils/driveAuth')
const { isAutoSyncEnabled, setAutoSyncEnabled } = await import('../utils/autoSync')
const { useSyncStore } = await import('../store/useSyncStore')

function fireVisible() {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('Layout automatic Drive sync', () => {
  beforeEach(() => {
    previewPush.mockReset()
    previewPull.mockReset()
    performPush.mockReset()
    performPull.mockReset()
    vi.mocked(getCachedToken).mockReturnValue('cached-token')
    setAutoSyncEnabled(false)
    useSyncStore.setState({ clientId: 'client-id', folderId: 'folder-id' })
    previewPush.mockResolvedValue({ kind: 'nothing-to-push' })
    previewPull.mockResolvedValue({ kind: 'up-to-date' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('is a no-op when the user has not opted in', async () => {
    expect(isAutoSyncEnabled()).toBe(false)
    render(<MemoryRouter><Layout /></MemoryRouter>)
    await act(async () => {
      fireVisible()
      await Promise.resolve()
    })
    expect(previewPush).not.toHaveBeenCalled()
    expect(previewPull).not.toHaveBeenCalled()
  })

  it('does not run on initial mount, only on a visibilitychange transition', async () => {
    setAutoSyncEnabled(true)
    render(<MemoryRouter><Layout /></MemoryRouter>)
    // Give any stray microtasks a chance to run before asserting nothing fired.
    await act(async () => {
      await Promise.resolve()
    })
    expect(previewPush).not.toHaveBeenCalled()
    expect(previewPull).not.toHaveBeenCalled()

    await act(async () => {
      fireVisible()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(previewPull).toHaveBeenCalledTimes(1)
  })

  it('does not start a second sync while one is still in flight', async () => {
    setAutoSyncEnabled(true)
    let resolvePull: (v: { kind: 'up-to-date' }) => void
    previewPull.mockReturnValue(
      new Promise((resolve) => {
        resolvePull = resolve
      }),
    )
    render(<MemoryRouter><Layout /></MemoryRouter>)

    await act(async () => {
      fireVisible()
      fireVisible()
      await Promise.resolve()
      await Promise.resolve()
    })

    // Only the first visibilitychange should have started a sync; the second,
    // fired while the first is still awaiting previewPull, must be dropped.
    expect(previewPull).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolvePull!({ kind: 'up-to-date' })
      await Promise.resolve()
    })
  })

  it('swallows errors from a failed background sync without throwing', async () => {
    setAutoSyncEnabled(true)
    previewPull.mockRejectedValue(new Error('network down'))
    const { container } = render(<MemoryRouter><Layout /></MemoryRouter>)

    await act(async () => {
      fireVisible()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    // The app is still standing; a background failure does not surface a toast
    // or crash the tree, it just leaves the sync chip stale.
    expect(container.querySelector('main')).not.toBeNull()
    expect(console.error).toHaveBeenCalled()
  })

  it('does not write when the pull decision needs the user to resolve something', async () => {
    setAutoSyncEnabled(true)
    previewPull.mockResolvedValue({
      kind: 'would-lose-local',
      remote: {
        fileId: 'file-1',
        name: 'snapshot.json',
        createdTime: '2026-08-01T00:00:00.000Z',
        revision: 4,
        deviceId: 'device-2',
        deviceName: 'Other device',
      },
    })
    render(<MemoryRouter><Layout /></MemoryRouter>)

    await act(async () => {
      fireVisible()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(performPush).not.toHaveBeenCalled()
    expect(performPull).not.toHaveBeenCalled()
  })

  it('writes exactly once on a genuinely clean pull decision', async () => {
    setAutoSyncEnabled(true)
    const remote = {
      fileId: 'file-1',
      name: 'snapshot.json',
      createdTime: '2026-08-01T00:00:00.000Z',
      revision: 4,
      deviceId: 'device-2',
      deviceName: 'Other device',
    }
    previewPush.mockResolvedValue({ kind: 'nothing-to-push' })
    previewPull.mockResolvedValue({ kind: 'clean', remote })
    performPull.mockResolvedValue(undefined)
    render(<MemoryRouter><Layout /></MemoryRouter>)

    await act(async () => {
      fireVisible()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(performPull).toHaveBeenCalledTimes(1)
    expect(performPull).toHaveBeenCalledWith('cached-token', remote)
    expect(performPush).not.toHaveBeenCalled()
  })
})
