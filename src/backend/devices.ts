import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { z } from 'zod'

/**
 * Per-device credentials, so "revoke" means something (environments v2 phase 4).
 *
 * Before this, one shared secret (`~/.porcelain/daemon-token`) authenticated every client,
 * so the only way to cut off an iPad was to rotate that token and re-pair EVERYTHING. Each
 * pairing now mints a credential of its own; revoking one leaves the others untouched.
 *
 * SECURITY — this file is the second thing (after the shared token) that can authenticate
 * a request, so it inherits the token's invariants:
 *
 * - **Hashes only on disk.** The credential itself exists exactly twice: in the `/pair`
 *   response, and on the device that redeemed it. A reader of `devices.json` learns who is
 *   paired, never how to impersonate them. Written 0600 anyway.
 * - **Loaded before the first listener accepts.** `matchDevice` is SYNC because it runs
 *   inside the request gate; the cost is that `loadDevices()` must be awaited at boot
 *   (server.ts does, before `createDaemonHttp`). An unloaded store authenticates nobody —
 *   fail closed, never "allow while we read the file".
 * - **Constant-time compare over sha256 digests**, same shape as the shared-token gate.
 * - **A corrupt file de-authenticates every device rather than authenticating a stranger.**
 *   It's backed up (never silently lost) and treated as empty; the human re-pairs.
 *
 * `lastSeenAt` is the one field a REQUEST writes, so it is stamped in memory on every hit
 * and flushed at most once a minute — a disk write per request would be absurd, and the
 * roster only needs "roughly when", not "exactly when".
 */

const deviceSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** sha256 hex of the credential. The credential itself is never stored. */
  credentialHash: z.string(),
  createdAt: z.number(),
  lastSeenAt: z.number(),
})
type Device = z.infer<typeof deviceSchema>

const devicesSchema = z.array(deviceSchema)

/** What leaves this module: the roster fields, never the hash. */
export interface DeviceInfo {
  id: string
  label: string
  createdAt: number
  lastSeenAt: number
}

/** A device names itself at pairing time; cap it so the roster can't be flooded by a peer. */
export const MAX_DEVICE_LABEL = 64

const FLUSH_INTERVAL_MS = 60_000

const devicesPath = (): string =>
  process.env.PORCELAIN_DEVICES ?? join(homedir(), '.porcelain', 'devices.json')

let devices: Device[] = []
let hashes = new Map<string, Buffer>()
let loaded = false
let lastFlushAt = 0
let dirty = false

const digest = (value: string): Buffer => createHash('sha256').update(value).digest()

function reindex(): void {
  hashes = new Map(devices.map((device) => [device.id, Buffer.from(device.credentialHash, 'hex')]))
}

const toInfo = ({ id, label, createdAt, lastSeenAt }: Device): DeviceInfo => ({
  id,
  label,
  createdAt,
  lastSeenAt,
})

/**
 * Serialized, atomic write. Two things here are load-bearing, and both come from the same
 * hazard — a `lastSeenAt` flush can be in flight while a pairing or a revoke writes:
 *
 * - **The writes are chained** (same idiom as `home-channel.ts`). Two concurrent writers
 *   racing on one file can interleave a short write over a long one, and by this file's own
 *   rule a malformed `devices.json` de-authenticates EVERY paired device.
 * - **The tmp path is unique per write.** A shared `${path}.tmp` means the second writer
 *   truncates the first's file and the loser's `rename` fails ENOENT — which, on the pairing
 *   path, would 500 the exchange *after* the code was already burned.
 */
let writeChain: Promise<void> = Promise.resolve()

