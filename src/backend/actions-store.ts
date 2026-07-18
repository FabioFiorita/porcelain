import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createHomeChannel } from './home-channel'

/**
 * The saved-actions channel: named, runnable commands the human launches in the
 * embedded terminal with one click, keyed by absolute repo path, in
 * `~/.porcelain/actions.json` (same fixed home-dir location + rationale as the
 * review-set / comment / board channels). TWO-WAY: the app authors actions (add/
 * edit/delete here) and the porcelain CLI (src/cli/action-file.ts) does the same — so
 * the agent can curate useful commands for the human to run. Atomic (tmp + rename)
 * + in-process-serialized writes; a cross-process race is rare/low-stakes and the
 * watcher re-syncs.
 *
 * SECURITY: an action's `command` is a shell command the HUMAN executes by clicking
 * (never the agent — there is no CLI run command, and nothing here executes a command).
 * The full text is always shown before it runs (see the audit skill). This file only
 * stores definitions.
 */
export const actionSchema = z.object({
  id: z.string(),
  title: z.string(),
  command: z.string(),
  /** Working directory for the command; repo-relative or absolute. Omitted ⇒ repo root. */
  cwd: z.string().optional(),
  /** Sort key; set on create so newer actions land at the end. */
  order: z.number().default(0),
  createdAt: z.number().default(0),
})
export type Action = z.infer<typeof actionSchema>

export const actionsSchema = z.record(z.string(), z.array(actionSchema))
export type Actions = z.infer<typeof actionsSchema>

const channel = createHomeChannel({
  envVar: 'PORCELAIN_ACTIONS',
  fileName: 'actions.json',
  schema: actionsSchema,
  empty: (): Actions => ({}),
})

// Must match src/cli/action-file.ts. PORCELAIN_ACTIONS redirects both sides for tests.
export const actionsPath = channel.path

/** The actions for a repo, sorted by creation order (oldest first). */
export async function readActions(repoPath: string): Promise<Action[]> {
  const actions = (await channel.readAll())[repoPath] ?? []
  return [...actions].sort((a, b) => a.order - b.order)
}

export interface NewAction {
  title: string
  command: string
  cwd?: string
}

export async function addAction(repoPath: string, input: NewAction): Promise<Action> {
  const now = Date.now()
  const action: Action = {
    id: randomUUID(),
    title: input.title,
    command: input.command,
    order: now,
    createdAt: now,
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
  }
  await channel.mutate((all) => {
    all[repoPath] = [...(all[repoPath] ?? []), action]
  })
  return action
}

export async function updateAction(
  repoPath: string,
  id: string,
  fields: { title?: string; command?: string; cwd?: string },
): Promise<void> {
  await channel.mutate((all) => {
    const action = all[repoPath]?.find((a) => a.id === id)
    if (!action) return
    if (fields.title !== undefined) action.title = fields.title
    if (fields.command !== undefined) action.command = fields.command
    if (fields.cwd !== undefined) action.cwd = fields.cwd || undefined
  })
}

/**
 * Move an action one slot up or down within its repo by swapping `order` with its
 * neighbour (the list is rendered sorted by `order`). No-op at the ends or if unknown.
 */
export async function moveAction(
  repoPath: string,
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  await channel.mutate((all) => {
    const actions = all[repoPath]
    if (!actions) return
    const sorted = [...actions].sort((a, b) => a.order - b.order)
    const index = sorted.findIndex((a) => a.id === id)
    if (index === -1) return
    const target = index + (direction === 'up' ? -1 : 1)
    if (target < 0 || target >= sorted.length) return
    const current = sorted[index]
    const neighbour = sorted[target]
    const tmp = current.order
    current.order = neighbour.order
    neighbour.order = tmp
  })
}

export async function deleteAction(repoPath: string, id: string): Promise<void> {
  await channel.mutate((all) => {
    const actions = all[repoPath]
    if (actions) all[repoPath] = actions.filter((a) => a.id !== id)
  })
}

/** Whole-set replace for a repo (user-initiated seed / path remap). Empty drops the entry. */
export async function writeActions(repoPath: string, actions: Action[]): Promise<void> {
  await channel.mutate((all) => {
    if (actions.length === 0) delete all[repoPath]
    else all[repoPath] = actions
  })
}
