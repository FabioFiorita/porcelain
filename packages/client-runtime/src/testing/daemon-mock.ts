/**
 * Transport-independent validating daemon mock for client tests.
 *
 * Web and mobile adapters translate their framework request shape into `DaemonMockRequest`;
 * this mock owns contract validation only — no React, tRPC, WebSocket, app, or daemon imports.
 * Handlers configure outcomes without reimplementing daemon domain rules.
 */

/** One public procedure invocation as the mock receives it from a transport adapter. */
export type DaemonMockRequest = {
  readonly procedure: string
  readonly kind: 'query' | 'mutation'
  readonly input: unknown
}

/**
 * A configured handler result. Success and expected failure both pass through catalog schemas
 * before a client adapter can observe them.
 */
export type DaemonMockOutcome =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: unknown }

/** A notification value after the catalog notification schema has accepted it. */
export type DaemonMockNotification = unknown

type Parseable = {
  readonly parse: (data: unknown) => unknown
}

type DaemonMockProcedure = {
  readonly kind: 'query' | 'mutation'
  readonly input: Parseable
  readonly output: Parseable
}

type DaemonMockCatalog = {
  readonly procedures: Readonly<Record<string, DaemonMockProcedure>>
  readonly notification: Parseable
  readonly publicError: Parseable
}

type DaemonMockHandler = (input: unknown) => DaemonMockOutcome | Promise<DaemonMockOutcome>

export type ValidatingDaemonMock = {
  readonly dispatch: (request: DaemonMockRequest) => Promise<DaemonMockOutcome>
  readonly emit: (notification: unknown) => DaemonMockNotification
  readonly subscribe: (listener: (notification: DaemonMockNotification) => void) => () => void
  readonly requests: () => readonly DaemonMockRequest[]
  readonly clearRequests: () => void
}

/**
 * Create a mock that validates every request input, success output, expected public error, and
 * notification against the supplied catalog. Malformed configured outcomes throw before any
 * client adapter receives them.
 */
export function createValidatingDaemonMock(
  catalog: DaemonMockCatalog,
  handlers: Readonly<Record<string, DaemonMockHandler>>,
): ValidatingDaemonMock {
  const recorded: DaemonMockRequest[] = []
  const listeners = new Set<(notification: DaemonMockNotification) => void>()

  return {
    async dispatch(request) {
      const procedure = catalog.procedures[request.procedure]
      if (procedure === undefined) {
        throw new Error(`Unknown daemon mock procedure: ${request.procedure}`)
      }
      if (procedure.kind !== request.kind) {
        throw new Error(
          `Daemon mock procedure ${request.procedure} is a ${procedure.kind}, not a ${request.kind}`,
        )
      }

      const input = procedure.input.parse(request.input)
      const recordedRequest: DaemonMockRequest = {
        procedure: request.procedure,
        kind: request.kind,
        input,
      }
      recorded.push(recordedRequest)

      const handler = handlers[request.procedure]
      if (handler === undefined) {
        throw new Error(`No daemon mock handler for procedure: ${request.procedure}`)
      }

      const outcome = await handler(input)
      if (outcome.ok) {
        const value = procedure.output.parse(outcome.value)
        return { ok: true, value }
      }
      const error = catalog.publicError.parse(outcome.error)
      return { ok: false, error }
    },

    emit(notification) {
      const parsed = catalog.notification.parse(notification)
      for (const listener of listeners) {
        listener(parsed)
      }
      return parsed
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    requests() {
      return recorded.slice()
    },

    clearRequests() {
      recorded.length = 0
    },
  }
}
