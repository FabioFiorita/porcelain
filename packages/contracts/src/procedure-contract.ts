import type { z } from 'zod'

export type ProcedureKind = 'query' | 'mutation'

export type ProcedureContract = {
  readonly kind: ProcedureKind
  readonly input: z.ZodType
  readonly output: z.ZodType
}
