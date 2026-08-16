import { homedir } from 'node:os'
import { isAbsolute, join, resolve, sep } from 'node:path'
import { porcelainHome } from '@shared/porcelain-home'
import { z } from 'zod'

export type ResetTargetKind = 'home' | 'userData' | 'repoCompanion'

export type ResetRootDisposition = 'material' | 'disposable' | 'mixed'

export type ResetRecordDisposition = 'material' | 'disposable'

export type ResetTargetSpec = {
  readonly kind: ResetTargetKind
  readonly pathTemplate: string
  readonly includedByDefault: boolean
  readonly rootDisposition: ResetRootDisposition
}

export type ResetAuthorizationRecord = {
  readonly id: 'PDT-004'
  readonly approved: true
  readonly approvedBy: string
  readonly approvedOn: string
  readonly exportMachinery: false
  readonly agentRunnable: false
  readonly pnpmWired: false
  readonly operator: 'human-owner-only'
  readonly recovery: 'manual-on-disk-conversion'
  readonly targets: readonly ResetTargetSpec[]
}

export type ResetAuthorizationRefusal =
  | 'relative-path'
  | 'duplicate-target'
  | 'missing-classification'
  | 'absent-approval'
  | 'export-machinery-present'
  | 'agent-runnable'
  | 'unknown-target'
  | 'invalid-shape'

export const GRANTED_RESET_TARGETS: readonly ResetTargetSpec[] = [
  {
    kind: 'home',
    pathTemplate: '~/.porcelain',
    includedByDefault: true,
    rootDisposition: 'mixed',
  },
  {
    kind: 'userData',
    pathTemplate: '~/.local/share/porcelain',
    includedByDefault: true,
    rootDisposition: 'material',
  },
  {
    kind: 'repoCompanion',
    pathTemplate: '<repo>/.porcelain',
    includedByDefault: false,
    rootDisposition: 'material',
  },
]

export const GRANTED_RESET_AUTHORIZATION: ResetAuthorizationRecord = {
  id: 'PDT-004',
  approved: true,
  approvedBy: 'Fabio Fiorita',
  approvedOn: '2026-08-11',
  exportMachinery: false,
  agentRunnable: false,
  pnpmWired: false,
  operator: 'human-owner-only',
  recovery: 'manual-on-disk-conversion',
  targets: GRANTED_RESET_TARGETS,
}

const GRANTED_TEMPLATE_BY_PATH = new Map(
  GRANTED_RESET_TARGETS.map((target) => [target.pathTemplate, target]),
)

const resetTargetSpecSchema = z
  .object({
    kind: z.enum(['home', 'userData', 'repoCompanion']),
    pathTemplate: z.string(),
    includedByDefault: z.boolean(),
    rootDisposition: z.enum(['material', 'disposable', 'mixed']),
  })
  .strict()

const resetAuthorizationRecordSchema = z
  .object({
    id: z.literal('PDT-004'),
    approved: z.literal(true),
    approvedBy: z.string(),
    approvedOn: z.string(),
    exportMachinery: z.literal(false),
    agentRunnable: z.literal(false),
    pnpmWired: z.literal(false),
    operator: z.literal('human-owner-only'),
    recovery: z.literal('manual-on-disk-conversion'),
    targets: z.array(resetTargetSpecSchema),
  })
  .strict()

const RESET_RECORD_CATALOG: readonly {
  readonly root: ResetTargetKind
  readonly relativePath: string
  readonly disposition: ResetRecordDisposition
}[] = [
  { root: 'home', relativePath: 'access.json', disposition: 'material' },
  { root: 'home', relativePath: 'admin-token', disposition: 'material' },
  { root: 'home', relativePath: 'action-trust.json', disposition: 'material' },
  { root: 'home', relativePath: 'porcelain', disposition: 'disposable' },
  { root: 'home', relativePath: 'actions.json', disposition: 'disposable' },
  { root: 'home', relativePath: 'layers.json', disposition: 'disposable' },
  { root: 'home', relativePath: 'comments.json', disposition: 'disposable' },
  { root: 'home', relativePath: 'reviewed.json', disposition: 'disposable' },
  { root: 'home', relativePath: 'review-sets.json', disposition: 'disposable' },
  { root: 'home', relativePath: 'loop-evidence', disposition: 'disposable' },
  { root: 'userData', relativePath: 'config.json', disposition: 'material' },
  { root: 'userData', relativePath: 'projects-recents.json', disposition: 'material' },
  { root: 'repoCompanion', relativePath: 'actions.json', disposition: 'material' },
  { root: 'repoCompanion', relativePath: 'layers.json', disposition: 'material' },
  { root: 'repoCompanion', relativePath: '.gitignore', disposition: 'material' },
  { root: 'repoCompanion', relativePath: 'reviews', disposition: 'material' },
  { root: 'repoCompanion', relativePath: 'project-manifest.json', disposition: 'disposable' },
]

