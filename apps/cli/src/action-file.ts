import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  type ActionsFileAction,
  ActionsFileParseError,
  type ActionsFileV1,
  type ActionsFileWhere,
  emptyActionsFileV1,
  parseActionsFileV1,
  planCreateAction,
  planDeleteAction,
  planUpdateAction,
  serializeActionsFileV1,
  sortActions,
} from '@porcelain/shared/actions-file'
import { porcelainHome } from '@shared/porcelain-home'
import { projectActionsPath } from '@shared/project-store'
import { resolveHubIdentity } from './canvas-file'

/**
 * Saved actions live in the owning daemon's Project store —
 * `$PORCELAIN_HOME/projects/<projectId>/actions.json` (ADR 0002) — not in the
 * checkout. Two reasons: an agent's `git worktree remove` must not take the
 * project's saved commands with it, and opening a repository in Porcelain must
 * not add application state to someone's working tree.
 *
 * The Project id comes from the same `hub-inventory.json` the daemon wrote when
 * the repo was first opened, matched through git plumbing — see
 * `resolveHubIdentity` in canvas-file.ts. A repository Porcelain has never
 * opened has no Project id yet, so writes fail with a clear message instead of
 * inventing one. Builtins + @porcelain/shared only (see cli.ts).
 */

export type ActionWhere = ActionsFileWhere
export type Action = ActionsFileAction

function actionsPath(repoPath: string): string {
  return projectActionsPath(porcelainHome(), resolveHubIdentity(repoPath).projectId)
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'ENOENT'
  )
}

function readActionsFile(path: string): ActionsFileV1 {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (error) {
    if (isEnoent(error)) return emptyActionsFileV1()
    throw error
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ActionsFileParseError('malformed', 'Actions file is not valid JSON')
  }

  // Legacy top-level array is not accepted — agents must use the v1 document.
  if (Array.isArray(parsed)) {
    throw new ActionsFileParseError(
      'malformed',
      'Actions file must be version 1 ({ version: 1, actions: [...] }); top-level arrays are not supported',
    )
  }

  return parseActionsFileV1(parsed)
}

function writeActionsFile(path: string, file: ActionsFileV1): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, serializeActionsFileV1(file))
  renameSync(tmp, path)
}

export function readActions(repoPath: string): Action[] {
  return sortActions(readActionsFile(actionsPath(repoPath)).actions)
}

export function createAction(
  repoPath: string,
  title: string,
  command: string,
  where: ActionWhere | undefined,
): Action {
  const path = actionsPath(repoPath)
  const now = Date.now()
  const planned = planCreateAction(readActionsFile(path), {
    id: randomUUID(),
    title,
    command,
    where,
    order: now,
    createdAt: now,
  })
  if (!planned.ok) {
    throw new Error(
      planned.error.code === 'request.invalid'
        ? 'title or command is invalid (blank or too long)'
        : 'could not create action',
    )
  }
  writeActionsFile(path, planned.file)
  return planned.action
}

export function updateAction(
  repoPath: string,
  id: string,
  fields: { title?: string; command?: string; where?: ActionWhere },
): boolean {
  const path = actionsPath(repoPath)
  const planned = planUpdateAction(readActionsFile(path), {
    actionId: id,
    title: fields.title,
    command: fields.command,
    where: fields.where,
  })
  if (!planned.ok) {
    if (planned.error.code === 'actions.not-found') return false
    throw new Error('title or command is invalid (blank or too long)')
  }
  writeActionsFile(path, planned.file)
  return true
}

export function deleteAction(repoPath: string, id: string): boolean {
  const path = actionsPath(repoPath)
  const planned = planDeleteAction(readActionsFile(path), { actionId: id })
  if (!planned.ok) return false
  writeActionsFile(path, planned.file)
  return true
}

export function describeActions(repoPath: string, actions: Action[]): string {
  if (actions.length === 0) {
    return `No saved actions for ${repoPath}. Actions are named commands the human runs in Porcelain's embedded terminal, stored with this Project in the daemon (not in the repo); add useful ones here.`
  }
  const lines: string[] = [`Saved actions for ${repoPath} (${actions.length}):`]
  for (const action of actions) {
    const where = action.where === 'local' ? '  (where: local / this device)' : ''
    lines.push(`- [${action.id}] ${action.title}\n    $ ${action.command}${where}`)
  }
  return lines.join('\n')
}
