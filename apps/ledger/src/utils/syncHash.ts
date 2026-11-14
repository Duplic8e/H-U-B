import { buildBackup } from './backup'

/** FNV-1a 32-bit. Not cryptographic. We only need change detection. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export function hashBackupData(data: Record<string, unknown>): string {
  return fnv1a(JSON.stringify(data))
}

export function currentBackupHash(): string {
  return hashBackupData(buildBackup().data)
}

/** True when at least one registered key is present, i.e. this is not a fresh device. */
export function hasLocalData(): boolean {
  return Object.keys(buildBackup().data).length > 0
}
