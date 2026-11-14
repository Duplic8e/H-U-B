import { describe, expect, it } from 'vitest'
import { autoSyncAction } from './autoSync'
import type { SnapshotMeta } from './syncDecision'

const remote: SnapshotMeta = {
  fileId: 'r1',
  name: 'snap',
  revision: 2,
  createdTime: '2026-08-17T00:00:00Z',
  deviceId: 'dev-2',
  deviceName: 'Laptop',
}
const base = { enabled: true, connected: true }

describe('autoSyncAction', () => {
  it('does nothing when disabled', () => {
    expect(
      autoSyncAction({ ...base, enabled: false, push: { kind: 'clean', nextRevision: 2, baseRevision: 1 }, pull: { kind: 'up-to-date' } }),
    ).toBe('skip')
  })

  it('does nothing when Drive is not connected', () => {
    expect(
      autoSyncAction({ ...base, connected: false, push: { kind: 'clean', nextRevision: 2, baseRevision: 1 }, pull: { kind: 'up-to-date' } }),
    ).toBe('skip')
  })

  it('pulls a clean remote before pushing', () => {
    expect(
      autoSyncAction({ ...base, push: { kind: 'clean', nextRevision: 2, baseRevision: 1 }, pull: { kind: 'clean', remote } }),
    ).toBe('pull')
  })

  it('pushes local changes when the remote has nothing new', () => {
    expect(
      autoSyncAction({ ...base, push: { kind: 'clean', nextRevision: 2, baseRevision: 1 }, pull: { kind: 'up-to-date' } }),
    ).toBe('push')
  })

  it('skips when there is nothing to do', () => {
    expect(
      autoSyncAction({ ...base, push: { kind: 'nothing-to-push' }, pull: { kind: 'up-to-date' } }),
    ).toBe('skip')
  })

  it('defers a diverged push to the user', () => {
    expect(
      autoSyncAction({ ...base, push: { kind: 'diverged', remote, nextRevision: 2, baseRevision: 1 }, pull: { kind: 'up-to-date' } }),
    ).toBe('needs-user')
  })

  it('defers a pull that would lose local work to the user', () => {
    expect(
      autoSyncAction({ ...base, push: { kind: 'nothing-to-push' }, pull: { kind: 'would-lose-local', remote } }),
    ).toBe('needs-user')
  })

  it('defers a collision to the user', () => {
    expect(
      autoSyncAction({ ...base, push: { kind: 'nothing-to-push' }, pull: { kind: 'collision', remote } }),
    ).toBe('needs-user')
  })
})
