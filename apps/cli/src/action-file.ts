import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  type ActionsFileAction,
  ActionsFileParseError,
  type ActionsFileWhere,
  emptyActionsFileV1,
  parseActionsFileV1,
  planCreateAction,
  planDeleteAction,
  planUpdateAction,
  serializeActionsFileV1,
  sortActions,
} from '@porcelain/shared/actions-file'
import { PROJECT_FILES, projectPorcelainPath } from '@shared/project-porcelain'
import { ensureProjectDir } from './project-io'

// Builtins + @porcelain/shared only — see cli.ts. Project actions are strict v1 JSON.

export type ActionWhere = ActionsFileWhere
export type Action = ActionsFileAction

function actionsPath(repoPath: string): string {
  return projectPorcelainPath(repoPath, PROJECT_FILES.actions)
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'ENOENT'
  )
}

function readActionsFile(repoPath: string): ReturnType<typeof emptyActionsFileV1> {
  let raw: string
  try {
    raw = readFileSync(actionsPath(repoPath), 'utf8')
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

function writeActionsFile(repoPath: string, file: ReturnType<typeof emptyActionsFileV1>): void {
  ensureProjectDir(repoPath)
  const path = actionsPath(repoPath)
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, serializeActionsFileV1(file))
  renameSync(tmp, path)
}

export function readActions(repoPath: string): Action[] {
  return sortActions(readActionsFile(repoPath).actions)
}

export function createAction(
  repoPath: string,
  title: string,
  command: string,
  where: ActionWhere | undefined,
): Action {
  const now = Date.now()
  const planned = planCreateAction(readActionsFile(repoPath), {
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
  writeActionsFile(repoPath, planned.file)
  return planned.action
}

export function updateAction(
  repoPath: string,
  id: string,
  fields: { title?: string; command?: string; where?: ActionWhere },
): boolean {
  const planned = planUpdateAction(readActionsFile(repoPath), {
    actionId: id,
    title: fields.title,
    command: fields.command,
    where: fields.where,
  })
  if (!planned.ok) {
    if (planned.error.code === 'actions.not-found') return false
    throw new Error('title or command is invalid (blank or too long)')
  }
  writeActionsFile(repoPath, planned.file)
  return true
}

export function deleteAction(repoPath: string, id: string): boolean {
  const planned = planDeleteAction(readActionsFile(repoPath), { actionId: id })
  if (!planned.ok) return false
  writeActionsFile(repoPath, planned.file)
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