function refusalForSchemaFailure(error: z.ZodError): ResetAuthorizationRefusal {
  const paths = error.issues.map((issue) => issue.path)
  if (paths.some((path) => path.includes('rootDisposition'))) {
    return 'missing-classification'
  }
  if (paths.some((path) => path[0] === 'approved')) {
    return 'absent-approval'
  }
  if (paths.some((path) => path[0] === 'exportMachinery')) {
    return 'export-machinery-present'
  }
  if (paths.some((path) => path[0] === 'agentRunnable' || path[0] === 'pnpmWired')) {
    return 'agent-runnable'
  }
  return 'invalid-shape'
}

function sameTarget(left: ResetTargetSpec, right: ResetTargetSpec): boolean {
  return (
    left.kind === right.kind &&
    left.pathTemplate === right.pathTemplate &&
    left.includedByDefault === right.includedByDefault &&
    left.rootDisposition === right.rootDisposition
  )
}

function matchesGrantedAuthorization(record: ResetAuthorizationRecord): boolean {
  return (
    record.id === GRANTED_RESET_AUTHORIZATION.id &&
    record.approved === GRANTED_RESET_AUTHORIZATION.approved &&
    record.approvedBy === GRANTED_RESET_AUTHORIZATION.approvedBy &&
    record.approvedOn === GRANTED_RESET_AUTHORIZATION.approvedOn &&
    record.exportMachinery === GRANTED_RESET_AUTHORIZATION.exportMachinery &&
    record.agentRunnable === GRANTED_RESET_AUTHORIZATION.agentRunnable &&
    record.pnpmWired === GRANTED_RESET_AUTHORIZATION.pnpmWired &&
    record.operator === GRANTED_RESET_AUTHORIZATION.operator &&
    record.recovery === GRANTED_RESET_AUTHORIZATION.recovery &&
    record.targets.length === GRANTED_RESET_TARGETS.length &&
    record.targets.every((target, index) => {
      const granted = GRANTED_RESET_TARGETS[index]
      return granted !== undefined && sameTarget(target, granted)
    })
  )
}

function isEqualOrInside(candidate: string, root: string): boolean {
  const resolvedCandidate = resolve(candidate)
  const resolvedRoot = resolve(root)
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${sep}`)
}

function comparedLiveRoots(): readonly string[] {
  const roots = [
    porcelainHome(),
    join(homedir(), '.porcelain'),
    join(homedir(), '.porcelain-dev'),
    join(homedir(), '.local/share/porcelain'),
    join(homedir(), '.local/share/porcelain-dev'),
  ]
  const envHome = process.env.PORCELAIN_HOME
  const envUserData = process.env.PORCELAIN_USER_DATA
  if (envHome) roots.push(envHome)
  if (envUserData) roots.push(envUserData)
  return roots
}

export function parseResetAuthorization(
  input: unknown,
):
  | { readonly ok: true; readonly value: ResetAuthorizationRecord }
  | { readonly ok: false; readonly reason: ResetAuthorizationRefusal } {
  const parsed = resetAuthorizationRecordSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, reason: refusalForSchemaFailure(parsed.error) }
  }

  const record: ResetAuthorizationRecord = parsed.data

  for (const target of record.targets) {
    if (!GRANTED_TEMPLATE_BY_PATH.has(target.pathTemplate) && !isAbsolute(target.pathTemplate)) {
      return { ok: false, reason: 'relative-path' }
    }
  }

  const seenKinds = new Set<ResetTargetKind>()
  const seenTemplates = new Set<string>()
  for (const target of record.targets) {
    if (seenKinds.has(target.kind) || seenTemplates.has(target.pathTemplate)) {
      return { ok: false, reason: 'duplicate-target' }
    }
    seenKinds.add(target.kind)
    seenTemplates.add(target.pathTemplate)
  }

  for (const target of record.targets) {
    const granted = GRANTED_TEMPLATE_BY_PATH.get(target.pathTemplate)
    if (granted !== undefined && granted.kind !== target.kind) {
      return { ok: false, reason: 'unknown-target' }
    }
  }

  if (matchesGrantedAuthorization(record)) {
    return { ok: true, value: GRANTED_RESET_AUTHORIZATION }
  }
  return { ok: true, value: record }
}

export function classifyResetRecord(input: {
  readonly root: ResetTargetKind
  readonly relativePath: string
}): ResetRecordDisposition | null {
  const match = RESET_RECORD_CATALOG.find(
    (row) => row.root === input.root && row.relativePath === input.relativePath,
  )
  return match?.disposition ?? null
}

export function isForbiddenLiveRoot(absolutePath: string): boolean {
  if (!isAbsolute(absolutePath)) return true
  return comparedLiveRoots().some((root) => isEqualOrInside(absolutePath, root))
}
