import { tasksProcedures } from '@porcelain/contracts/tasks'

import { namedContractProcedure } from '@/lib/daemon/procedure'

/**
 * The Tasks wire vocabulary, bound to the mobile transport.
 *
 * Names come from `tasksProcedures`' own keys so a renamed procedure is a type error here
 * rather than a 404 at runtime. Nothing else in this feature writes a procedure name.
 */

export const listTasksProcedure = namedContractProcedure('listTasks', tasksProcedures.listTasks)
export const createTaskProcedure = namedContractProcedure('createTask', tasksProcedures.createTask)
export const updateTaskProcedure = namedContractProcedure('updateTask', tasksProcedures.updateTask)
export const getTaskAttachmentProcedure = namedContractProcedure(
  'getTaskAttachment',
  tasksProcedures.getTaskAttachment,
)
