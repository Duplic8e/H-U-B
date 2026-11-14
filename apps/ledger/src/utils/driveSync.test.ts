import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  findOrCreateFolder,
  listSnapshots,
  SYNC_FOLDER_NAME,
  SNAPSHOT_CAP,
  snapshotFilename,
  uploadSnapshot,
  downloadSnapshot,
  pruneSnapshots,
} from './driveSync'
import { BACKUP_VERSION, type BackupEnvelope } from './backup'

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response)
}

describe('driveSync folder', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => vi.restoreAllMocks())

  it('returns the existing folder id when one is found', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ files: [{ id: 'folder-1', name: SYNC_FOLDER_NAME }] }))
    await expect(findOrCreateFolder('tok')).resolves.toBe('folder-1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('creates the folder when none exists', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ files: [] }))
    fetchMock.mockReturnValueOnce(jsonResponse({ id: 'folder-new' }))
    await expect(findOrCreateFolder('tok')).resolves.toBe('folder-new')
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('https://www.googleapis.com/drive/v3/files')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      name: SYNC_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    })
  })

  it('sends the bearer token', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ files: [{ id: 'folder-1' }] }))
    await findOrCreateFolder('tok-abc')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-abc')
  })

  it('raises a friendly error when the token is rejected', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ error: { message: 'Invalid Credentials' } }, 401))
    await expect(findOrCreateFolder('tok')).rejects.toThrow(/Google Drive access expired/i)
  })

  it('raises a friendly error on other Drive failures', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ error: { message: 'Rate Limit Exceeded' } }, 429))
    await expect(findOrCreateFolder('tok')).rejects.toThrow(/Rate Limit Exceeded/)
  })

  it('treats a 403 rate limit reason as a rate-limit error, not an expiry', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse(
        { error: { message: 'User Rate Limit Exceeded', errors: [{ reason: 'userRateLimitExceeded' }] } },
        403
      )
    )
    await expect(findOrCreateFolder('tok')).rejects.toThrow(/rate limiting this app/i)
    await expect(findOrCreateFolder('tok')).rejects.not.toThrow(/access expired/i)
  })

  it('treats a 403 daily limit reason as a rate-limit error', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({ error: { message: 'Daily Limit Exceeded', errors: [{ reason: 'dailyLimitExceeded' }] } }, 403)
    )
    await expect(findOrCreateFolder('tok')).rejects.toThrow(/rate limiting this app/i)
  })

  it('treats a 403 storage quota reason as a full-Drive error', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse(
        { error: { message: 'Storage Quota Exceeded', errors: [{ reason: 'storageQuotaExceeded' }] } },
        403
      )
    )
    await expect(findOrCreateFolder('tok')).rejects.toThrow(/Drive is full/i)
  })

  it('surfaces the Drive message for an unrecognised 403 reason', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({ error: { message: 'Some Other Reason', errors: [{ reason: 'somethingElse' }] } }, 403)
    )
    await expect(findOrCreateFolder('tok')).rejects.toThrow(/Some Other Reason/)
  })

  it('falls back to the status message for a 403 with a non-JSON body', async () => {
    fetchMock.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 403,
        json: () => Promise.reject(new Error('not json')),
        text: () => Promise.reject(new Error('not json')),
      } as unknown as Response)
    )
    await expect(findOrCreateFolder('tok')).rejects.toThrow(/Drive request failed \(403\)/)
  })
})

describe('driveSync listSnapshots', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  it('maps Drive files into snapshot metadata', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({
        files: [
          {
            id: 'f1',
            name: 'ledger-2026-08-12T10-00-00Z-r2.json',
            createdTime: '2026-08-12T10:00:00.000Z',
            appProperties: { revision: '2', deviceId: 'dev-a', deviceName: 'Phone' },
          },
        ],
      })
    )
    const snaps = await listSnapshots('tok', 'folder-1')
    expect(snaps).toEqual([
      {
        fileId: 'f1',
        name: 'ledger-2026-08-12T10-00-00Z-r2.json',
        createdTime: '2026-08-12T10:00:00.000Z',
        revision: 2,
        deviceId: 'dev-a',
        deviceName: 'Phone',
      },
    ])
  })

  it('ignores files without ledger revision metadata', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({ files: [{ id: 'f1', name: 'notes.txt', createdTime: '2026-08-12T10:00:00.000Z' }] })
    )
    await expect(listSnapshots('tok', 'folder-1')).resolves.toEqual([])
  })

  it('falls back to a readable device name when metadata is partial', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({
        files: [
          { id: 'f1', name: 'x.json', createdTime: '2026-08-12T10:00:00.000Z', appProperties: { revision: '3' } },
        ],
      })
    )
    const snaps = await listSnapshots('tok', 'folder-1')
    expect(snaps[0].deviceName).toBe('another device')
    expect(snaps[0].deviceId).toBe('')
  })

  it('caps retention at 100 snapshots', () => {
    expect(SNAPSHOT_CAP).toBe(100)
  })
})

function envelope(revision: number): BackupEnvelope {
  return {
    version: BACKUP_VERSION,
    exportedAt: '2026-08-12T10:00:00.000Z',
    app: 'ledger',
    data: { 'ledger-budget': { x: 1 } },
    deviceId: 'dev-a',
    deviceName: 'Desktop',
    revision,
    baseRevision: revision - 1,
  }
}

describe('driveSync upload and download', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  it('names snapshots by timestamp and revision', () => {
    expect(snapshotFilename(new Date('2026-08-12T14:30:05.123Z'), 14))
      .toBe('ledger-2026-08-12T14-30-05Z-r14.json')
  })

  it('uploads with revision metadata in appProperties', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({ id: 'new-file', name: 'x.json', createdTime: '2026-08-12T10:00:00.000Z' })
    )
    const meta = await uploadSnapshot('tok', 'folder-1', envelope(4))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('uploadType=multipart')
    expect(init.headers['Content-Type']).toContain('multipart/related; boundary=')
    expect(init.body).toContain('"revision":"4"')
    expect(init.body).toContain('"deviceName":"Desktop"')
    expect(init.body).toContain('"folder-1"')
    expect(meta.revision).toBe(4)
    expect(meta.fileId).toBe('new-file')
  })

  it('downloads raw file text', async () => {
    fetchMock.mockReturnValueOnce(
      Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{"app":"ledger"}') } as Response)
    )
    await expect(downloadSnapshot('tok', 'f1')).resolves.toBe('{"app":"ledger"}')
    expect(fetchMock.mock.calls[0][0]).toBe('https://www.googleapis.com/drive/v3/files/f1?alt=media')
  })

  it('prunes nothing when under the cap', async () => {
    const few = Array.from({ length: 3 }, (_, i) => ({
      fileId: `f${i}`, name: '', createdTime: `2026-08-0${i + 1}T00:00:00.000Z`,
      revision: i + 1, deviceId: 'd', deviceName: 'Desktop',
    }))
    await expect(pruneSnapshots('tok', few)).resolves.toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('trashes the oldest snapshots beyond the cap', async () => {
    const many = Array.from({ length: SNAPSHOT_CAP + 2 }, (_, i) => ({
      fileId: `f${i}`, name: '', createdTime: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
      revision: i + 1, deviceId: 'd', deviceName: 'Desktop',
    }))
    fetchMock.mockReturnValue(jsonResponse({ id: 'x' }))
    await expect(pruneSnapshots('tok', many)).resolves.toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://www.googleapis.com/drive/v3/files/f0')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ trashed: true })
  })
})
