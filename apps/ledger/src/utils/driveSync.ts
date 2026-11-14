import type { SnapshotMeta } from './syncDecision'
import type { BackupEnvelope } from './backup'

export const SYNC_FOLDER_NAME = 'Ledger'
export const SNAPSHOT_CAP = 100

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

const RATE_LIMIT_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded'])

/** Turns a Drive error response into a message worth showing a human. */
async function driveError(response: Response): Promise<Error> {
  if (response.status === 401) {
    return new Error('Google Drive access expired. Connect again and retry.')
  }

  let detail = `Drive request failed (${response.status})`
  let body: { error?: { message?: string, errors?: Array<{ reason?: string }> } } | undefined
  try {
    body = (await response.json()) as typeof body
    if (body?.error?.message) detail = body.error.message
  } catch {
    // Keep the status-based message.
  }

  if (response.status === 403) {
    const reason = body?.error?.errors?.[0]?.reason
    if (reason && RATE_LIMIT_REASONS.has(reason)) {
      return new Error('Google Drive is rate limiting this app. Wait a moment and try again.')
    }
    if (reason === 'storageQuotaExceeded') {
      return new Error('Your Google Drive is full. Free up space and try again.')
    }
  }

  return new Error(detail)
}

async function driveFetch(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { ...authHeaders(token), ...(init.headers as Record<string, string> | undefined) },
  })
  if (!response.ok) throw await driveError(response)
  return response
}

export async function findOrCreateFolder(token: string): Promise<string> {
  const query = `name='${SYNC_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const listUrl = `${DRIVE_FILES}?q=${encodeURIComponent(query)}&fields=${encodeURIComponent('files(id,name)')}`
  const listed = (await (await driveFetch(listUrl, token)).json()) as { files?: Array<{ id: string }> }
  const existing = listed.files?.[0]
  if (existing) return existing.id

  const created = (await (
    await driveFetch(DRIVE_FILES, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: SYNC_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    })
  ).json()) as { id: string }
  return created.id
}

export async function listSnapshots(token: string, folderId: string): Promise<SnapshotMeta[]> {
  const query = `'${folderId}' in parents and trashed=false`
  const fields = 'files(id,name,createdTime,appProperties)'
  const url =
    `${DRIVE_FILES}?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}` +
    `&orderBy=createdTime%20desc&pageSize=200`
  const body = (await (await driveFetch(url, token)).json()) as {
    files?: Array<{
      id: string
      name: string
      createdTime: string
      appProperties?: Record<string, string>
    }>
  }
  return (body.files ?? [])
    .filter((file) => file.appProperties?.revision !== undefined)
    .map((file) => ({
      fileId: file.id,
      name: file.name,
      createdTime: file.createdTime,
      revision: Number(file.appProperties!.revision),
      deviceId: file.appProperties!.deviceId ?? '',
      deviceName: file.appProperties!.deviceName ?? 'another device',
    }))
    .filter((snapshot) => Number.isFinite(snapshot.revision))
}

const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const UPLOAD_BOUNDARY = 'ledger-sync-boundary'

/** e.g. ledger-2026-08-12T14-30-05Z-r14.json */
export function snapshotFilename(date: Date, revision: number): string {
  const stamp = date.toISOString().slice(0, 19).replace(/:/g, '-')
  return `ledger-${stamp}Z-r${revision}.json`
}

export async function uploadSnapshot(
  token: string,
  folderId: string,
  envelope: BackupEnvelope
): Promise<SnapshotMeta> {
  const revision = envelope.revision ?? 1
  const metadata = {
    name: snapshotFilename(new Date(), revision),
    parents: [folderId],
    mimeType: 'application/json',
    appProperties: {
      revision: String(revision),
      deviceId: envelope.deviceId ?? '',
      deviceName: envelope.deviceName ?? 'another device',
    },
  }
  const content = JSON.stringify(envelope, null, 2)
  const body =
    `--${UPLOAD_BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${UPLOAD_BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n` +
    `--${UPLOAD_BOUNDARY}--`

  const url = `${DRIVE_UPLOAD}?uploadType=multipart&fields=${encodeURIComponent('id,name,createdTime')}`
  const created = (await (
    await driveFetch(url, token, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${UPLOAD_BOUNDARY}` },
      body,
    })
  ).json()) as { id: string; name: string; createdTime: string }

  return {
    fileId: created.id,
    name: created.name,
    createdTime: created.createdTime,
    revision,
    deviceId: envelope.deviceId ?? '',
    deviceName: envelope.deviceName ?? 'another device',
  }
}

export async function downloadSnapshot(token: string, fileId: string): Promise<string> {
  const response = await driveFetch(`${DRIVE_FILES}/${fileId}?alt=media`, token)
  return response.text()
}

/** Trashes the oldest snapshots beyond SNAPSHOT_CAP. Returns how many were trashed. */
export async function pruneSnapshots(token: string, snapshots: SnapshotMeta[]): Promise<number> {
  if (snapshots.length <= SNAPSHOT_CAP) return 0
  const oldestFirst = [...snapshots].sort((a, b) => a.createdTime.localeCompare(b.createdTime))
  const doomed = oldestFirst.slice(0, snapshots.length - SNAPSHOT_CAP)
  for (const snapshot of doomed) {
    await driveFetch(`${DRIVE_FILES}/${snapshot.fileId}`, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    })
  }
  return doomed.length
}
