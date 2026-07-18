import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

// Builtins only — see cli.ts. The saved-actions channel: named, runnable
// commands the human (Porcelain app, actions-store.ts) launches in the embedded
// terminal, and the agent (here) can curate. The agent CRUDs definitions only — it
// never executes one (no run tool). Atomic writes (tmp + rename); the app re-validates
// with zod on read.

export interface Action {
  id: string
  title: string
  command: string
  cwd?: string
  order: number
  createdAt: number
}

type Actions = Record<string, Action[]>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function actionsPath(): string {
  return process.env.PORCELAIN_ACTIONS ?? join(homedir(), '.porcelain', 'actions.json')
}

function parseActions(value: unknown): Action[] {
  if (!Array.isArray(value)) return []
  const actions: Action[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    if (
      typeof item.id !== 'string' ||
      typeof item.title !== 'string' ||
      typeof item.command !== 'string'
    ) {
      continue
    }
    const action: Action = {
      id: item.id,
      title: item.title,
      command: item.command,
      order: typeof item.order === 'number' ? item.order : 0,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0,
    }
    if (typeof item.cwd === 'string') action.cwd = item.cwd
    actions.push(action)
  }
  return actions
}

function readAll(): Actions {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(actionsPath(), 'utf8'))
  } catch {
    return {}
  }
  if (!isRecord(parsed)) return {}
  const all: Actions = {}
  for (const [repoPath, value] of Object.entries(parsed)) all[repoPath] = parseActions(value)
  return all
}

function writeAll(all: Actions): void {
  const path = actionsPath()
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(all, null, 2))
  renameSync(tmp, path)
}

export function readActions(repoPath: string): Action[] {
  const actions = readAll()[repoPath] ?? []
  return [...actions].sort((a, b) => a.order - b.order)
}

export function createAction(
  repoPath: string,
  title: string,
  command: string,
  cwd: string | undefined,
): Action {
  const now = Date.now()
  const action: Action = { id: randomUUID(), title, command, order: now, createdAt: now }
  if (cwd !== undefined) action.cwd = cwd
  const all = readAll()
  all[repoPath] = [...(all[repoPath] ?? []), action]
  writeAll(all)
  return action
}

export function updateAction(
  repoPath: string,
  id: string,
  fields: { title?: string; command?: string; cwd?: string },
): boolean {
  const all = readAll()
  const action = all[repoPath]?.find((a) => a.id === id)
  if (!action) return false
  if (fields.title !== undefined) action.title = fields.title
  if (fields.command !== undefined) action.command = fields.command
  if (fields.cwd !== undefined) action.cwd = fields.cwd || undefined
  writeAll(all)
  return true
}

export function deleteAction(repoPath: string, id: string): boolean {
  const all = readAll()
  const actions = all[repoPath]
  if (!actions?.some((a) => a.id === id)) return false
  all[repoPath] = actions.filter((a) => a.id !== id)
  writeAll(all)
  return true
}

/** Render the actions for `list_actions`: each with id, title, command, and cwd. */
export function describeActions(repoPath: string, actions: Action[]): string {
  if (actions.length === 0) {
    return `No saved actions for ${repoPath}. Actions are named commands the human runs in Porcelain's embedded terminal with one click; add useful ones (dev server, storybook, test watcher) here and they appear in the app.`
  }
  const lines: string[] = [`Saved actions for ${repoPath} (${actions.length}):`]
  for (const action of actions) {
    lines.push(
      `- [${action.id}] ${action.title}\n    $ ${action.command}${action.cwd ? `  (cwd: ${action.cwd})` : ''}`,
    )
  }
  return lines.join('\n')
}
