import { fireEvent, render, screen } from '@testing-library/react'
import { TestIds } from '@shared/test-ids'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectPickerDialog } from './project-picker-dialog'

const openProject = vi.fn(async () => undefined)
const openWorktreeInEnvironment = vi.fn(async () => undefined)
/** What the browse hook was asked for, so a test can prove WHICH daemon was read. */
const browsed: { path: string | null; environmentId: string | null | undefined }[] = []

function inventory(id: string, name: string, current: boolean) {
  return {
    environmentId: current ? null : `shell-${id}`,
    current,
    inventory: { environment: { id, name }, projects: [] },
  }
}

let inventories = [inventory('env-mac', 'This device', true)]

vi.mock('@renderer/features/projects', () => ({
  useHubInventories: () => inventories,
  useOpenProject: () => ({ open: openProject, isPending: false }),
  useProjectDirectories: (
    path: string | null,
    _enabled: boolean,
    environmentId?: string | null,
  ) => {
    browsed.push({ path, environmentId })
    return {
      result: {
        path: environmentId === null || environmentId === undefined ? '/home/mac' : '/home/beelink',
        parent: null,
        entries: [
          {
            name: 'porcelain',
            path: `${environmentId == null ? '/home/mac' : '/home/beelink'}/porcelain`,
            isRepo: true,
          },
        ],
      },
      error: null,
      isFetching: false,
    }
  },
}))

vi.mock('@renderer/lib/trpc', () => ({
  shellTrpcClient: {
    openWorktreeInEnvironment: {
      mutate: (input: unknown) => openWorktreeInEnvironment(input),
    },
  },
}))

vi.mock('@renderer/lib/platform', () => ({ isBrowser: false }))

const { useProjectPickerStore } = await import('@renderer/stores/project-picker')

// jsdom implements no Web Animations API, and Base UI's ScrollArea asks its viewport for
// running animations on a timer AFTER mount — the throw lands outside the test that rendered
// it and fails the file rather than an assertion. Stubbed here rather than globally: with it
// present, Base UI's popups take their animated close path, which changes what other suites
// observe. Nothing animates in jsdom, so "none running" is the honest answer.
Element.prototype.getAnimations ??= (): Animation[] => []

/** Base UI's Select commits on the pointer sequence; a bare click leaves it unchosen. */
async function choose(trigger: HTMLElement, option: RegExp): Promise<void> {
  fireEvent.click(trigger)
  const item = await screen.findByRole('option', { name: option })
  fireEvent.pointerDown(item, { pointerType: 'mouse' })
  fireEvent.pointerUp(item, { pointerType: 'mouse' })
  fireEvent.click(item)
}

beforeEach(() => {
  openProject.mockClear()
  openWorktreeInEnvironment.mockClear()
  browsed.length = 0
  inventories = [inventory('env-mac', 'This device', true)]
  useProjectPickerStore.setState({ open: true })
})

describe('ProjectPickerDialog', () => {
  it('offers no Environment control when there is only one', () => {
    render(<ProjectPickerDialog />)

    expect(screen.queryByTestId(TestIds.projectPickerEnvironment)).toBeNull()
    expect(browsed.at(-1)?.environmentId).toBeNull()
  })

  it('browses the Environment that was chosen, not the one the window is on', async () => {
    inventories = [
      inventory('env-mac', 'This device', true),
      inventory('env-beelink', 'beelink soap', false),
    ]
    render(<ProjectPickerDialog />)

    expect(browsed.at(-1)?.environmentId).toBeNull()
    await choose(screen.getByTestId(TestIds.projectPickerEnvironment), /beelink soap/)

    expect(browsed.at(-1)?.environmentId).toBe('env-beelink')
    // A path read on the Mac means nothing on the Beelink: browsing restarts at its home.
    expect(browsed.at(-1)?.path).toBeNull()
    expect(screen.getByText(/moves this window to beelink soap/)).toBeTruthy()
  })

  it('opens through the shell when the folder lives on another Environment', async () => {
    inventories = [
      inventory('env-mac', 'This device', true),
      inventory('env-beelink', 'beelink soap', false),
    ]
    render(<ProjectPickerDialog />)
    await choose(screen.getByTestId(TestIds.projectPickerEnvironment), /beelink soap/)
    fireEvent.click(screen.getByRole('button', { name: 'Open this folder' }))

    // Only the shell can repoint the window; the renderer's session to that daemon is for
    // reads, not for binding.
    expect(openWorktreeInEnvironment).toHaveBeenCalledWith({
      environmentId: 'shell-env-beelink',
      repoPath: '/home/beelink',
    })
    expect(openProject).not.toHaveBeenCalled()
  })

  it('opens through this window when the folder is on its own Environment', () => {
    render(<ProjectPickerDialog />)
    fireEvent.click(screen.getByRole('button', { name: 'Open this folder' }))

    expect(openProject).toHaveBeenCalledWith('/home/mac', { environmentId: null })
    expect(openWorktreeInEnvironment).not.toHaveBeenCalled()
  })
})
