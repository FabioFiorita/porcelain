import { actionsProcedures } from './actions'
import { filesProcedures } from './files'
import { gitProcedures } from './git'
import { projectDataProcedures } from './project-data'
import { projectsProcedures } from './projects'
import { remoteProcedures } from './remote'
import { searchProcedures } from './search'
import { tasksProcedures } from './tasks'
import { terminalProcedures } from './terminal'

/**
 * The only public procedure truth: the ten domain records composed into one flat frozen catalog.
 * Names, kinds, and schemas are owned by the domain records; nothing here is manufactured locally.
 *
 */
export const procedureCatalog = Object.freeze({
  ...remoteProcedures,
  ...projectsProcedures,
  ...filesProcedures,
  ...searchProcedures,
  ...gitProcedures,
  ...tasksProcedures,
  ...actionsProcedures,
  ...terminalProcedures,
  ...projectDataProcedures,
})

export type ProcedureName = keyof typeof procedureCatalog
