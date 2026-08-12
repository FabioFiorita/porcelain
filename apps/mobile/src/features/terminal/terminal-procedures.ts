import { terminalMutations } from '@porcelain/client-runtime/terminal'
import { terminalProcedures } from '@porcelain/contracts/terminal'

import { namedContractProcedure } from '@/lib/daemon/procedure'

export const terminalSessionsProcedure = namedContractProcedure(
  'terminalSessions',
  terminalProcedures.terminalSessions,
)

export const renameTerminalProcedure = namedContractProcedure(
  terminalMutations.rename.procedureName,
  terminalMutations.rename.procedure,
)
