import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { type Task, tasksContractFixtures } from '@porcelain/contracts/tasks'
import {
  createValidatingTrpcHarness,
  type DaemonMockHandlers,
} from '@renderer/hooks/trpc-test-harness'
import { type ShellTrpcLink, shellTrpc } from '@renderer/lib/trpc'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { QueryClient } from '@tanstack/react-query'
import { type RenderResult, render } from '@testing-library/react'
import type { Operation } from '@trpc/client'
import { TRPCClientError } from '@trpc/client'
import { observable } from '@trpc/server/observable'
import type { ReactElement } from 'react'

/**
 * Shared Tasks render/harness plumbing.
 *
 * Board's `test-support` cannot be reused: every Tasks surface also mounts the SHELL tRPC
 * hooks (`environmentTasks` / `environmentTaskMutation`), which need their own provider even
 * though the browser runtime — the one vitest/jsdom reproduces — must never reach them. The
 * shell link here records every operation and then fails exactly like the real browser link,
 * so "the transport was never called" is something a test can assert rather than assume.
 */

export const TASKS = tasksContractFixtures.listTasks.output
export const DAEMON_HOST = remoteContractFixtures.daemonInfo.output.host

/** A required canonical Task fixture with a useful failure if the fixture contract drifts. */
export function taskAt(index: number): Task {
  const task = TASKS[index]
  if (task === undefined) throw new Error(`Expected Task fixture at index ${index}`)
  return task
}

/** Default Tasks procedure handlers for presentation tests. */
function defaultTasksHandlers(overrides: DaemonMockHandlers = {}): DaemonMockHandlers {
  return {
    daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
    listTasks: () => ({ ok: true, value: [...TASKS] }),
    createTask: () => ({ ok: true, value: tasksContractFixtures.createTask.output }),
    updateTask: () => ({ ok: true, value: tasksContractFixtures.updateTask.output }),
    deleteTask: () => ({ ok: true, value: tasksContractFixtures.deleteTask.output }),
    ...overrides,
  }
}

/**
 * The shell link type comes from `lib/trpc` rather than `@main/shell-api`: a Web module
 * importing `@main/*` is exactly the raw server import the architecture gate counts, and a
 * test harness has no business being the file that grows that baseline.
 */
function shellStubLink(record: (op: Operation) => void): ShellTrpcLink {
  return () =>
    ({ op }) =>
      observable((observer) => {
        record(op)
        observer.error(new TRPCClientError('shell router is unavailable in the browser client'))
      })
}

export type TasksHarness = {
  readonly mock: ReturnType<typeof createValidatingTrpcHarness>['mock']
  readonly shellOperations: readonly Operation[]
  readonly wrapper: (props: { children: React.ReactNode }) => React.JSX.Element
}

/** A wrapper providing the validating daemon tRPC client plus an unreachable shell client. */
export function createTasksHarness(handlers: DaemonMockHandlers = {}): TasksHarness {
  const { mock, wrapper: Daemon } = createValidatingTrpcHarness(defaultTasksHandlers(handlers))
  const shellOperations: Operation[] = []
  const shellQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const client = shellTrpc.createClient({
    links: [shellStubLink((op) => shellOperations.push(op))],
  })

  const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
    <Daemon>
      <shellTrpc.Provider client={client} queryClient={shellQueryClient}>
        {children}
      </shellTrpc.Provider>
    </Daemon>
  )

  return { mock, shellOperations, wrapper }
}

/** Render a Tasks surface under the harness, with the Hub sitting on Home by default. */
export function renderTasks(
  ui: ReactElement,
  handlers: DaemonMockHandlers = {},
): RenderResult & Omit<TasksHarness, 'wrapper'> {
  useHubSelectionStore.setState({ selection: { kind: 'home' } })
  const { mock, shellOperations, wrapper: Wrapper } = createTasksHarness(handlers)
  const result = render(ui, {
    wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
  })
  return { ...result, mock, shellOperations }
}
