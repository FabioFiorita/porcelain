import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PairingCard } from './pairing-card'

const statusMock = vi.fn<() => { code: string; expiresAt: number } | null | undefined>()
const start = vi.fn()
const cancel = vi.fn()

vi.mock('@renderer/hooks/use-pairing', () => ({
  usePairingStatus: () => statusMock(),
  useStartPairing: () => ({ start, isPending: false }),
  useCancelPairing: () => ({ cancel }),
}))

const URL_UNDER_TEST = 'http://beelink:43117'

beforeEach(() => {
  statusMock.mockReturnValue(null)
  start.mockClear()
  cancel.mockClear()
})

describe('PairingCard', () => {
  it('offers to open a pairing window when none is pending', () => {
    render(<PairingCard url={URL_UNDER_TEST} />)
    fireEvent.click(screen.getByText('Pair a device'))
    expect(start).toHaveBeenCalled()
  })

  it('shows the code and the link once a window is open', () => {
    statusMock.mockReturnValue({ code: 'ABCD-EFGH', expiresAt: Date.now() + 60_000 })
    render(<PairingCard url={URL_UNDER_TEST} />)
    expect(screen.getByText('ABCD-EFGH')).toBeTruthy()
    expect(screen.getByText('http://beelink:43117/#pair=ABCD-EFGH')).toBeTruthy()
  })

  it('renders the link as a scannable QR — the point of pairing on a phone', async () => {
    statusMock.mockReturnValue({ code: 'ABCD-EFGH', expiresAt: Date.now() + 60_000 })
    render(<PairingCard url={URL_UNDER_TEST} />)
    // The encoder is dynamically imported, so the image arrives a tick later.
    await waitFor(() => {
      const img = screen.getByAltText('Pairing QR code') as HTMLImageElement
      expect(img.src.startsWith('data:image/')).toBe(true)
    })
  })

  it('says the window has closed rather than showing a live-looking code', () => {
    statusMock.mockReturnValue({ code: 'ABCD-EFGH', expiresAt: Date.now() - 1 })
    render(<PairingCard url={URL_UNDER_TEST} />)
    expect(screen.getByText(/Expired/)).toBeTruthy()
  })

  it('closes the window on cancel', () => {
    statusMock.mockReturnValue({ code: 'ABCD-EFGH', expiresAt: Date.now() + 60_000 })
    render(<PairingCard url={URL_UNDER_TEST} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(cancel).toHaveBeenCalled()
  })
})
