// @vitest-environment node
import { join } from 'node:path'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { createFilesOperations, type FilesOperations } from './files-operations'
import type { FilesChangeFact, FilesChanges, FilesScope, WorkspaceFiles } from './files-ports'

function fakeWorkspace(overrides: Partial<WorkspaceFiles> = {}): WorkspaceFiles {
  const reject: never = undefined as never
  return {
    readDir: async () => reject,
    pinnedEntries: async () => reject,
    readFile: async () => reject,
    previewHtml: async () => reject,
    writeTextFile: async () => reject,
    createFile: async () => reject,
    createFolder: async () => reject,
    renamePath: async () => reject,
    duplicatePath: async () => reject,
    trashPath: async () => reject,
    ...overrides,
  }
}

function recordingChanges(): { changes: FilesChanges; facts: FilesChangeFact[] } {
  const facts: FilesChangeFact[] = []
  return {
    facts,
    changes: {
      publish(change) {
        facts.push(change)
      },
    },
  }
}

const PROJECT = '/synthetic/repo'

describe('createFilesOperations', () => {
  it('maps adapter path-outside without touching fs', async () => {
    const readFile = vi.fn(async () => ({
      ok: false as const,
      error: { code: 'path-outside-project' as const, path: 'escape' },
    }))
    const ops = createFilesOperations({ workspaceFiles: fakeWorkspace({ readFile }) })
    await expect(ops.readFile({ projectPath: PROJECT, path: 'escape' })).resolves.toEqual({
      ok: false,
      error: { code: 'path-outside-project', path: 'escape' },
    })
    expect(readFile).toHaveBeenCalledOnce()
  })

  it('passes through success values', async () => {
    const createFile = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const ops = createFilesOperations({ workspaceFiles: fakeWorkspace({ createFile }) })
    await expect(ops.createFile({ projectPath: PROJECT, path: 'docs/empty.txt' })).resolves.toEqual(
      { ok: true, value: undefined },
    )
  })

  it('composes scope state with directory reads and delegates scope mutations', async () => {
    const readDir = vi.fn<WorkspaceFiles['readDir']>(async () => ({ ok: true, value: [] }))
    const pinnedEntries = vi.fn<WorkspaceFiles['pinnedEntries']>(async () => [])
    const scope: FilesScope = {
      read: vi.fn(async () => ({
        hiddenPaths: ['/synthetic/repo/.env'],
        pinnedPaths: ['/synthetic/repo/src'],
      })),
      readProfile: vi.fn(async () => ({
        worktreeId: null,
        base: { pinnedPaths: [], hiddenPaths: [], layers: [] },
        override: null,
        resolved: { pinnedPaths: [], hiddenPaths: [], layers: [] },
      })),
      hidePath: vi.fn(async () => undefined),
      unhidePath: vi.fn(async () => undefined),
      pinPath: vi.fn(async () => undefined),
      unpinPath: vi.fn(async () => undefined),
      renamePath: vi.fn(async () => undefined),
    }
    const ops = createFilesOperations({
      workspaceFiles: fakeWorkspace({ readDir, pinnedEntries }),
      scope,
    })

    await ops.readDir({ projectPath: PROJECT, path: '.', showHidden: false })
    await ops.pinnedEntries(PROJECT)
    await ops.hidePath(PROJECT, '.env')
    await ops.unhidePath(PROJECT, '.env')
    await ops.pinPath(PROJECT, 'src')
    await ops.unpinPath(PROJECT, 'src')
    await ops.repoScope(PROJECT)

    expect(readDir).toHaveBeenCalledWith({
      projectPath: PROJECT,
      path: '.',
      showHidden: false,
      hiddenPaths: new Set(['/synthetic/repo/.env']),
      pinnedPaths: new Set(['/synthetic/repo/src']),
    })
    expect(pinnedEntries).toHaveBeenCalledWith({
      projectPath: PROJECT,
      hiddenPaths: new Set(['/synthetic/repo/.env']),
      pinnedPaths: ['/synthetic/repo/src'],
    })
    expect(scope.hidePath).toHaveBeenCalledWith(PROJECT, join(PROJECT, '.env'))
    expect(scope.unhidePath).toHaveBeenCalledWith(PROJECT, join(PROJECT, '.env'))
    expect(scope.pinPath).toHaveBeenCalledWith(PROJECT, join(PROJECT, 'src'))
    expect(scope.unpinPath).toHaveBeenCalledWith(PROJECT, join(PROJECT, 'src'))
    expect(scope.read).toHaveBeenCalledTimes(3)
  })

  it('moves personal pins and hides after a successful filesystem rename', async () => {
    const renameScope = vi.fn(async () => undefined)
    const scope: FilesScope = {
      read: async () => ({ hiddenPaths: [], pinnedPaths: [] }),
      readProfile: async () => ({
        worktreeId: null,
        base: { pinnedPaths: [], hiddenPaths: [], layers: [] },
        override: null,
        resolved: { pinnedPaths: [], hiddenPaths: [], layers: [] },
      }),
      setProjectProfile: async () => undefined,
      setWorktreeProfile: async () => undefined,
      hidePath: async () => undefined,
      unhidePath: async () => undefined,
      pinPath: async () => undefined,
      unpinPath: async () => undefined,
      renamePath: renameScope,
    }
    const ops = createFilesOperations({
      workspaceFiles: fakeWorkspace({
        renamePath: async () => ({ ok: true, value: undefined }),
      }),
      scope,
    })

    await ops.renamePath({ projectPath: PROJECT, from: 'docs', to: 'notes' })

    expect(renameScope).toHaveBeenCalledWith(PROJECT, join(PROJECT, 'docs'), join(PROJECT, 'notes'))
  })

  it('maps already-exists, not-found, and destination-exists 1:1', async () => {
    const ops = createFilesOperations({
      workspaceFiles: fakeWorkspace({
        createFile: async () => ({
          ok: false,
          error: { code: 'already-exists', path: 'docs/empty.txt' },
        }),
        trashPath: async () => ({
          ok: false,
          error: { code: 'not-found', path: 'docs/old.md' },
        }),
        renamePath: async () => ({
          ok: false,
          error: { code: 'destination-exists' },
        }),
      }),
    })
    await expect(
      ops.createFile({ projectPath: '/r', path: 'docs/empty.txt' }),
    ).resolves.toMatchObject({ ok: false, error: { code: 'already-exists' } })
    await expect(ops.trashPath({ projectPath: '/r', path: 'docs/old.md' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'not-found' },
    })
    await expect(ops.renamePath({ projectPath: '/r', from: 'a', to: 'b' })).resolves.toMatchObject({
      ok: false,
      error: { code: 'destination-exists' },
    })
  })

  it('preserves exact per-operation result unions (read cannot return create-only errors)', () => {
    expectTypeOf<FilesOperations['readFile']>().toEqualTypeOf<WorkspaceFiles['readFile']>()
    expectTypeOf<FilesOperations['createFile']>().toEqualTypeOf<WorkspaceFiles['createFile']>()
    expectTypeOf<FilesOperations['renamePath']>().toEqualTypeOf<WorkspaceFiles['renamePath']>()

    type ReadError = Extract<
      Awaited<ReturnType<FilesOperations['readFile']>>,
      { ok: false }
    >['error']['code']
    type CreateError = Extract<
      Awaited<ReturnType<FilesOperations['createFile']>>,
      { ok: false }
    >['error']['code']
    type RenameError = Extract<
      Awaited<ReturnType<FilesOperations['renamePath']>>,
      { ok: false }
    >['error']['code']

    expectTypeOf<ReadError>().toEqualTypeOf<'path-outside-project'>()
    expectTypeOf<CreateError>().toEqualTypeOf<
      'path-outside-project' | 'already-exists' | 'not-found'
    >()
    expectTypeOf<RenameError>().toEqualTypeOf<
      'path-outside-project' | 'not-found' | 'destination-exists'
    >()

    expectTypeOf<{
      ok: false
      error: { code: 'already-exists'; path: string }
    }>().not.toMatchTypeOf<Awaited<ReturnType<FilesOperations['readFile']>>>()
    expectTypeOf<{
      ok: false
      error: { code: 'destination-exists' }
    }>().not.toMatchTypeOf<Awaited<ReturnType<FilesOperations['readFile']>>>()
  })

  it('publishes content-changed on successful write only', async () => {
    const { changes, facts } = recordingChanges()
    const ops = createFilesOperations({
      workspaceFiles: fakeWorkspace({
        writeTextFile: async () => ({ ok: true, value: undefined }),
      }),
      changes,
    })
    await ops.writeTextFile({ projectPath: PROJECT, path: 'src/a.ts', content: 'x' })
    expect(facts).toEqual([
      { type: 'files.content-changed', projectPath: PROJECT, paths: ['src/a.ts'] },
    ])
  })

  it('publishes tree-changed for create/folder/trash with the input path', async () => {
    const { changes, facts } = recordingChanges()
    const ops = createFilesOperations({
      workspaceFiles: fakeWorkspace({
        createFile: async () => ({ ok: true, value: undefined }),
        createFolder: async () => ({ ok: true, value: undefined }),
        trashPath: async () => ({ ok: true, value: undefined }),
      }),
      changes,
    })
    await ops.createFile({ projectPath: PROJECT, path: 'docs/n.txt' })
    await ops.createFolder({ projectPath: PROJECT, path: 'docs/dir' })
    await ops.trashPath({ projectPath: PROJECT, path: 'docs/old.md' })
    expect(facts).toEqual([
      { type: 'files.tree-changed', projectPath: PROJECT, paths: ['docs/n.txt'] },
      { type: 'files.tree-changed', projectPath: PROJECT, paths: ['docs/dir'] },
      { type: 'files.tree-changed', projectPath: PROJECT, paths: ['docs/old.md'] },
    ])
  })

  it('publishes unique from/to on rename and returned path on duplicate', async () => {
    const { changes, facts } = recordingChanges()
    const ops = createFilesOperations({
      workspaceFiles: fakeWorkspace({
        renamePath: async () => ({ ok: true, value: undefined }),
        duplicatePath: async () => ({ ok: true, value: 'src/a copy.ts' }),
      }),
      changes,
    })
    await ops.renamePath({ projectPath: PROJECT, from: 'a.ts', to: 'b.ts' })
    await ops.renamePath({ projectPath: PROJECT, from: 'same.ts', to: 'same.ts' })
    await ops.duplicatePath({ projectPath: PROJECT, path: 'src/a.ts' })
    expect(facts).toEqual([
      { type: 'files.tree-changed', projectPath: PROJECT, paths: ['a.ts', 'b.ts'] },
      { type: 'files.tree-changed', projectPath: PROJECT, paths: ['same.ts'] },
      { type: 'files.tree-changed', projectPath: PROJECT, paths: ['src/a copy.ts'] },
    ])
  })

  it('publishes nothing for read/preview or failed mutations', async () => {
    const { changes, facts } = recordingChanges()
    const ops = createFilesOperations({
      workspaceFiles: fakeWorkspace({
        readFile: async () => ({ ok: true, value: { type: 'text', content: 'x' } }),
        previewHtml: async () => ({ ok: true, value: null }),
        writeTextFile: async () => ({
          ok: false,
          error: { code: 'not-found', path: 'missing.ts' },
        }),
        createFile: async () => ({
          ok: false,
          error: { code: 'already-exists', path: 'x' },
        }),
      }),
      changes,
    })
    await ops.readFile({ projectPath: PROJECT, path: 'src/a.ts' })
    await ops.previewHtml({ projectPath: PROJECT, path: 'src/a.ts' })
    await ops.writeTextFile({ projectPath: PROJECT, path: 'missing.ts', content: '' })
    await ops.createFile({ projectPath: PROJECT, path: 'x' })
    expect(facts).toEqual([])
  })
})
