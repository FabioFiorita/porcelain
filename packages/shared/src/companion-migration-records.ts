import {
  ACTIONS_FILE_MAX_BYTES,
  type ActionsFileAction,
  type ActionsFileV1,
  emptyActionsFileV1,
  parseActionsFileV1,
  serializeActionsFileV1,
} from './actions-file'
import {
  readJsonEnvelope,
  readJsonFile,
  readTextFile,
  writeJsonAtomically,
  writeJsonEnvelope,
} from './companion-migration-store'
import { PROJECT_FILES, projectPorcelainPath } from './project-porcelain'
import { projectActionsPath, projectOverridesPath } from './project-store'
import { tasksIndexPath } from './tasks-porcelain'

/**
 * The record-shaped halves of the companion migration (#27, decisions 2b–2d):
 * Board cards → Tasks, repo-local Actions → the daemon-root Project store, and
 * `scope.json` hide/pin → the daemon-root PRIVATE overrides document.
 *
 * The private overrides document is deliberately NOT `<repo>/.porcelain/project.json`.
 * That file is the tracked Git overlay and only an explicit promotion may write it
 * (ADR 0002 / #26); silently promoting a human's personal hide/pin list into their
 * working tree is exactly the "opening a repo adds state to Git" failure the ADR
 * exists to prevent. Migration writes the private counterpart the overlay's
 * precedence already anticipates: `$PORCELAIN_HOME/projects/<id>/project.json`.
 *
 * Every writer here reads the destination first and merges, so running the
 * migration twice cannot duplicate a row even before the ledger is consulted.
 */

export type MigratedWorktree = {
  id: string
  path: string
  /** Short branch name, when the caller could resolve one. */
  branch?: string
}

export type TaskStatus = 'todo' | 'doing' | 'done' | 'blocked'

export type MigratedTask = {
  id: string
  title: string
  notes?: string
  status: TaskStatus
  tags: string[]
  references: { projectId?: string; worktreeId?: string }
  attachments: never[]
  links: never[]
  createdAt: string
  updatedAt: string
}

export type BoardCard = {
  id: string
  title: string
  body?: string
  status: string
  createdAt: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Read `board.json` leniently.
 *
 * The strict parser in `board-file.ts` throws the whole document away on one bad
 * card, which is the right call for a live store and the wrong one for a
 * migration: a card the strict reader rejects is precisely the card a human
 * would otherwise lose forever at #28's cutover. Each card is validated on its
 * own; the ones that fail are reported as unsupported rather than dropped.
 */
export async function readBoardCards(repoPath: string): Promise<{
  cards: BoardCard[]
  invalid: number
}> {
  const raw = await readJsonFile(projectPorcelainPath(repoPath, PROJECT_FILES.board))
  if (!isRecord(raw) || !Array.isArray(raw.cards)) return { cards: [], invalid: 0 }
  const cards: BoardCard[] = []
  let invalid = 0
  for (const entry of raw.cards) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || entry.id === '') {
      invalid += 1
      continue
    }
    const title = typeof entry.title === 'string' ? entry.title.trim() : ''
    if (title === '') {
      invalid += 1
      continue
    }
    cards.push({
      id: entry.id,
      title: title.slice(0, 240),
      body: typeof entry.body === 'string' && entry.body !== '' ? entry.body : undefined,
      status: typeof entry.status === 'string' ? entry.status : '',
      createdAt:
        typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt)
          ? entry.createdAt
          : 0,
    })
  }
  return { cards, invalid }
}

const KNOWN_STATUSES = new Set<TaskStatus>(['todo', 'doing', 'done', 'blocked'])

/** Board columns map onto Task statuses by name; anything else lands in `todo`, tagged. */
export function taskStatusForCard(status: string): { status: TaskStatus; tags: string[] } {
  if (KNOWN_STATUSES.has(status as TaskStatus)) return { status: status as TaskStatus, tags: [] }
  return { status: 'todo', tags: ['migrated'] }
}

/**
 * The Worktree a card is talking about, or `undefined`.
 *
 * Inference only, and deliberately conservative: an exact branch-name or
 * checkout-path occurrence in the card's own text. A guess that attaches work to
 * the wrong checkout is worse than no reference at all, so nothing fuzzier
 * (prefix, similarity, "most recent") is attempted.
 */
