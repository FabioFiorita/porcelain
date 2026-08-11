/**
 * Deferred bound-operation stub for narrow router mapping tests.
 *
 * Conventions (copy in later domain migrations):
 * - Router tests stub only the one bound operation under test via
 *   `createDeferredOperationStub` and pass `stub.operation` through the
 *   construction seam (`createDaemonRouter({ operations: { … } })`). Never
 *   `vi.mock` a router, store, or operation module for that purpose.
 * - Operation tests construct domain-specific capability fakes and primarily
 *   assert returned results and durable state, not interaction graphs.
 * - Adapter tests construct real adapters inside `withTemporaryDirectory` so
 *   filesystem semantics (atomic rename, corruption, limits) stay real.
 */

export interface RecordedCall<Input> {
  input: Input
}

export interface DeferredOperationStub<Input, Output> {
  readonly calls: readonly RecordedCall<Input>[]
  readonly operation: (input: Input) => Promise<Output>
  resolve(value: Output): void
  reject(error: Error): void
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  Object.freeze(value)
  for (const key of Reflect.ownKeys(value as object)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key])
  }
  return value
}

/**
 * One-call-at-a-time deferred stub. Starts unresolved; each `operation` call
 * records a structuredClone deep-frozen input and waits for the next
 * `resolve`/`reject`. Settlement consumes the pending deferred so a later call
 * may begin.
 */
export function createDeferredOperationStub<Input, Output>(): DeferredOperationStub<Input, Output> {
  const calls: RecordedCall<Input>[] = []
  let pending: {
    resolve: (value: Output) => void
    reject: (error: Error) => void
  } | null = null

  return {
    get calls() {
      return calls
    },
    operation(input) {
      if (pending !== null) {
        throw new Error('OperationFake may serve one pending call at a time')
      }
      const recorded = deepFreeze(structuredClone(input)) as Input
      calls.push({ input: recorded })
      return new Promise<Output>((resolve, reject) => {
        pending = { resolve, reject }
      })
    },
    resolve(value) {
      if (pending === null) {
        throw new Error('OperationFake has no pending call to resolve')
      }
      const settle = pending
      pending = null
      settle.resolve(value)
    },
    reject(error) {
      if (pending === null) {
        throw new Error('OperationFake has no pending call to reject')
      }
      const settle = pending
      pending = null
      settle.reject(error)
    },
  }
}
