import {
  createValidatingDaemonMock,
  type DaemonMockOutcome,
  type ValidatingDaemonMock,
} from '@porcelain/client-runtime/testing/daemon-mock'
import { procedureCatalog, publicErrorSchema } from '@porcelain/contracts'
import { boardContractFixtures } from '@porcelain/contracts/board'
import { sessionChangeSchema } from '@porcelain/contracts/session'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TRPCClientError } from '@trpc/client'
import type { ReactNode } from 'react'

/**
 * Mobile Board test support (BRD-005).
 *
 * Transport-independent validating mock (TST-001) + QueryClient wrapper. Feature tests
 * never reimplement Board daemon rules; handlers configure outcomes only.
 *
 * Types here are structural — they intentionally do not import `@/lib/daemon/*` so the
 * feature-boundary Biome rule stays honest for production and test modules alike.
 */

export const REPO = boardContractFixtures.listBoardCards.input
export const CARDS = boardContractFixtures.listBoardCards.output
export const ENV_ID = 'env-board-test'

export type TestDaemonClient = {
  query: (procedure: string, input: unknown) => Promise<unknown>
  mutation: (procedure: string, input: unknown) => Promise<unknown>
}

export type TestPairedEnvironment = {
  id: string
  nickname: string
  icon: 'desktop' | 'terminal' | 'notebook'
  baseUrl: string
  endpoints: string[]
  preferredEndpoint: string
  createdAt: number
  activeRepoPath: string | null
  token: string
}

export const PAIRED_ENV: TestPairedEnvironment = {
  id: ENV_ID,
  nickname: 'test',
  icon: 'desktop',
  baseUrl: 'http://127.0.0.1:43118',
  endpoints: ['http://127.0.0.1:43118'],
  preferredEndpoint: 'http://127.0.0.1:43118',
  createdAt: 1,
  activeRepoPath: REPO,
  token: 'pc_client_test',
}

const validatingCatalog = {
  procedures: procedureCatalog,
  notification: sessionChangeSchema,
  publicError: publicErrorSchema,
} as const

export type DaemonMockHandlers = Readonly<
  Record<string, (input: unknown) => DaemonMockOutcome | Promise<DaemonMockOutcome>>
>

/** A promise the test settles by hand. */
export function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
} {
  const { promise, resolve, reject } = Promise.withResolvers<T>()
  return { promise, resolve, reject }
}

function publicErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }
  return 'Daemon mock public error'
}

/** Translate a mock outcome into the untyped tRPC client shape mobile callDaemon uses. */
export function clientFromMock(mock: ValidatingDaemonMock): TestDaemonClient {
  const dispatch = async (
    kind: 'query' | 'mutation',
    procedure: string,
    input: unknown,
  ): Promise<unknown> => {
    const outcome = await mock.dispatch({ procedure, kind, input })
    if (!outcome.ok) {
      throw TRPCClientError.from(
        Object.assign(new Error(publicErrorMessage(outcome.error)), {
          data: {
            code: 'INTERNAL_SERVER_ERROR',
            httpStatus: 500,
            porcelain: outcome.error,
          },
        }),
      )
    }
    return outcome.value
  }

  return {
    query: (procedure: string, input: unknown) => dispatch('query', procedure, input),
    mutation: (procedure: string, input: unknown) => dispatch('mutation', procedure, input),
  }
}

/** Default Board procedure handlers for presentation tests. */
export function defaultBoardHandlers(overrides: DaemonMockHandlers = {}): DaemonMockHandlers {
  return {
    listBoardCards: () => ({ ok: true, value: [...CARDS] }),
    createBoardCard: () => ({ ok: true, value: boardContractFixtures.createBoardCard.output }),
    updateBoardCard: () => ({ ok: true, value: boardContractFixtures.updateBoardCard.output }),
    moveBoardCard: () => ({ ok: true, value: boardContractFixtures.moveBoardCard.output }),
    deleteBoardCard: () => ({ ok: true, value: boardContractFixtures.deleteBoardCard.output }),
    clearBoardColumn: () => ({ ok: true, value: boardContractFixtures.clearBoardColumn.output }),
    ...overrides,
  }
}

export function createBoardHarness(handlers: DaemonMockHandlers = {}): {
  readonly mock: ValidatingDaemonMock
  readonly client: TestDaemonClient
  readonly queryClient: QueryClient
  readonly wrapper: (props: { children: ReactNode }) => React.JSX.Element
} {
  const mock = createValidatingDaemonMock(validatingCatalog, defaultBoardHandlers(handlers))
  const client = clientFromMock(mock)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { mock, client, queryClient, wrapper }
}
