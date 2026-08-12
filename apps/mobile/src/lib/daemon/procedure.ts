import type { z } from 'zod'

import type { DaemonClient } from './client'
import { toDaemonError } from './errors'

/**
 * A procedure the app knows how to call. Compatible with:
 * - hand-authored `defineQuery` / `defineMutation` descriptors (`name` + `output`)
 * - BRD-001 structural contract descriptors composed with their catalog name
 *   (`kind` + `input` schema + `output` + `errors` + `name`)
 *
 * `TInput` remains a phantom generic for call-site inference when no runtime input
 * schema is present. When `input` is a Zod schema (contract descriptors), callDaemon
 * parses input at the boundary before transport; output is always parsed.
 */
export type DaemonQuery<TInput, TOutput> = {
  readonly kind: 'query'
  readonly name: string
  readonly output: z.ZodType<TOutput>
  readonly input?: z.ZodType<TInput>
  readonly errors?: readonly string[]
}

export type DaemonMutation<TInput, TOutput> = {
  readonly kind: 'mutation'
  readonly name: string
  readonly output: z.ZodType<TOutput>
  readonly input?: z.ZodType<TInput>
  readonly errors?: readonly string[]
}

export type DaemonProcedure<TInput, TOutput> =
  | DaemonQuery<TInput, TOutput>
  | DaemonMutation<TInput, TOutput>

/**
 * Compose a catalog procedure name with a BRD-001 `ProcedureContract` into the
 * structural shape the mobile transport accepts. Domain feature adapters own the
 * name + contract pairing; this module never declares domain schemas or names.
 */
export function namedContractProcedure<TInput, TOutput>(
  name: string,
  contract: {
    readonly kind: 'query' | 'mutation'
    readonly input: z.ZodType<TInput>
    readonly output: z.ZodType<TOutput>
    readonly errors: readonly string[]
  },
): DaemonProcedure<TInput, TOutput> {
  return {
    kind: contract.kind,
    name,
    input: contract.input,
    output: contract.output,
    errors: contract.errors,
  }
}

/** The read form of {@link namedContractProcedure}, for the hooks that need a `DaemonQuery`. */
export function namedContractQuery<TInput, TOutput>(
  name: string,
  contract: {
    readonly kind: 'query'
    readonly input: z.ZodType<TInput>
    readonly output: z.ZodType<TOutput>
    readonly errors: readonly string[]
  },
): DaemonQuery<TInput, TOutput> {
  return {
    kind: 'query',
    name,
    input: contract.input,
    output: contract.output,
    errors: contract.errors,
  }
}

/** The write form of {@link namedContractProcedure}, for the hooks that need a `DaemonMutation`. */
export function namedContractMutation<TInput, TOutput>(
  name: string,
  contract: {
    readonly kind: 'mutation'
    readonly input: z.ZodType<TInput>
    readonly output: z.ZodType<TOutput>
    readonly errors: readonly string[]
  },
): DaemonMutation<TInput, TOutput> {
  return {
    kind: 'mutation',
    name,
    input: contract.input,
    output: contract.output,
    errors: contract.errors,
  }
}

export function defineQuery<TInput, TOutput>(
  name: string,
  output: z.ZodType<TOutput>,
): DaemonQuery<TInput, TOutput> {
  return { kind: 'query', name, output }
}

export function defineMutation<TInput, TOutput>(
  name: string,
  output: z.ZodType<TOutput>,
): DaemonMutation<TInput, TOutput> {
  return { kind: 'mutation', name, output }
}

/** Call outside React (bootstrap, session hello). Parses the response; throws `DaemonError`. */
export async function callDaemon<TInput, TOutput>(
  client: DaemonClient,
  procedure: DaemonProcedure<TInput, TOutput>,
  input: TInput,
): Promise<TOutput> {
  try {
    const validatedInput = procedure.input !== undefined ? procedure.input.parse(input) : input
    const raw =
      procedure.kind === 'query'
        ? await client.query(procedure.name, validatedInput)
        : await client.mutation(procedure.name, validatedInput)
    return procedure.output.parse(raw)
  } catch (cause) {
    throw toDaemonError(procedure.name, cause)
  }
}
