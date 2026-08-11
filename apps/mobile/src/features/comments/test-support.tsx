import {
  createValidatingDaemonMock,
  type DaemonMockOutcome,
  type ValidatingDaemonMock,
} from '@porcelain/client-runtime/testing/daemon-mock'
import { procedureCatalog, publicErrorSchema } from '@porcelain/contracts'
import { reviewContractFixtures } from '@porcelain/contracts/review'
import { sessionChangeSchema } from '@porcelain/contracts/session'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TRPCClientError } from '@trpc/client'
import type { ReactNode } from 'react'

/**
 * Mobile Review comments test support (RVC-004).
 *
 * Transport-independent validating mock (TST-001) + QueryClient wrapper. Feature tests
 * never reimplement Review daemon rules; handlers configure outcomes only.
 *
 * Types here are structural — they intentionally do not import `@/lib/daemon/*` so the
 * feature-boundary Biome rule stays honest for production and test modules alike.
 */

export const REPO = reviewContractFixtures.reviewComments.input
export const COMMENTS = reviewContractFixtures.reviewComments.output
export const ENV_ID = 'env-comments-test'

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

/** Default Review comment procedure handlers for adapter tests. */
export function defaultCommentHandlers(overrides: DaemonMockHandlers = {}): DaemonMockHandlers {
  return {
    reviewComments: () => ({ ok: true, value: [...COMMENTS] }),
    addReviewComment: () => ({ ok: true, value: reviewContractFixtures.addReviewComment.output }),
    editReviewComment: () => ({ ok: true, value: reviewContractFixtures.editReviewComment.output }),
    deleteReviewComment: () => ({
      ok: true,
      value: reviewContractFixtures.deleteReviewComment.output,
    }),
    resolveReviewComment: () => ({
      ok: true,
      value: reviewContractFixtures.resolveReviewComment.output,
    }),
    clearResolvedReviewComments: () => ({
      ok: true,
      value: reviewContractFixtures.clearResolvedReviewComments.output,
    }),
    ...overrides,
  }
}

export function createCommentHarness(handlers: DaemonMockHandlers = {}): {
  readonly mock: ValidatingDaemonMock
  readonly client: TestDaemonClient
  readonly queryClient: QueryClient
  readonly wrapper: (props: { children: ReactNode }) => React.JSX.Element
} {
  const mock = createValidatingDaemonMock(validatingCatalog, defaultCommentHandlers(handlers))
  const client = clientFromMock(mock)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { mock, client, queryClient, wrapper }
}
