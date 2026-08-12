import type { ActionView } from '@porcelain/contracts/actions'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const create = vi.fn(async () => 'term-1')
const openTab = vi.fn()
const spawnLocalTerminal = vi.fn(async () => {})

vi.mock('@renderer/stores/terminals', () => ({
  useTerminalsStore: {
    getState: () => ({ create }),
  },
}))

vi.mock('@renderer/stores/tabs', () => ({
  tabId: (kind: string, id: string) => `${kind}:${id}`,
  useTabsStore: {
    getState: () => ({ openTab }),
  },
}))

vi.mock('@renderer/lib/terminal-actions', () => ({
  spawnLocalTerminal: (...args: unknown[]) => spawnLocalTerminal(...args),
}))

import { useActionRun } from './action-run'

const REPO = '/synthetic/repo'

const trustedPrimary: ActionView = {
  id: 'a1',
  title: 'Build',
  command: 'make build',
  order: 1,
  createdAt: 1,
  trusted: true,
}

const trustedLocal: ActionView = {
  ...trustedPrimary,
  id: 'a2',
  title: 'Serve',
  command: 'make serve',
  where: 'local',
}

const untrusted: ActionView = {
  ...trustedPrimary,
  id: 'a3',
  trusted: false,
}

beforeEach(() => {
  create.mockReset()
  create.mockResolvedValue('term-1')
  openTab.mockReset()
  spawnLocalTerminal.mockReset()
  spawnLocalTerminal.mockResolvedValue(undefined)
  useProjectSelectionStore.setState({ project: { path: REPO, name: 'repo' }, showHidden: false })
})

describe('useActionRun', () => {
  it('returns needs-trust with zero create calls for untrusted actions', async () => {
    const { result } = renderHook(() => useActionRun())
    await expect(result.current(untrusted)).resolves.toBe('needs-trust')
    expect(create).not.toHaveBeenCalled()
    expect(spawnLocalTerminal).not.toHaveBeenCalled()
    expect(openTab).not.toHaveBeenCalled()
  })

  it('returns needs-local-path for local actions without a mapped path', async () => {
    const { result } = renderHook(() => useActionRun())
    await expect(result.current(trustedLocal)).resolves.toBe('needs-local-path')
    await expect(result.current(trustedLocal, { localPath: null })).resolves.toBe(
      'needs-local-path',
    )
    await expect(result.current(trustedLocal, { localPath: '' })).resolves.toBe('needs-local-path')
    expect(create).not.toHaveBeenCalled()
    expect(spawnLocalTerminal).not.toHaveBeenCalled()
  })

  it('primary success creates once with prepared fields and opens a terminal tab', async () => {
    const { result } = renderHook(() => useActionRun())
    await expect(result.current(trustedPrimary)).resolves.toBe('ran')
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith({
      cwd: REPO,
      name: 'Build',
      initialInput: 'make build',
    })
    expect(openTab).toHaveBeenCalledTimes(1)
    expect(openTab).toHaveBeenCalledWith({
      id: 'terminal:term-1',
      kind: 'terminal',
      title: 'Build',
      path: 'term-1',
    })
    expect(spawnLocalTerminal).not.toHaveBeenCalled()
  })

  it('local success calls spawnLocalTerminal once with prepared fields', async () => {
    const localPath = '/synthetic/local-checkout'
    const { result } = renderHook(() => useActionRun())
    await expect(result.current(trustedLocal, { localPath })).resolves.toBe('ran')
    expect(spawnLocalTerminal).toHaveBeenCalledTimes(1)
    expect(spawnLocalTerminal).toHaveBeenCalledWith(localPath, {
      name: 'Serve',
      initialInput: 'make serve',
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects when Terminal create fails', async () => {
    create.mockRejectedValueOnce(new Error('pty failed'))
    const { result } = renderHook(() => useActionRun())
    await expect(result.current(trustedPrimary)).rejects.toThrow('pty failed')
  })

  it('no-ops as ran without a selected project', async () => {
    useProjectSelectionStore.setState({ project: null })
    const { result } = renderHook(() => useActionRun())
    await expect(result.current(trustedPrimary)).resolves.toBe('ran')
    expect(create).not.toHaveBeenCalled()
  })
})
