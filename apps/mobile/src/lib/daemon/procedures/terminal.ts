import { z } from 'zod'

import { defineMutation, defineQuery } from '../procedure'

const terminalInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  cwd: z.string(),
  status: z.enum(['running', 'exited']),
  exitCode: z.number().optional(),
  createdAt: z.number().default(0),
})

const actionSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    command: z.string(),
    where: z.enum(['primary', 'local']).optional(),
    order: z.number().default(0),
    createdAt: z.number().default(0),
  })
  .strict()

export type TerminalInfo = z.infer<typeof terminalInfoSchema>
export type TerminalAction = z.infer<typeof actionSchema>

export const terminalSessionsQuery = defineQuery<void, TerminalInfo[]>(
  'terminalSessions',
  z.array(terminalInfoSchema),
)

export const renameTerminalMutation = defineMutation<{ id: string; name: string }, void>(
  'renameTerminal',
  z.void(),
)

export const actionsQuery = defineQuery<string, TerminalAction[]>('actions', z.array(actionSchema))
