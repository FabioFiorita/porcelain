import type { EnvironmentStatus } from '@main/shell-api'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EnvironmentSwitcher } from './environment-switcher'
import { UpdateButton } from './update-button'

/**
 * The update chip and the env chip sit adjacent in the titlebar (`title-bar.tsx`),
 * so they have to be the same height or the pair reads as a mistake. They already
 * drifted once: the update chip pinned `h-8` (32px) while the env chip derived 26px
 * from `text-xs` + `py-1`, and a comment claiming they matched went stale unnoticed.
 *
 * A comment can't fail. This can. Both chips are rendered for real and their
 * box-height classes compared — touch either side alone and this goes red.
 *
 * jsdom has no Tailwind, so pixel heights are unmeasurable here; the classes that
 * DERIVE the height are the honest proxy.
 */

let isMobile = false

vi.mock('@renderer/hooks/use-mobile', () => ({
  useIsMobile: () => isMobile,
}))

vi.mock('@renderer/lib/platform', () => ({
  isBrowser: false,
  isLinuxShell: false,
  isE2E: false,
}))

vi.mock('@renderer/hooks/use-updates', () => ({
  useUpdateStatus: () => ({
    state: 'downloaded',
    version: '0.49.0',
    error: null,
    currentVersion: '0.48.0',
  }),
  useInstallUpdate: () => ({ install: vi.fn(), isInstalling: false }),
}))

vi.mock('@renderer/hooks/use-daemon-identity', () => ({
  useDaemonIdentity: () => ({ host: 'studio', platform: 'darwin', version: '0.49.0' }),
}))

vi.mock('@renderer/hooks/use-environment-status', () => ({
  useEnvironmentStatuses: (): Map<string | null, EnvironmentStatus> =>
    new Map([
      [
        null,
        {
          id: null,
          state: 'online',
          host: 'studio',
          platform: 'darwin',
          version: null,
          endpoint: null,
        },
      ],
    ]),
}))

vi.mock('@renderer/hooks/use-remote-daemon', () => ({
  useRemoteEnvironments: () => ({ activeId: null, defaultId: null, environments: [] }),
  useConnectRemoteEnvironment: () => ({ connect: vi.fn(), pendingId: null }),
  useDisconnectRemoteEnvironment: () => ({ disconnect: vi.fn(), isPending: false }),
  useOpenWindowInEnvironment: () => ({ open: vi.fn() }),
}))

/**
 * Every class that can change a chip's box height: font-size sets the line box,
 * `py-*`/`h-*`/`size-*` add to it, and a border adds 2px. Order-insensitive —
 * only the set matters.
 */
function heightClasses(el: Element): string[] {
  return el.className
    .split(/\s+/)
    .filter((c) => /^(h-|py-|size-|text-(xs|sm|base|2xs)|border)/.test(c))
    .sort()
}

/** The env chip is the span inside the switcher's trigger button. */
function envChip(): Element {
  const trigger = screen.getByTestId('environment-switcher')
  const chip = trigger.querySelector('span')
  if (chip === null) throw new Error('env chip span not found')
  return chip
}

beforeEach(() => {
  isMobile = false
})

describe('titlebar chips', () => {
  it('update chip and env chip derive the same height on desktop', () => {
    render(
      <>
        <UpdateButton />
        <EnvironmentSwitcher />
      </>,
    )
    expect(heightClasses(screen.getByTestId('update-button'))).toEqual(heightClasses(envChip()))
  })

  it('update chip and env chip derive the same height on a phone', () => {
    isMobile = true
    render(
      <>
        <UpdateButton />
        <EnvironmentSwitcher />
      </>,
    )
    expect(heightClasses(screen.getByTestId('update-button'))).toEqual(heightClasses(envChip()))
  })

  it('neither chip pins a literal height — both derive it from padding', () => {
    render(
      <>
        <UpdateButton />
        <EnvironmentSwitcher />
      </>,
    )
    for (const chip of [screen.getByTestId('update-button'), envChip()]) {
      expect(heightClasses(chip)).toContain('py-1')
      expect(heightClasses(chip).some((c) => c.startsWith('h-'))).toBe(false)
    }
  })
})
