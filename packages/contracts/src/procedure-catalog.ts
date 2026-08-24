import { actionsProcedures } from './actions'
import { filesProcedures } from './files'
import { gitProcedures } from './git'
import { projectDataProcedures } from './project-data'
import { projectsProcedures } from './projects'
import { remoteProcedures } from './remote'
import { reviewProcedures } from './review'
import { searchProcedures } from './search'
import { terminalProcedures } from './terminal'

/**
 * The only public procedure truth: the nine domain records composed into one flat frozen catalog.
 * Names, kinds, and schemas are owned by the domain records; nothing here is manufactured locally.
 *
 */
export const procedureCatalog = Object.freeze({
  ...remoteProcedures,
  ...projectsProcedures,
  ...filesProcedures,
  ...searchProcedures,
  ...gitProcedures,
  ...reviewProcedures,
  ...actionsProcedures,
  ...terminalProcedures,
  ...projectDataProcedures,
})

export type ProcedureName = keyof typeof procedureCatalog
