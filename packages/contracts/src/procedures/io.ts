import { z } from 'zod'
import { PROCEDURE_NAMES, type ProcedureName } from './names'
import { type ProcedureIo, refinedProcedureIo } from './refined'

export type { ProcedureIo }

/**
 * Full public procedure I/O surface. Every daemon procedure has an entry.
 * Refined zod lives in refined.ts (shared with mobile descriptors); everything
 * else uses unknown until a second client needs a precise shape.
 */

const unknownIo: ProcedureIo = { input: z.unknown(), output: z.unknown() }

export const procedureIo: Record<ProcedureName, ProcedureIo> = Object.fromEntries(
  PROCEDURE_NAMES.map((name) => {
    const refined = refinedProcedureIo[name]
    return [name, refined ?? unknownIo] as const
  }),
) as Record<ProcedureName, ProcedureIo>

export function procedureNames(): readonly ProcedureName[] {
  return PROCEDURE_NAMES
}