export function inferWorktree(
  card: BoardCard,
  worktrees: readonly MigratedWorktree[],
): MigratedWorktree | undefined {
  const haystack = `${card.title}\n${card.body ?? ''}`
  for (const worktree of worktrees) {
    if (haystack.includes(worktree.path)) return worktree
  }
  for (const worktree of worktrees) {
    const branch = worktree.branch
    if (branch === undefined || branch === '') continue
    const pattern = new RegExp(
      `(^|[^\\w/-])${branch.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w/-]|$)`,
    )
    if (pattern.test(haystack)) return worktree
  }
  return undefined
}

function isoFrom(epochMs: number, fallback: string): string {
  if (!Number.isSafeInteger(epochMs) || epochMs <= 0) return fallback
  const date = new Date(epochMs)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

export function taskForCard(input: {
  card: BoardCard
  projectId: string
  worktree?: MigratedWorktree
  now: string
}): MigratedTask {
  const mapped = taskStatusForCard(input.card.status)
  const references: MigratedTask['references'] = { projectId: input.projectId }
  if (input.worktree !== undefined) references.worktreeId = input.worktree.id
  const createdAt = isoFrom(input.card.createdAt, input.now)
  return {
    // The Board card id IS the Task id. Board ids are UUIDs and Tasks require
    // one, so reusing it makes "already migrated" answerable from the Tasks
    // table alone — the ledger is the second guard, never the only one.
    id: input.card.id,
    title: input.card.title,
    ...(input.card.body === undefined ? {} : { notes: input.card.body.slice(0, 20_000) }),
    status: mapped.status,
    tags: mapped.tags,
    references,
    attachments: [],
    links: [],
    createdAt,
    updatedAt: input.now,
  }
}

/** Every Task on this daemon, as the strict envelope `tasks-store.ts` reads back. */
export async function readStoredTasks(homeDir: string): Promise<unknown[]> {
  const value = await readJsonEnvelope(tasksIndexPath(homeDir))
  if (!isRecord(value) || !Array.isArray(value.tasks)) return []
  return value.tasks
}

export async function writeStoredTasks(homeDir: string, tasks: readonly unknown[]): Promise<void> {
  await writeJsonEnvelope(tasksIndexPath(homeDir), { tasks })
}

export function storedTaskIds(tasks: readonly unknown[]): Set<string> {
  const ids = new Set<string>()
  for (const task of tasks) {
    if (isRecord(task) && typeof task.id === 'string') ids.add(task.id)
  }
  return ids
}

// --- Actions -----------------------------------------------------------------

export type ActionMigrationPlan = {
  /** Repo-local actions that have no counterpart in the Project store yet. */
  incoming: ActionsFileAction[]
  /** Repo-local actions already present, by title or id. */
  duplicates: ActionsFileAction[]
  /** The merged document to write, or `null` when there is nothing to add. */
  merged: ActionsFileV1 | null
}

async function readActionsDocument(path: string): Promise<ActionsFileV1> {
  const raw = await readTextFile(path)
  if (raw === null || raw.length > ACTIONS_FILE_MAX_BYTES) return emptyActionsFileV1()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptyActionsFileV1()
  }
  try {
    return parseActionsFileV1(parsed)
  } catch {
    return emptyActionsFileV1()
  }
}

/**
 * Merge `<repo>/.porcelain/actions.json` into `$PORCELAIN_HOME/projects/<id>/actions.json`.
 *
 * Duplicates are matched on id OR on title: the same command saved from two
 * checkouts of one Project has two ids and one name, and the human reads the
 * name. Trust records are untouched on purpose — a migrated Action is an Action
 * this machine has never approved, so it arrives unreviewed and the existing
 * trust dialog still stands between it and a shell.
 */
