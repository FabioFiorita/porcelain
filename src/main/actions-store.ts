import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { z } from 'zod'

/**
 * The saved-actions channel: named, runnable commands the human launches in the
 * embedded terminal with one click, keyed by absolute repo path, in
 * `~/.porcelain/actions.json` (same fixed home-dir location + rationale as the
 * review-set / comment / board channels). TWO-WAY: the app authors actions (add/
 * edit/delete here) and the MCP server (src/mcp/action-file.ts) does the same — so
 * the agent can curate useful commands for the human to run. Atomic (tmp + rename)
 * + in-process-serialized writes; a cross-process race is rare/low-stakes and the
 * watcher re-syncs.
 *
 * SECURITY: an action's `command` is a shell command the HUMAN executes by clicking
 * (never the agent — there is no MCP run tool, and nothing here executes a command).
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

export function actionsPath(): string {
  // Must match src/mcp/action-file.ts. PORCELAIN_ACTIONS redirects both sides for tests.
  return process.env.PORCELAIN_ACTIONS ?? join(homedir(), '.porcelain', 'actions.json')
}

async function readAll(): Promise<Actions> {
  try {
    return actionsSchema.parse(JSON.parse(await readFile(actionsPath(), 'utf8')))
  } catch {
    return {}
  }
}

async function writeAll(all: Actions): Promise<void> {
  const path = actionsPath()
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(all, null, 2))
  await rename(tmp, path)
}

let chain: Promise<void> = Promise.resolve()
function mutate<T>(fn: (all: Actions) => T): Promise<T> {
  const run = chain.then(async () => {
    const all = await readAll()
    const result = fn(all)
    await writeAll(all)
    return result
  })
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

/** The actions for a repo, sorted by creation order (oldest first). */
export async function readActions(repoPath: string): Promise<Action[]> {
  const actions = (await readAll())[repoPath] ?? []
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
  await mutate((all) => {
    all[repoPath] = [...(all[repoPath] ?? []), action]
  })
  return action
}

export async function updateAction(
  repoPath: string,
  id: string,
  fields: { title?: string; command?: string; cwd?: string },
): Promise<void> {
  await mutate((all) => {
    const action = all[repoPath]?.find((a) => a.id === id)
    if (!action) return
    if (fields.title !== undefined) action.title = fields.title
    if (fields.command !== undefined) action.command = fields.command
    if (fields.cwd !== undefined) action.cwd = fields.cwd || undefined
  })
}

export async function deleteAction(repoPath: string, id: string): Promise<void> {
  await mutate((all) => {
    const actions = all[repoPath]
    if (actions) all[repoPath] = actions.filter((a) => a.id !== id)
  })
}
