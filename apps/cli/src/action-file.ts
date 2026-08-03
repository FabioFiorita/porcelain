import { randomUUID } from 'node:crypto'
import { PROJECT_FILES } from '@shared/project-porcelain'
import { readProjectJson, writeProjectJson } from './project-io'

// Saved actions in <repo>/.porcelain/actions.json — agent curates, human runs.

export type ActionWhere = 'primary' | 'local'

export interface Action {
  id: string
  title: string
  command: string
  where?: ActionWhere
  order: number
  createdAt: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseWhere(value: unknown): ActionWhere | undefined {
  if (value === 'primary' || value === 'local') return value
  return undefined
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
    const where = parseWhere(item.where)
    if (where !== undefined && where !== 'primary') action.where = where
    actions.push(action)
  }
  return actions
}

function readAll(repoPath: string): Action[] {
  return parseActions(readProjectJson(repoPath, PROJECT_FILES.actions))
}

function writeAll(repoPath: string, actions: Action[]): void {
  writeProjectJson(repoPath, PROJECT_FILES.actions, actions)
}

export function readActions(repoPath: string): Action[] {
  return [...readAll(repoPath)].sort((a, b) => a.order - b.order)
}

export function createAction(
  repoPath: string,
  title: string,
  command: string,
  where: ActionWhere | undefined,
): Action {
  const now = Date.now()
  const action: Action = { id: randomUUID(), title, command, order: now, createdAt: now }
  if (where !== undefined && where !== 'primary') action.where = where
  writeAll(repoPath, [...readAll(repoPath), action])
  return action
}

export function updateAction(
  repoPath: string,
  id: string,
  fields: { title?: string; command?: string; where?: ActionWhere },
): boolean {
  const actions = readAll(repoPath)
  const action = actions.find((a) => a.id === id)
  if (!action) return false
  if (fields.title !== undefined) action.title = fields.title
  if (fields.command !== undefined) action.command = fields.command
  if (fields.where !== undefined) {
    if (fields.where === 'primary') delete action.where
    else action.where = fields.where
  }
  writeAll(repoPath, actions)
  return true
}

export function deleteAction(repoPath: string, id: string): boolean {
  const actions = readAll(repoPath)
  if (!actions.some((a) => a.id === id)) return false
  writeAll(
    repoPath,
    actions.filter((a) => a.id !== id),
  )
  return true
}

export function describeActions(repoPath: string, actions: Action[]): string {
  if (actions.length === 0) {
    return `No saved actions for ${repoPath}. Actions are named commands the human runs in Porcelain's embedded terminal; add useful ones here (.porcelain/actions.json).`
  }
  const lines: string[] = [`Saved actions for ${repoPath} (${actions.length}):`]
  for (const action of actions) {
    const where = action.where === 'local' ? '  (where: local / this device)' : ''
    lines.push(`- [${action.id}] ${action.title}\n    $ ${action.command}${where}`)
  }
  return lines.join('\n')
}
