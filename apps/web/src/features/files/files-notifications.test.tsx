import {
  fileContentQuery,
  filesPinsQuery,
  filesScopeQuery,
  filesTreeQuery,
} from '@porcelain/client-runtime/files'
import { filesNotificationFixtures } from '@porcelain/contracts/files'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { applyFilesNotification } from './files-notifications'
import { filesQueryKey } from './files-query-key'

const PROJECT = '/synthetic/repo'
const OTHER = '/synthetic/other'
const DAEMON = { host: 'beelink', version: '0.52.1' }
const applyForeignDependencies = vi.fn(() => Promise.resolve())

describe('applyFilesNotification', () => {
  it('no-ops when active project is null', () => {
    applyForeignDependencies.mockClear()
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    applyFilesNotification(filesNotificationFixtures['files.scope-changed'], {
      queryClient,
      daemon: DAEMON,
      activeProjectPath: null,
      applyForeignDependencies,
    })
    expect(spy).not.toHaveBeenCalled()
    expect(applyForeignDependencies).not.toHaveBeenCalled()
  })

  it('no-ops for another project', () => {
    applyForeignDependencies.mockClear()
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    applyFilesNotification(filesNotificationFixtures['files.scope-changed'], {
      queryClient,
      daemon: DAEMON,
      activeProjectPath: OTHER,
      applyForeignDependencies,
    })
    expect(spy).not.toHaveBeenCalled()
    expect(applyForeignDependencies).not.toHaveBeenCalled()
  })

  it('invalidates scope effects for files.scope-changed on the active project', () => {
    applyForeignDependencies.mockClear()
    const queryClient = new QueryClient()
    const scopeKey = filesQueryKey(DAEMON, filesScopeQuery(PROJECT))
    const pinsKey = filesQueryKey(DAEMON, filesPinsQuery(PROJECT))
    queryClient.setQueryData(scopeKey, { hiddenPaths: [], pinnedPaths: [] })
    queryClient.setQueryData(pinsKey, [])
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    applyFilesNotification(filesNotificationFixtures['files.scope-changed'], {
      queryClient,
      daemon: DAEMON,
      activeProjectPath: PROJECT,
      applyForeignDependencies,
    })

    expect(spy).toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith({
      queryKey: scopeKey,
      exact: true,
    })
    expect(spy).toHaveBeenCalledWith({
      queryKey: pinsKey,
      exact: true,
    })
    expect(applyForeignDependencies).toHaveBeenCalledWith([
      { domain: 'search', name: 'path-index' },
    ])
  })

  it('handles files.tree-changed and files.content-changed kinds', () => {
    applyForeignDependencies.mockClear()
    const queryClient = new QueryClient()
    const contentKey = filesQueryKey(DAEMON, fileContentQuery(PROJECT, 'src/open-document.ts'))
    const treeKey = filesQueryKey(DAEMON, filesTreeQuery(PROJECT, 'src', false))
    queryClient.setQueryData(contentKey, { type: 'text', content: 'x' })
    queryClient.setQueryData(treeKey, [])
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    applyFilesNotification(filesNotificationFixtures['files.tree-changed'], {
      queryClient,
      daemon: DAEMON,
      activeProjectPath: PROJECT,
      applyForeignDependencies,
    })
    expect(spy.mock.calls.length).toBeGreaterThan(0)
    const allForeign = [
      { domain: 'git', name: 'working-tree' },
      { domain: 'search', name: 'path-index' },
      { domain: 'search', name: 'content-index' },
    ]
    expect(applyForeignDependencies).toHaveBeenLastCalledWith(allForeign)

    spy.mockClear()
    applyForeignDependencies.mockClear()
    applyFilesNotification(filesNotificationFixtures['files.content-changed'], {
      queryClient,
      daemon: DAEMON,
      activeProjectPath: PROJECT,
      applyForeignDependencies,
    })
    expect(spy).toHaveBeenCalledWith({
      queryKey: contentKey,
      exact: true,
    })
    expect(applyForeignDependencies).toHaveBeenCalledWith(allForeign)
  })
})
