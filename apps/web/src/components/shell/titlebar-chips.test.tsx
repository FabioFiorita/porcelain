import type { EnvironmentStatus } from '@main/shell-api'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TitleBar } from './title-bar'

/**
 * The search field, the update chip, and the env chip share one titlebar row, so
 * they have to be the same height or the row reads as a mistake. They have already
 * drifted once: the update chip pinned `h-8` (32px) while the env chip derived 26px
 * from `text-xs` + `py-1`, and a comment claiming they matched went stale unnoticed.
 *
 * A comment can't fail. This can. The whole TitleBar is rendered and all three
 * controls are measured, so moving any one of them alone goes red.
 *
 * jsdom applies no Tailwind, so `resolveHeight` reads the box out of the classes
 * that build it. That is what makes this test able to say "26px" at all — and why
 * it catches a too-tall CHILD (Kbd's default h-5) pushing a parent out of line,
 * which a comparison of the parents' own classes would sail straight past.
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

/** Tailwind's 4px spacing step: `py-1` is 4px, `size-3.5` is 14px. */
const STEP = 4

/** Font-size utilities set the line box every derived height starts from. */
const LINE_BOX: Record<string, number> = {
  'text-2xs': 14,
  'text-2xs-plus': 14,
  'text-xs': 16,
  'text-sm': 20,
  'text-base': 24,
}

/** Read the attribute, not `.className` — on an SVG that's an SVGAnimatedString. */
function classes(el: Element): string[] {
  return (el.getAttribute('class') ?? '').split(/\s+/).filter((c) => c !== '')
}

/** `h-8` / `size-8` → 32. Null when the element doesn't pin one. */
function pinnedHeight(el: Element): number | null {
  for (const c of classes(el)) {
    const match = /^(?:h|size)-(\d+(?:\.\d+)?)$/.exec(c)
    if (match?.[1] != null) return Number.parseFloat(match[1]) * STEP
  }
  return null
}

/**
 * The rendered height of a titlebar control, in px.
 *
 * A pinned height wins outright. Otherwise the box is derived the way CSS does it:
 * the tallest of the line box and any pinned child, plus vertical padding, plus the
 * 1px border on each edge.
 */
function resolveHeight(el: Element): number {
  const pinned = pinnedHeight(el)
  if (pinned !== null) return pinned

  const own = classes(el)
  let content = 16
  for (const c of own) {
    const line = LINE_BOX[c]
    if (line != null) content = line
  }
  for (const child of el.querySelectorAll('*')) {
    const childHeight = pinnedHeight(child)
    if (childHeight != null && childHeight > content) content = childHeight
  }

  let padding = 0
  for (const c of own) {
    const match = /^py-(\d+(?:\.\d+)?)$/.exec(c)
    if (match?.[1] != null) padding = Number.parseFloat(match[1]) * STEP * 2
  }

  const border = own.includes('border') ? 2 : 0
  return content + padding + border
}

/** The env chip is the span inside the switcher's trigger button. */
function envChip(): Element {
  const trigger = screen.getByTestId('environment-switcher')
  const chip = trigger.querySelector('span')
  if (chip === null) throw new Error('env chip span not found')
  return chip
}

function heights(): { search: number; update: number; env: number } {
  return {
    search: resolveHeight(screen.getByLabelText('Search files, folders, commands, commits')),
    update: resolveHeight(screen.getByTestId('update-button')),
    env: resolveHeight(envChip()),
  }
}

beforeEach(() => {
  isMobile = false
})

describe('titlebar controls sit level', () => {
  it('search, update chip, and env chip are all 26px on desktop', () => {
    render(<TitleBar />)
    expect(heights()).toEqual({ search: 26, update: 26, env: 26 })
  })

  it('all three are 32px on a phone, where the chips are square tap targets', () => {
    isMobile = true
    render(<TitleBar />)
    expect(heights()).toEqual({ search: 32, update: 32, env: 32 })
  })

  it('derives the desktop height rather than pinning it, so the row scales with type', () => {
    render(<TitleBar />)
    for (const el of [
      screen.getByLabelText('Search files, folders, commands, commits'),
      screen.getByTestId('update-button'),
      envChip(),
    ]) {
      expect(pinnedHeight(el)).toBeNull()
      expect(classes(el)).toContain('py-1')
    }
  })
})
