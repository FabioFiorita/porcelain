import { createPairingBundleLink } from '@porcelain/contracts/remote'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const add = vi.fn()
const remove = vi.fn()
const redeemPairingLink = vi.fn()
const verifyPairingCredential = vi.fn()
const discardPairingCredential = vi.fn()

vi.mock('./remote-environment-store', () => ({
  environmentActions: { add, remove },
  getEnvironment: vi.fn(),
}))

vi.mock('./remote-pairing', async () => ({
  ...(await vi.importActual<typeof import('./remote-pairing')>('./remote-pairing')),
  redeemPairingLink,
}))

vi.mock('./remote-pairing-group', () => ({
  attachPairingCredential: vi.fn(),
  discardPairingCredential,
  verifyPairingCredential,
}))

const { pairNewGroups } = await import('./remote-pair')

describe('pairNewGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    redeemPairingLink
      .mockResolvedValueOnce('pc_client_windows')
      .mockResolvedValueOnce('pc_client_wsl')
    add
      .mockResolvedValueOnce({
        id: 'mobile-windows',
        nickname: 'Windows',
        baseUrl: 'http://10.0.2.2:43117',
        token: 'pc_client_windows',
      })
      .mockResolvedValueOnce({
        id: 'mobile-wsl',
        nickname: 'WSL',
        baseUrl: 'http://10.0.2.2:43119',
        token: 'pc_client_wsl',
      })
  })

  it('imports every daemon grant as a separate mobile Environment', async () => {
    const result = await pairNewGroups({
      connectionLink: createPairingBundleLink([
        {
          name: 'Windows',
          url: 'http://10.0.2.2:43117/pair#token=pc_pair_windows_secret',
        },
        { name: 'WSL', url: 'http://10.0.2.2:43119/pair#token=pc_pair_wsl_secret' },
      ]),
    })

    expect(result).toEqual({
      ok: true,
      value: [
        expect.objectContaining({ id: 'mobile-windows' }),
        expect.objectContaining({ id: 'mobile-wsl' }),
      ],
    })
    expect(add).toHaveBeenNthCalledWith(1, {
      baseUrl: 'http://10.0.2.2:43117',
      nickname: 'Windows',
      token: 'pc_client_windows',
    })
    expect(add).toHaveBeenNthCalledWith(2, {
      baseUrl: 'http://10.0.2.2:43119',
      nickname: 'WSL',
      token: 'pc_client_wsl',
    })
  })

  it('rejects a malformed all-Environments link without treating it as an ordinary link', async () => {
    const result = await pairNewGroups({
      connectionLink: 'porcelain://pair-environments#bundle=%7Bbad',
    })

    expect(result).toEqual({ ok: false, error: { kind: 'link', problem: 'malformed' } })
    expect(redeemPairingLink).not.toHaveBeenCalled()
  })

  it('removes and revokes an earlier Environment when a later bundle grant fails', async () => {
    redeemPairingLink
      .mockReset()
      .mockResolvedValueOnce('pc_client_windows')
      .mockRejectedValueOnce(new Error('WSL went offline'))
    const result = await pairNewGroups({
      connectionLink: createPairingBundleLink([
        {
          name: 'Windows',
          url: 'http://10.0.2.2:43117/pair#token=pc_pair_windows_secret',
        },
        { name: 'WSL', url: 'http://10.0.2.2:43119/pair#token=pc_pair_wsl_secret' },
      ]),
    })

    expect(result).toEqual({
      ok: false,
      error: { kind: 'mismatch', message: 'WSL went offline' },
    })
    expect(discardPairingCredential).toHaveBeenCalledWith(
      'http://10.0.2.2:43117',
      'pc_client_windows',
    )
    expect(remove).toHaveBeenCalledWith('mobile-windows')
  })
})
