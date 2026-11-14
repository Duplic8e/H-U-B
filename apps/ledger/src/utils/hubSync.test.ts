import { beforeEach, describe, expect, it } from 'vitest'
import { HUB_CLOUD_KEY, getHubSyncStatus, hasUnsyncedChanges, readHubConfig, runHubSync } from './hubSync'
import { STORAGE_KEYS } from '../store/storageKeys'

/** A tiny in-memory GitHub contents API: enough for list, raw read and a
 *  sha-guarded write. */
function fakeGitHub() {
  const files = new Map<string, { sha: string; text: string }>()
  let shaCounter = 0
  const puts: Array<{ path: string; sha?: string }> = []
  let conflictsToInject = 0

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const auth = new Headers(init?.headers).get('Authorization')
    if (auth !== 'Bearer tok') return new Response('{}', { status: 401 })
    const path = decodeURIComponent(url.pathname.replace(/^\/repos\/me\/data\/contents\//, ''))
    const method = init?.method ?? 'GET'

    if (method === 'PUT') {
      const body = JSON.parse(String(init!.body)) as { content: string; sha?: string }
      puts.push({ path, sha: body.sha })
      if (conflictsToInject > 0) {
        conflictsToInject--
        return new Response('{}', { status: 409 })
      }
      const existing = files.get(path)
      if ((existing?.sha ?? undefined) !== body.sha) return new Response('{}', { status: 409 })
      const text = new TextDecoder().decode(Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0)))
      files.set(path, { sha: `sha${++shaCounter}`, text })
      return new Response('{}', { status: 200 })
    }

    const file = files.get(path)
    if (file) return new Response(file.text, { status: 200 })
    const children = [...files.entries()]
      .filter(([p]) => p.startsWith(`${path}/`))
      .map(([p, f]) => ({ name: p.slice(path.length + 1), sha: f.sha }))
    if (children.length) return new Response(JSON.stringify(children), { status: 200 })
    return new Response('{}', { status: 404 })
  }) as typeof fetch

  return {
    fetch: fetchImpl,
    files,
    puts,
    injectConflicts: (n: number) => { conflictsToInject = n },
    remoteData: () => JSON.parse(files.get('ledger/data.json')!.text) as { revision: number; data: Record<string, unknown> },
  }
}

const connect = () => localStorage.setItem(HUB_CLOUD_KEY, JSON.stringify({ owner: 'me', repo: 'data', token: 'tok' }))
const setBudget = (value: string) =>
  localStorage.setItem(STORAGE_KEYS.budget, JSON.stringify({ state: { note: value }, version: 0 }))
const budgetNote = () => (JSON.parse(localStorage.getItem(STORAGE_KEYS.budget)!) as { state: { note: string } }).state.note

beforeEach(() => localStorage.clear())

