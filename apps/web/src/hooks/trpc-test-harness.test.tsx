import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { trpc } from '@renderer/lib/trpc'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createValidatingTrpcHarness, deferred, toDaemonMockRequest } from './trpc-test-harness'

const daemonInfo = remoteContractFixtures.daemonInfo

describe('trpc validating harness', () => {
  it('forwards the canonical procedure, kind, and input into the mock', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      daemonInfo: () => ({ ok: true, value: daemonInfo.output }),
    })

    const hook = renderHook(() => trpc.daemonInfo.useQuery(), { wrapper })
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))

    expect(hook.result.current.data).toEqual(daemonInfo.output)
    expect(mock.requests()).toEqual([{ procedure: 'daemonInfo', kind: 'query', input: undefined }])
  })

  it('rejects malformed contract output before the hook can render it', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      daemonInfo: () => ({
        ok: true,
        // Missing required host/platform/arch and protocolVersion — catalog output must reject.
        value: { version: '0.52.1' },
      }),
    })

    const hook = renderHook(() => trpc.daemonInfo.useQuery(), { wrapper })
    await waitFor(() => expect(hook.result.current.isError).toBe(true))
    expect(hook.result.current.data).toBeUndefined()
  })

  it('preserves deferred settlement so a mutation can stay pending', async () => {
    const write = deferred<{ ok: true; value: typeof daemonInfo.output }>()
    // The harness accepts async handlers; a deferred outcome keeps the query pending.
    const pending = deferred<typeof daemonInfo.output>()
    const { wrapper } = createValidatingTrpcHarness({
      daemonInfo: () => pending.promise.then((value) => ({ ok: true as const, value })),
    })

    const hook = renderHook(() => trpc.daemonInfo.useQuery(), { wrapper })
    expect(hook.result.current.isPending).toBe(true)

    pending.resolve(daemonInfo.output)
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true))
    expect(hook.result.current.data).toEqual(daemonInfo.output)
    // deferred() itself remains available for feature suites that answer without the mock.
    write.resolve({ ok: true, value: daemonInfo.output })
    await expect(write.promise).resolves.toEqual({ ok: true, value: daemonInfo.output })
  })

  it('maps a tRPC operation onto DaemonMockRequest without framework leakage', () => {
    expect(
      toDaemonMockRequest({
        id: 1,
        type: 'mutation',
        path: 'openRepoPath',
        input: '/synthetic/projects/alpha',
        context: {},
        signal: undefined,
      }),
    ).toEqual({
      procedure: 'openRepoPath',
      kind: 'mutation',
      input: '/synthetic/projects/alpha',
    })
  })
})