export async function planActionMigration(
  repoPath: string,
  homeDir: string,
  projectId: string,
): Promise<ActionMigrationPlan> {
  const source = await readActionsDocument(projectPorcelainPath(repoPath, PROJECT_FILES.actions))
  const destination = await readActionsDocument(projectActionsPath(homeDir, projectId))
  const ids = new Set(destination.actions.map((action) => action.id))
  const titles = new Set(destination.actions.map((action) => action.title.toLowerCase()))

  const incoming: ActionsFileAction[] = []
  const duplicates: ActionsFileAction[] = []
  let order = destination.actions.reduce((max, action) => Math.max(max, action.order), -1)
  for (const action of source.actions) {
    if (ids.has(action.id) || titles.has(action.title.toLowerCase())) {
      duplicates.push(action)
      continue
    }
    ids.add(action.id)
    titles.add(action.title.toLowerCase())
    order += 1
    incoming.push({ ...action, order })
  }
  return {
    incoming,
    duplicates,
    merged:
      incoming.length === 0
        ? null
        : { version: destination.version, actions: [...destination.actions, ...incoming] },
  }
}

export async function writeActionsDocument(
  homeDir: string,
  projectId: string,
  document: ActionsFileV1,
): Promise<void> {
  await writeJsonAtomically(
    projectActionsPath(homeDir, projectId),
    JSON.parse(serializeActionsFileV1(document)),
  )
}

// --- Overrides ---------------------------------------------------------------

export type PrivateOverrides = {
  hiddenPaths: string[]
  pinnedPaths: string[]
  worktrees: Record<string, { setup: { startScript: string; disposeScript: string } }>
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry !== '')
}

export async function readRepoScope(
  repoPath: string,
): Promise<{ hiddenPaths: string[]; pinnedPaths: string[] }> {
  const raw = await readJsonFile(projectPorcelainPath(repoPath, PROJECT_FILES.scope))
  if (!isRecord(raw)) return { hiddenPaths: [], pinnedPaths: [] }
  return { hiddenPaths: stringList(raw.hiddenPaths), pinnedPaths: stringList(raw.pinnedPaths) }
}

export async function readPrivateOverrides(
  homeDir: string,
  projectId: string,
): Promise<PrivateOverrides> {
  const value = await readJsonEnvelope(projectOverridesPath(homeDir, projectId))
  if (!isRecord(value)) return { hiddenPaths: [], pinnedPaths: [], worktrees: {} }
  return {
    hiddenPaths: stringList(value.hiddenPaths),
    pinnedPaths: stringList(value.pinnedPaths),
    worktrees: isRecord(value.worktrees) ? (value.worktrees as PrivateOverrides['worktrees']) : {},
  }
}

export async function writePrivateOverrides(
  homeDir: string,
  projectId: string,
  overrides: PrivateOverrides,
): Promise<void> {
  await writeJsonEnvelope(projectOverridesPath(homeDir, projectId), overrides)
}

/** Union, source order preserved, existing entries first — never a replace. */
export function mergeOverrides(
  current: PrivateOverrides,
  scope: { hiddenPaths: readonly string[]; pinnedPaths: readonly string[] },
): { next: PrivateOverrides; added: number } {
  const hidden = [...current.hiddenPaths]
  const pinned = [...current.pinnedPaths]
  let added = 0
  for (const path of scope.hiddenPaths) {
    if (hidden.includes(path)) continue
    hidden.push(path)
    added += 1
  }
  for (const path of scope.pinnedPaths) {
    if (pinned.includes(path)) continue
    pinned.push(path)
    added += 1
  }
  return { next: { hiddenPaths: hidden, pinnedPaths: pinned, worktrees: current.worktrees }, added }
}

/** Legacy channels with no owner in the new model — reported, never copied. */
export const RETIRED_CHANNELS = [
  {
    file: PROJECT_FILES.layers,
    reason: 'flow layers are retired; the Canvas replaces the Changes-tab story',
  },
  {
    file: PROJECT_FILES.notes,
    reason: 'repo notes are retired; agent instructions belong in AGENTS.md',
  },
] as const

export async function retiredChannelsPresent(
  repoPath: string,
): Promise<{ file: string; reason: string }[]> {
  const present: { file: string; reason: string }[] = []
  for (const channel of RETIRED_CHANNELS) {
    const raw = await readTextFile(projectPorcelainPath(repoPath, channel.file))
    if (raw !== null && raw.trim() !== '')
      present.push({ file: channel.file, reason: channel.reason })
  }
  return present
}
