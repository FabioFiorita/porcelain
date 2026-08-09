import type { ProcedureKind } from './procedure-contract'
import type { ProcedureName } from './procedures/names'

export type ProcedureDomain =
  | 'remote'
  | 'projects'
  | 'files'
  | 'search'
  | 'git'
  | 'review'
  | 'board'
  | 'actions'
  | 'terminal'
  | 'project-data'

export type UnmigratedProcedure = Readonly<{
  name: ProcedureName
  kind: ProcedureKind
}>

/**
 * Transitional ownership ledger. CON-002 through CON-011 remove only their own entries;
 * CON-012 deletes this file once every domain record is complete.
 */
export const unmigratedProcedureLedger = {
  remote: [],
  projects: [],
  files: [],
  search: [],
  git: [],
  review: [],
  board: [],
  actions: [],
  terminal: [],
  'project-data': [],
} as const satisfies Readonly<Record<ProcedureDomain, readonly UnmigratedProcedure[]>>

export const unmigratedProcedureNames: readonly ProcedureName[] = Object.freeze(
  Object.values(unmigratedProcedureLedger).flatMap((entries) => entries.map(({ name }) => name)),
)
