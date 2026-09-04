import { z } from 'zod'

/**
 * One paired daemon, as stored. The token lives under its own secure-store key
 * (`porcelain.token.<id>`), never in this record: renaming an environment rewrites the
 * index, and an index that carried credentials would rewrite those too.
 */
const environmentRecordSchema = z.object({
  id: z.string(),
  nickname: z.string().min(1).max(64),
  /** The visual kind chosen for this environment group in Settings. */
  icon: z.enum(['desktop', 'terminal', 'notebook']),
  /** Whether this environment may be selected and used by Hub. Legacy records default on. */
  enabled: z.boolean().default(true),
  /** Normalized: scheme + host + port, no trailing slash. */
  baseUrl: z.string().url(),
  /** Every verified route for this daemon; a group of one is valid. */
  endpoints: z.array(z.string().url()).min(1),
  /** The exact route chosen first; endpoint kind is only a display hint. */
  preferredEndpoint: z.string().url(),
  createdAt: z.number().int(),
  /** The repo this daemon was last pointed at — per-daemon, meaningless without one. */
  activeRepoPath: z.string().nullable(),
})

export type EnvironmentRecord = z.infer<typeof environmentRecordSchema>
export type EnvironmentId = EnvironmentRecord['id']
export type EnvironmentIcon = EnvironmentRecord['icon']

export const environmentsFileSchema = z.object({
  version: z.literal(1),
  activeId: z.string().nullable(),
  environments: z.array(environmentRecordSchema),
})

export type EnvironmentsFile = z.infer<typeof environmentsFileSchema>

/**
 * A stored environment with its credential resolved. `token: null` is a device whose token was
 * revoked on the host: the nickname and routes survive so the app can name what was unpaired and
 * offer to pair again, but nothing can be called against it.
 */
export type Environment = EnvironmentRecord & { token: string | null }
export type PairedEnvironment = EnvironmentRecord & { token: string }

export function isPaired(environment: Environment | null): environment is PairedEnvironment {
  return environment !== null && environment.token !== null
}

/** Whether this environment is eligible to be current and appear in Hub pickers. */
export function isEnabled(environment: Environment | null): environment is Environment {
  return environment?.enabled === true
}

export const EMPTY_ENVIRONMENTS_FILE: EnvironmentsFile = {
  version: 1,
  activeId: null,
  environments: [],
}

export type StoredEnvironments =
  | { status: 'empty' }
  | { status: 'ok'; file: EnvironmentsFile }
  | { status: 'corrupt' }

/**
 * `corrupt` is not `empty`: the caller keeps the unreadable blob aside and says so, because
 * silently dropping a paired credential looks identical to never having paired.
 */
export function parseEnvironmentsFile(raw: string | null): StoredEnvironments {
  if (raw === null || raw.trim() === '') return { status: 'empty' }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { status: 'corrupt' }
  }

  const parsed = environmentsFileSchema.safeParse(json)
  return parsed.success ? { status: 'ok', file: parsed.data } : { status: 'corrupt' }
}

/** Return the basename used for a selected Project. Daemon paths are POSIX. */
export function projectNameOf(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  const slash = trimmed.lastIndexOf('/')
  return slash === -1 ? trimmed : trimmed.slice(slash + 1)
}

/** Runtime Project accessor; the version-1 storage adapter still serializes `activeRepoPath`. */
export function activeProjectPathOf(environment: Environment | null): string | null {
  return environment?.activeRepoPath ?? null
}

/** Origin only, lowercased, no trailing slash — the form stored and compared. */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '').toLowerCase()
}

/** `http://192.168.1.50:43117` → `192.168.1.50`, the default nickname for a fresh pairing. */
export function hostOf(baseUrl: string): string {
  const host = baseUrl.replace(/^https?:\/\//i, '')
  const port = host.lastIndexOf(':')
  return port === -1 ? host : host.slice(0, port)
}
