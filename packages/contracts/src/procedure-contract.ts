import type { z } from 'zod'
import type { PublicErrorCode } from './errors'

export type ProcedureKind = 'query' | 'mutation'

export type ProcedureContract = {
  readonly kind: ProcedureKind
  readonly input: z.ZodType
  readonly output: z.ZodType
  readonly errors: readonly PublicErrorCode[]
}
