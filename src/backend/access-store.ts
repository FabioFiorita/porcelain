import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'
import { porcelainHomePath } from '../shared/porcelain-home'

const MAX_ACCESS_FILE_BYTES = 1_048_576
const PAIRING_TTL_MS = 15 * 60 * 1000
const TOKEN_SECRET_BYTES = 32

const pairingSchema = z.object({
  id: z.string(),
  label: z.string(),
  secretHash: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: z.string(),
  expiresAt: z.string(),
})

const clientSchema = z.object({
  id: z.string(),
  label: z.string(),
  secretHash: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: z.string(),
})

const accessSchema = z.object({
  version: z.literal(1),
  pairings: z.array(pairingSchema),
  clients: z.array(clientSchema),
})

export type PairingGrant = Omit<z.infer<typeof pairingSchema>, 'secretHash'>
export type AuthorizedClient = Omit<z.infer<typeof clientSchema>, 'secretHash'>
export type AccessSnapshot = {
  pairings: PairingGrant[]
  clients: AuthorizedClient[]
}

export type AuthIdentity = { kind: 'admin' } | { kind: 'client'; clientId: string; label: string }

type AccessFile = z.infer<typeof accessSchema>

const emptyAccess = (): AccessFile => ({ version: 1, pairings: [], clients: [] })

const accessPath = (): string =>
  process.env.PORCELAIN_ACCESS_FILE ?? porcelainHomePath('access.json')

function token(prefix: 'pc_pair' | 'pc_client', id: string, secret: string): string {
  return `${prefix}_${id}_${secret}`
}

function parseToken(
  value: string,
  prefix: 'pc_pair' | 'pc_client',
): { id: string; secret: string } | null {
  const marker = `${prefix}_`
  if (!value.startsWith(marker)) return null
  const rest = value.slice(marker.length)
  const split = rest.lastIndexOf('_')
  if (split <= 0 || split === rest.length - 1) return null
  return { id: rest.slice(0, split), secret: rest.slice(split + 1) }
}

function secretHash(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

function secretsMatch(expectedHex: string, provided: string): boolean {
  const expected = Buffer.from(expectedHex, 'hex')
  const actual = createHash('sha256').update(provided).digest()
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

let cached: { path: string; mtimeMs: number; size: number; value: AccessFile } | null = null

async function readAccess(): Promise<AccessFile> {
  const path = accessPath()
  let fileStat: Awaited<ReturnType<typeof stat>>
  try {
    fileStat = await stat(path)
  } catch {
    cached = null
    return emptyAccess()
  }
  if (fileStat.size > MAX_ACCESS_FILE_BYTES) {
    console.error(
      `porcelain: ${path} is ${fileStat.size} bytes (> ${MAX_ACCESS_FILE_BYTES}); treating as empty`,
    )
    return emptyAccess()
  }
  if (
    cached !== null &&
    cached.path === path &&
    cached.mtimeMs === fileStat.mtimeMs &&
    cached.size === fileStat.size
  ) {
    return cached.value
  }
  try {
    const value = accessSchema.parse(JSON.parse(await readFile(path, 'utf8')))
    cached = { path, mtimeMs: fileStat.mtimeMs, size: fileStat.size, value }
    return value
  } catch {
    await rename(path, `${path}.corrupt-${Date.now()}`).catch(() => {})
    cached = null
    return emptyAccess()
  }
}

async function writeAccess(value: AccessFile): Promise<void> {
  const path = accessPath()
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 })
  await rename(tmp, path)
  cached = null
}

let mutationChain: Promise<void> = Promise.resolve()

function mutateAccess<T>(fn: (value: AccessFile) => T | Promise<T>): Promise<T> {
  let result: T
  const run = mutationChain.then(async () => {
    const value = await readAccess()
    result = await fn(value)
    await writeAccess(value)
  })
  mutationChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run.then(() => result)
}

function pruneExpired(value: AccessFile, now = Date.now()): void {
  value.pairings = value.pairings.filter((pairing) => Date.parse(pairing.expiresAt) > now)
}

export async function accessSnapshot(): Promise<AccessSnapshot> {
  const value = await readAccess()
  const now = Date.now()
  return {
    pairings: value.pairings
      .filter((pairing) => Date.parse(pairing.expiresAt) > now)
      .map(({ secretHash: _secretHash, ...pairing }) => pairing),
    clients: value.clients.map(({ secretHash: _secretHash, ...client }) => client),
  }
}

export async function issuePairingGrant(
  label: string,
  now = Date.now(),
): Promise<PairingGrant & { credential: string }> {
  const cleanLabel = label.trim()
  if (cleanLabel === '' || cleanLabel.length > 80) {
    throw new Error('Device name must be between 1 and 80 characters')
  }
  return mutateAccess((value) => {
    pruneExpired(value, now)
    const id = randomUUID()
    const secret = randomBytes(TOKEN_SECRET_BYTES).toString('hex')
    const pairing = {
      id,
      label: cleanLabel,
      secretHash: secretHash(secret),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + PAIRING_TTL_MS).toISOString(),
    }
    value.pairings.push(pairing)
    const { secretHash: _secretHash, ...publicPairing } = pairing
    return {
      ...publicPairing,
      credential: token('pc_pair', id, secret),
    }
  })
}

export async function exchangePairingGrant(
  credential: string,
  now = Date.now(),
): Promise<{ token: string; client: AuthorizedClient } | null> {
  const parsed = parseToken(credential, 'pc_pair')
  if (parsed === null) return null
  return mutateAccess((value) => {
    pruneExpired(value, now)
    const index = value.pairings.findIndex((pairing) => pairing.id === parsed.id)
    const pairing = value.pairings[index]
    if (pairing === undefined || !secretsMatch(pairing.secretHash, parsed.secret)) return null

    value.pairings.splice(index, 1)
    const id = randomUUID()
    const secret = randomBytes(TOKEN_SECRET_BYTES).toString('hex')
    const client = {
      id,
      label: pairing.label,
      secretHash: secretHash(secret),
      createdAt: new Date(now).toISOString(),
    }
    value.clients.push(client)
    const { secretHash: _secretHash, ...publicClient } = client
    return {
      token: token('pc_client', id, secret),
      client: publicClient,
    }
  })
}

export async function authenticateClientToken(value: string): Promise<AuthIdentity | null> {
  const parsed = parseToken(value, 'pc_client')
  if (parsed === null) return null
  const client = (await readAccess()).clients.find((candidate) => candidate.id === parsed.id)
  if (client === undefined || !secretsMatch(client.secretHash, parsed.secret)) return null
  return { kind: 'client', clientId: client.id, label: client.label }
}

export async function revokePairingGrant(id: string): Promise<boolean> {
  return mutateAccess((value) => {
    const previous = value.pairings.length
    value.pairings = value.pairings.filter((pairing) => pairing.id !== id)
    return value.pairings.length !== previous
  })
}

export async function revokeAuthorizedClient(id: string): Promise<boolean> {
  return mutateAccess((value) => {
    const previous = value.clients.length
    value.clients = value.clients.filter((client) => client.id !== id)
    return value.clients.length !== previous
  })
}
