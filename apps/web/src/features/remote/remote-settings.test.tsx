import { publicErrorFixtures } from '@porcelain/contracts'
import { remoteContractFixtures } from '@porcelain/contracts/remote'
import { createValidatingTrpcHarness } from '@renderer/hooks/trpc-test-harness'
import { act, renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useAccessStatus,
  useCloudflareStatus,
  useIssuePairingLink,
  useLanStatus,
  useRevokeAuthorizedClient,
  useRevokePairingLink,
  useSetCloudflareBind,
  useSetLanBind,
  useSetTailnetBind,
  useTailnetStatus,
} from './remote-settings'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const baseHandlers = {
  daemonInfo: () => ({ ok: true as const, value: remoteContractFixtures.daemonInfo.output }),
  accessStatus: () => ({ ok: true as const, value: remoteContractFixtures.accessStatus.output }),
  lanStatus: () => ({ ok: true as const, value: remoteContractFixtures.lanStatus.output }),
  tailnetStatus: () => ({ ok: true as const, value: remoteContractFixtures.tailnetStatus.output }),
  cloudflareStatus: () => ({
    ok: true as const,
    value: remoteContractFixtures.cloudflareStatus.output,
  }),
}

beforeEach(() => {
  vi.mocked(toast.error).mockReset()
})

describe('remote settings status shapes', () => {
  it("returns today's LAN, Tailscale, Cloudflare, and access fields", async () => {
    const { wrapper } = createValidatingTrpcHarness(baseHandlers)
    const { result } = renderHook(
      () => ({
        access: useAccessStatus(),
        lan: useLanStatus(),
        tailnet: useTailnetStatus(),
        cloudflare: useCloudflareStatus(),
      }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.lan).toBeDefined())
    expect(result.current.access).toEqual(remoteContractFixtures.accessStatus.output)
    expect(result.current.lan).toEqual({
      enabled: true,
      url: 'http://workstation.local:43118',
      numericUrl: 'http://192.168.1.10:43118',
      error: null,
      envForced: false,
      port: 43118,
    })
    expect(result.current.tailnet).toEqual({
      enabled: true,
      url: 'http://workstation.example:43118',
      error: null,
      envForced: false,
      port: 43118,
    })
    expect(result.current.cloudflare).toEqual({
      enabled: false,
      url: null,
      managed: false,
      error: 'unavailable',
      envForced: false,
    })
  })
})

describe('remote settings mutations', () => {
  it('bind and revoke call the daemon procedures', async () => {
    const { mock, wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      issuePairingLink: () => ({
        ok: true,
        value: remoteContractFixtures.issuePairingLink.output,
      }),
      revokePairingLink: () => ({ ok: true, value: undefined }),
      revokeAuthorizedClient: () => ({ ok: true, value: undefined }),
      setLanBind: () => ({ ok: true, value: remoteContractFixtures.setLanBind.output }),
      setTailnetBind: () => ({ ok: true, value: remoteContractFixtures.setTailnetBind.output }),
      setCloudflareBind: () => ({
        ok: true,
        value: remoteContractFixtures.setCloudflareBind.output,
      }),
    })

    const { result } = renderHook(
      () => ({
        issue: useIssuePairingLink(),
        revokeLink: useRevokePairingLink(),
        revokeClient: useRevokeAuthorizedClient(),
        lan: useSetLanBind(),
        tailnet: useSetTailnetBind(),
        cloudflare: useSetCloudflareBind(),
      }),
      { wrapper },
    )

    await act(async () => {
      await result.current.issue.issue(remoteContractFixtures.issuePairingLink.input)
    })
    await act(async () => {
      result.current.revokeLink.revoke(remoteContractFixtures.revokePairingLink.input)
    })
    await act(async () => {
      result.current.revokeClient.revoke(remoteContractFixtures.revokeAuthorizedClient.input)
    })
    await act(async () => {
      result.current.lan.setEnabled(true)
    })
    await act(async () => {
      result.current.tailnet.setEnabled(true)
    })
    await act(async () => {
      result.current.cloudflare.setEnabled(false)
    })

    await waitFor(() => {
      expect(mock.requests().map((request) => request.procedure)).toEqual(
        expect.arrayContaining([
          'issuePairingLink',
          'revokePairingLink',
          'revokeAuthorizedClient',
          'setLanBind',
          'setTailnetBind',
          'setCloudflareBind',
        ]),
      )
    })
  })

  it('toasts via onMutationError when a bind is rejected', async () => {
    const { wrapper } = createValidatingTrpcHarness({
      ...baseHandlers,
      setLanBind: () => ({
        ok: false,
        error: publicErrorFixtures['auth.forbidden'],
      }),
    })

    const { result } = renderHook(() => useSetLanBind(), { wrapper })
    await act(async () => {
      result.current.setEnabled(true)
    })
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Toggle local network sharing failed', {
        description: publicErrorFixtures['auth.forbidden'].message,
      })
    })
  })
})
