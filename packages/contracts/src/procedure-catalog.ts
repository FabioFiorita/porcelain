import { actionsProcedures } from './actions'
import { boardProcedures } from './board'
import { filesProcedures } from './files'
import { gitProcedures } from './git'
import { projectDataProcedures } from './project-data'
import { projectsProcedures } from './projects'
import { remoteProcedures } from './remote'
import { reviewProcedures } from './review'
import { searchProcedures } from './search'
import { terminalProcedures } from './terminal'

export const procedureCatalog = Object.freeze({
  ...remoteProcedures,
  ...projectsProcedures,
  ...filesProcedures,
  ...searchProcedures,
  ...gitProcedures,
  ...reviewProcedures,
  ...boardProcedures,
  ...actionsProcedures,
  ...terminalProcedures,
  ...projectDataProcedures,
})
