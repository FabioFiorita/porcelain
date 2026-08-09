import { z } from 'zod'

export const TERMINAL_STATUS_VALUES = ['running', 'exited'] as const
export const terminalStatusSchema = z.enum(TERMINAL_STATUS_VALUES)
export type TerminalStatus = z.infer<typeof terminalStatusSchema>

/**
 * One entry of the daemon-owned terminal roster. `exitCode` exists only once the PTY has
 * exited, and `createdAt` defaults to 0 so a roster written before the field existed still
 * parses — the renderer sorts on it rather than trusting it as an identity.
 */
export const terminalInfoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    cwd: z.string(),
    status: terminalStatusSchema,
    exitCode: z.number().optional(),
    createdAt: z.number().default(0),
  })
  .strict()

export type TerminalInfo = z.infer<typeof terminalInfoSchema>

export const terminalSessionsInputSchema = z.void()
export const terminalSessionsOutputSchema = z.array(terminalInfoSchema)
export type TerminalSessionsInput = z.infer<typeof terminalSessionsInputSchema>
export type TerminalSessionsOutput = z.infer<typeof terminalSessionsOutputSchema>

/**
 * Rename accepts any string, including empty and whitespace-only names: the terminal manager
 * trims and ignores those, so constraining them here would change product behavior.
 */
export const renameTerminalInputSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .strict()
export const renameTerminalOutputSchema = z.void()
export type RenameTerminalInput = z.infer<typeof renameTerminalInputSchema>
export type RenameTerminalOutput = z.infer<typeof renameTerminalOutputSchema>

export { terminalContractFixtures } from './terminal.fixtures'
