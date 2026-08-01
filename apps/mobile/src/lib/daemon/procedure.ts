import type { z } from 'zod'

import type { DaemonClient } from './client'
import { toDaemonError } from './errors'

/**
 * A procedure the app knows how to call. `TInput` is phantom — it exists so `useDaemonQuery`
 * infers the input from the descriptor instead of asking every call site for a type argument.
 * Input is authored here, so it is not an external seam and is not parsed; output always is.
 */
export type DaemonQuery<TInput, TOutput> = {
  readonly kind: 'query'
  readonly name: string
  readonly output: z.ZodType<TOutput>
  readonly input?: TInput
}

export type DaemonMutation<TInput, TOutput> = {
  readonly kind: 'mutation'
  readonly name: string
  readonly output: z.ZodType<TOutput>
  readonly input?: TInput
}

export type DaemonProcedure<TInput, TOutput> =
  | DaemonQuery<TInput, TOutput>
  | DaemonMutation<TInput, TOutput>

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
    const raw =
      procedure.kind === 'query'
        ? await client.query(procedure.name, input)
        : await client.mutation(procedure.name, input)
    return procedure.output.parse(raw)
  } catch (cause) {
    throw toDaemonError(procedure.name, cause)
  }
}
