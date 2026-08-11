import {
  createValidatingDaemonMock,
  type DaemonMockOutcome,
  type ValidatingDaemonMock,
} from '@porcelain/client-runtime/testing/daemon-mock'
import { procedureCatalog, publicErrorSchema } from '@porcelain/contracts'
import { filesContractFixtures } from '@porcelain/contracts/files'
import { sessionChangeSchema } from '@porcelain/contracts/session'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TRPCClientError } from '@trpc/client'
import type { ReactNode } from 'react'

/** TST-001 validating transport harness for mobile Files adapter tests. */
export const REPO = '/synthetic/repo'
export const ENV_ID = 'env-files-test'
export const DIR_ENTRIES = filesContractFixtures.readDir.output
export const PINNED_ENTRIES = filesContractFixtures.pinnedEntries.output

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
  activeRepoPath: REPO,
  baseUrl: 'http://127.0.0.1:43118',
  createdAt: 1,
  endpoints: ['http://127.0.0.1:43118'],
  icon: 'desktop',
  id: ENV_ID,
  nickname: 'test',
  preferredEndpoint: 'http://127.0.0.1:43118',
  token: 'pc_client_test',
}

const validatingCatalog = {
  notification: sessionChangeSchema,
  procedures: procedureCatalog,
  publicError: publicErrorSchema,
} as const

export type DaemonMockHandlers = Readonly<
  Record<string, (input: unknown) => DaemonMockOutcome | Promise<DaemonMockOutcome>>
>

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

export function clientFromMock(mock: ValidatingDaemonMock): TestDaemonClient {
  const dispatch = async (
    kind: 'query' | 'mutation',
    procedure: string,
    input: unknown,
  ): Promise<unknown> => {
    const outcome = await mock.dispatch({ input, kind, procedure })
    if (!outcome.ok) {
      throw TRPCClientError.from(
        Object.assign(new Error(publicErrorMessage(outcome.error)), {
          data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500, porcelain: outcome.error },
        }),
      )
    }
    return outcome.value
  }
  return {
    mutation: (procedure, input) => dispatch('mutation', procedure, input),
    query: (procedure, input) => dispatch('query', procedure, input),
  }
}

export function defaultFilesHandlers(overrides: DaemonMockHandlers = {}): DaemonMockHandlers {
  return {
    createFile: () => ({ ok: true, value: filesContractFixtures.createFile.output }),
    createFolder: () => ({ ok: true, value: filesContractFixtures.createFolder.output }),
    duplicatePath: () => ({ ok: true, value: filesContractFixtures.duplicatePath.output }),
    hidePath: () => ({ ok: true, value: filesContractFixtures.hidePath.output }),
    pinPath: () => ({ ok: true, value: filesContractFixtures.pinPath.output }),
    previewHtml: () => ({ ok: true, value: filesContractFixtures.previewHtml.output }),
    readDir: () => ({ ok: true, value: [...DIR_ENTRIES] }),
    readFile: () => ({ ok: true, value: filesContractFixtures.readFile.output }),
    renamePath: () => ({ ok: true, value: filesContractFixtures.renamePath.output }),
    repoNotes: () => ({ ok: true, value: '' }),
    searchCode: () => ({ ok: true, value: { files: [], truncated: false } }),
    searchFiles: () => ({ ok: true, value: [] }),
    searchText: () => ({ ok: true, value: [] }),
    setRepoNotes: () => ({ ok: true, value: undefined }),
    trashPath: () => ({ ok: true, value: filesContractFixtures.trashPath.output }),
    unhidePath: () => ({ ok: true, value: filesContractFixtures.unhidePath.output }),
    unpinPath: () => ({ ok: true, value: filesContractFixtures.unpinPath.output }),
    pinnedEntries: () => ({ ok: true, value: [...PINNED_ENTRIES] }),
    ...overrides,
  }
}

export function createFilesHarness(handlers: DaemonMockHandlers = {}): {
  readonly mock: ValidatingDaemonMock
  readonly client: TestDaemonClient
  readonly queryClient: QueryClient
  readonly wrapper: (props: { children: ReactNode }) => React.JSX.Element
} {
  const mock = createValidatingDaemonMock(validatingCatalog, defaultFilesHandlers(handlers))
  const client = clientFromMock(mock)
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { client, mock, queryClient, wrapper }
}
