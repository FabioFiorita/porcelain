import { actionsProcedures } from './actions'
import { boardLiveCatalogProcedures } from './board/board.procedures'
import { filesProcedures } from './files'
import { gitProcedures } from './git'
import { projectDataProcedures } from './project-data'
import { projectsProcedures } from './projects'
import { remoteProcedures } from './remote'
import { reviewProcedures } from './review'
import { searchProcedures } from './search'
import { terminalProcedures } from './terminal'

/**
 * The only public procedure truth: the ten domain records composed into one flat frozen catalog.
 * Names, kinds, and schemas are owned by the domain records; nothing here is manufactured locally.
 *
 * Board composes the live legacy six (`boardCards` … `clearBoardCards`) until BRD-002 swaps them
 * for the canonical `boardProcedures` (`listBoardCards` … `clearBoardColumn`). Canonical Board
 * declarations are exported from `@porcelain/contracts/board` but are not catalog members yet.
 */
export const procedureCatalog = Object.freeze({
  ...remoteProcedures,
  ...projectsProcedures,
  ...filesProcedures,
  ...searchProcedures,
  ...gitProcedures,
  ...reviewProcedures,
  ...boardLiveCatalogProcedures,
  ...actionsProcedures,
  ...terminalProcedures,
  ...projectDataProcedures,
})

export type ProcedureName = keyof typeof procedureCatalog