function persist(): Promise<void> {
  const run = writeChain.then(async () => {
    const path = devicesPath()
    await mkdir(dirname(path), { recursive: true })
    const tmp = `${path}.${process.pid}.${randomUUID()}.tmp`
    // 0600 on the tmp file, before the rename, so it is never briefly world-readable at
    // its final path (same shape as token-file.ts).
    await writeFile(tmp, JSON.stringify(devices, null, 2), { encoding: 'utf8', mode: 0o600 })
    await rename(tmp, path)
    dirty = false
  })
  writeChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/**
 * Read the store into memory. Must be awaited before any listener accepts a connection —
 * `matchDevice` is sync and answers "no" until this resolves.
 */
export async function loadDevices(): Promise<void> {
  const path = devicesPath()
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    devices = [] // absent: nobody has paired yet
    reindex()
    loaded = true
    return
  }
  try {
    devices = devicesSchema.parse(JSON.parse(raw))
  } catch {
    // Present but unparseable. Fail CLOSED (no device authenticates) and keep the file
    // for forensics rather than overwriting it on the next pairing.
    await rename(path, `${path}.corrupt-${Date.now()}`).catch(() => {})
    console.error('[daemon] devices.json was unreadable; every paired device must re-pair')
    devices = []
  }
  reindex()
  loaded = true
}

/** The roster, newest pairing last. */
export function listDevices(): DeviceInfo[] {
  return devices.map(toInfo)
}

/**
 * Mint a credential for a newly-paired device. The plaintext is returned ONCE — it is
 * hashed on the way to disk and cannot be recovered afterwards.
 */
export async function registerDevice(
  label: string,
): Promise<{ device: DeviceInfo; credential: string }> {
  const credential = randomBytes(32).toString('hex')
  const now = Date.now()
  const device: Device = {
    id: randomUUID(),
    label: sanitizeLabel(label),
    credentialHash: digest(credential).toString('hex'),
    createdAt: now,
    lastSeenAt: now,
  }
  devices = [...devices, device]
  reindex()
  await persist()
  return { device: toInfo(device), credential }
}

/** Cut a device off. Returns false for an unknown id (already revoked, double-click). */
export async function revokeDevice(id: string): Promise<boolean> {
  const next = devices.filter((device) => device.id !== id)
  if (next.length === devices.length) return false
  devices = next
  reindex()
  await persist()
  return true
}

/**
 * The device this credential belongs to, or null. Constant-time per candidate; the number
 * of paired devices is not a secret, so iterating the roster leaks nothing that matters.
 *
 * Stamps `lastSeenAt` in memory on a hit and flushes at most once a minute — see the header.
 */
export function matchDevice(provided: string): string | null {
  if (!loaded || provided === '' || devices.length === 0) return null
  const candidate = digest(provided)
  for (const device of devices) {
    const stored = hashes.get(device.id)
    // A hand-edited devices.json can carry a hash that isn't 32 bytes; timingSafeEqual
    // throws on a length mismatch, so skip rather than crash the gate.
    if (stored === undefined || stored.length !== candidate.length) continue
    if (!timingSafeEqual(stored, candidate)) continue
    const now = Date.now()
    device.lastSeenAt = now
    dirty = true
    if (now - lastFlushAt >= FLUSH_INTERVAL_MS) {
      // Stamped BEFORE the write, not after it succeeds: if the write keeps failing
      // (read-only home, full disk) an after-success stamp would leave the throttle open
      // and spawn one write attempt per authenticated request — the exact thing the
      // throttle exists to prevent.
      lastFlushAt = now
      // Fire-and-forget: a failed lastSeen write must never fail the request it rode in on.
      persist().catch(() => {})
    }
    return device.id
  }
  return null
}

/** Write a pending `lastSeenAt` stamp out; called on daemon shutdown. Best-effort. */
export async function flushDevices(): Promise<void> {
  if (!dirty) return
  await persist().catch(() => {})
}

/**
 * Trim a peer-supplied label to something a roster row can hold. Control characters are
 * stripped (a label lands in the UI) and an empty result falls back rather than rendering
 * a blank row.
 */
export function sanitizeLabel(label: string): string {
  // Char-code filter rather than a control-character regex — same result, and the
  // source file stays free of literal control bytes.
  const clean = [...label]
    .filter((ch) => ch >= ' ' && ch !== '\u007f')
    .join('')
    .trim()
  return clean === '' ? 'Paired device' : clean.slice(0, MAX_DEVICE_LABEL)
}

/** Test-only: forget the in-memory roster so a test can start from a fresh file. */
export function resetDevicesForTest(): void {
  devices = []
  hashes = new Map()
  loaded = false
  lastFlushAt = 0
  dirty = false
}