describe('hub cloud sync', () => {
  it('does nothing until the Hub has a cloud connection', async () => {
    const gh = fakeGitHub()
    expect(readHubConfig()).toBeNull()
    expect(await runHubSync({ fetch: gh.fetch })).toBe('off')
    expect(gh.puts).toHaveLength(0)
  })

  it('ignores a malformed connection', () => {
    localStorage.setItem(HUB_CLOUD_KEY, JSON.stringify({ owner: 'me', repo: '', token: 'tok' }))
    expect(readHubConfig()).toBeNull()
    localStorage.setItem(HUB_CLOUD_KEY, 'not json')
    expect(readHubConfig()).toBeNull()
  })

  it('uploads existing local data to an empty repo', async () => {
    const gh = fakeGitHub()
    connect()
    setBudget('rent')
    expect(await runHubSync({ fetch: gh.fetch })).toBe('pushed')
    expect(gh.remoteData().revision).toBe(1)
    expect(gh.remoteData().data[STORAGE_KEYS.budget]).toEqual({ state: { note: 'rent' }, version: 0 })
    expect(hasUnsyncedChanges()).toBe(false)
    expect(getHubSyncStatus().state).toBe('idle')
  })

  it('never uploads the hub token or the sync bookkeeping', async () => {
    const gh = fakeGitHub()
    connect()
    setBudget('rent')
    await runHubSync({ fetch: gh.fetch })
    const text = gh.files.get('ledger/data.json')!.text
    expect(text).not.toContain('tok"')
    expect(gh.remoteData().data[HUB_CLOUD_KEY]).toBeUndefined()
    expect(gh.remoteData().data[STORAGE_KEYS.hubSync]).toBeUndefined()
  })

  it('restores everything onto a fresh install', async () => {
    const gh = fakeGitHub()
    connect()
    setBudget('rent')
    await runHubSync({ fetch: gh.fetch })

    // The app was deleted from the home screen: storage is gone, the Hub reconnects.
    localStorage.clear()
    connect()
    expect(await runHubSync({ fetch: gh.fetch })).toBe('pulled')
    expect(budgetNote()).toBe('rent')
    expect(await runHubSync({ fetch: gh.fetch })).toBe('up-to-date')
  })

  it('pushes later edits with the current sha, bumping the revision', async () => {
    const gh = fakeGitHub()
    connect()
    setBudget('rent')
    await runHubSync({ fetch: gh.fetch })
    setBudget('rent and food')
    expect(hasUnsyncedChanges()).toBe(true)
    expect(await runHubSync({ fetch: gh.fetch })).toBe('pushed')
    expect(gh.remoteData().revision).toBe(2)
    expect(gh.puts[1].sha).toBe('sha1')
  })

  it('stops at a conflict when both sides changed, and settles it either way', async () => {
    const gh = fakeGitHub()
    connect()
    setBudget('base')
    await runHubSync({ fetch: gh.fetch })
    const thisDevice = { ...localStorage }

    // Another device moves the cloud copy on.
    setBudget('other device')
    localStorage.setItem(STORAGE_KEYS.hubSync, JSON.stringify({ lastSyncedRevision: 1, lastSyncedHash: 'x' }))
    await runHubSync({ fetch: gh.fetch, resolve: 'keep-this-device' })
    expect(gh.remoteData().revision).toBe(2)

    // Back on this device, which also edited offline.
    localStorage.clear()
    for (const [k, v] of Object.entries(thisDevice)) localStorage.setItem(k, v)
    setBudget('this device')
    expect(await runHubSync({ fetch: gh.fetch })).toBe('conflict')
    expect(getHubSyncStatus().state).toBe('conflict')
    expect(gh.remoteData().data[STORAGE_KEYS.budget]).toEqual({ state: { note: 'other device' }, version: 0 })

    expect(await runHubSync({ fetch: gh.fetch, resolve: 'use-cloud' })).toBe('pulled')
    expect(budgetNote()).toBe('other device')

    setBudget('this device again')
    localStorage.setItem(STORAGE_KEYS.hubSync, JSON.stringify({ lastSyncedRevision: 0, lastSyncedHash: 'stale' }))
    expect(await runHubSync({ fetch: gh.fetch })).toBe('conflict')
    expect(await runHubSync({ fetch: gh.fetch, resolve: 'keep-this-device' })).toBe('pushed')
    expect(gh.remoteData().data[STORAGE_KEYS.budget]).toEqual({ state: { note: 'this device again' }, version: 0 })
  })

  it('retries when another device writes between the read and the write', async () => {
    const gh = fakeGitHub()
    connect()
    setBudget('rent')
    gh.injectConflicts(1)
    expect(await runHubSync({ fetch: gh.fetch })).toBe('pushed')
    expect(gh.puts).toHaveLength(2)
  })

  it('reports a rejected token without throwing it away silently', async () => {
    const gh = fakeGitHub()
    localStorage.setItem(HUB_CLOUD_KEY, JSON.stringify({ owner: 'me', repo: 'data', token: 'wrong' }))
    setBudget('rent')
    await expect(runHubSync({ fetch: gh.fetch })).rejects.toThrow(/token was rejected/)
    const status = getHubSyncStatus()
    expect(status.state).toBe('error')
  })

  it('starts fresh bookkeeping when the Hub points at a different repo', async () => {
    const gh = fakeGitHub()
    connect()
    setBudget('rent')
    await runHubSync({ fetch: gh.fetch })
    localStorage.setItem(HUB_CLOUD_KEY, JSON.stringify({ owner: 'me', repo: 'other', token: 'tok' }))
    expect(hasUnsyncedChanges()).toBe(true)
  })
})
