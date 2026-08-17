import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness } from '@renderer/hooks/trpc-test-harness'
import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  remoteAccessStatusQueryOptions,
  remoteCloudflareStatusQueryOptions,
  remoteStatusQueryKey,
  setRemoteLanBind,
  setRemoteTailnetBind,
} from './remote-data'
import { useLanStatus } from './remote-settings'

const DAEMON = {
  host: remoteContractFixtures.daemonInfo.output.host,
  version: remoteContractFixtures.daemonInfo.output.version,
}
const OTHER = { host: 'mac', version: '0.52.1' }

describe('remoteStatusQueryKey', () => {
  it('isolates each status by daemon host and version', () => {
    const access = remoteStatusQueryKey(DAEMON, 'accessStatus')
    const lan = remoteStatusQueryKey(DAEMON, 'lanStatus')
    const otherLan = remoteStatusQueryKey(OTHER, 'lanStatus')
    expect(access).toEqual(['remote', 'accessStatus', DAEMON])
    expect(lan[1]).not.toBe(access[1])
    expect(otherLan[2]).not.toEqual(lan[2])
    expect(remoteStatusQueryKey({ host: null, version: null }, 'cloudflareStatus')[2]).toEqual({
      host: null,
      version: null,
    })
  })
})

describe('remote status query options', () => {
  it('does not re-enable Query retries', async () => {
    expect('retry' in remoteAccessStatusQueryOptions).toBe(false)
    expect('retry' in remoteCloudflareStatusQueryOptions).toBe(false)

    const { wrapper } = createValidatingTrpcHarness({
      daemonInfo: () => ({ ok: true, value: remoteContractFixtures.daemonInfo.output }),
      lanStatus: () => ({ ok: true, value: remoteContractFixtures.lanStatus.output }),
    })
    const { result } = renderHook(() => ({ lan: useLanStatus(), queryClient: useQueryClient() }), {
      wrapper,
    })
    await waitFor(() => expect(result.current.lan?.enabled).toBe(true))
    const lanQuery = result.current.queryClient
      .getQueryCache()
      .find({ queryKey: remoteStatusQueryKey(DAEMON, 'lanStatus') })
    expect(lanQuery?.options.retry).toBe(false)
  })
})

describe('remote daemon transport', () => {
  it('bind mutations call the contract input and invalidate only the matching status key', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const lanKey = remoteStatusQueryKey(DAEMON, 'lanStatus')
    const tailnetKey = remoteStatusQueryKey(DAEMON, 'tailnetStatus')
    const accessKey = remoteStatusQueryKey(DAEMON, 'accessStatus')
    const otherLanKey = remoteStatusQueryKey(OTHER, 'lanStatus')
    queryClient.setQueryData(lanKey, remoteContractFixtures.lanStatus.output)
    queryClient.setQueryData(tailnetKey, remoteContractFixtures.tailnetStatus.output)
    queryClient.setQueryData(accessKey, remoteContractFixtures.accessStatus.output)
    queryClient.setQueryData(otherLanKey, remoteContractFixtures.lanStatus.output)

    const client = {
      setLanBind: { mutate: vi.fn(async () => remoteContractFixtures.setLanBind.output) },
      setTailnetBind: { mutate: vi.fn(async () => remoteContractFixtures.setTailnetBind.output) },
    }

    await setRemoteLanBind(client, queryClient, DAEMON, remoteContractFixtures.setLanBind.input)
    expect(client.setLanBind.mutate).toHaveBeenCalledWith(remoteContractFixtures.setLanBind.input)
    expect(queryClient.getQueryState(lanKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(accessKey)?.isInvalidated).toBeFalsy()
    expect(queryClient.getQueryState(otherLanKey)?.isInvalidated).toBeFalsy()

    await setRemoteTailnetBind(
      client,
      queryClient,
      DAEMON,
      remoteContractFixtures.setTailnetBind.input,
    )
    expect(client.setTailnetBind.mutate).toHaveBeenCalledWith(
      remoteContractFixtures.setTailnetBind.input,
    )
    expect(queryClient.getQueryState(tailnetKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(accessKey)?.isInvalidated).toBeFalsy()
  })
})
