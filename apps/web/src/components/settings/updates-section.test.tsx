import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdatesSection } from './updates-section'

const check = {
  data: { currentVersion: '0.52.1', latestVersion: '0.60.0', restartable: true },
  isPending: false,
  isSuccess: true,
  mutate: vi.fn(),
}
const restart = { isPending: false, mutate: vi.fn() }

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    daemonInfo: { useQuery: () => ({ data: { version: '0.52.1' } }) },
    checkDaemonUpdate: { useMutation: () => check },
    restartDaemon: { useMutation: () => restart },
  },
}))

beforeEach(() => {
  check.isPending = false
  restart.isPending = false
})

describe('DaemonUpdatesSection', () => {
  it.each([
    ['checking for an update', check],
    ['restarting the daemon', restart],
  ])('locks every update action while %s', (_label, pendingMutation) => {
    pendingMutation.isPending = true
    render(<UpdatesSection />)

    expect(screen.getByRole('button', { name: /Check/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Update and restart|Restarting/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Copy restart command/ })).toBeDisabled()
  })
})
