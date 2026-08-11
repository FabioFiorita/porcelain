// @vitest-environment node
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { createFilesOperations, type FilesOperations } from './files-operations'
import type { WorkspaceFiles } from './files-ports'

function fakeWorkspace(overrides: Partial<WorkspaceFiles> = {}): WorkspaceFiles {
  const reject: never = undefined as never
  return {
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

describe('createFilesOperations', () => {
  it('maps adapter path-outside without touching fs', async () => {
    const readFile = vi.fn(async () => ({
      ok: false as const,
      error: { code: 'path-outside-project' as const, path: 'escape' },
    }))
    const ops = createFilesOperations({ workspaceFiles: fakeWorkspace({ readFile }) })
    await expect(ops.readFile({ projectPath: '/synthetic/repo', path: 'escape' })).resolves.toEqual(
      {
        ok: false,
        error: { code: 'path-outside-project', path: 'escape' },
      },
    )
    expect(readFile).toHaveBeenCalledOnce()
  })

  it('passes through success values', async () => {
    const createFile = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const ops = createFilesOperations({ workspaceFiles: fakeWorkspace({ createFile }) })
    await expect(
      ops.createFile({ projectPath: '/synthetic/repo', path: 'docs/empty.txt' }),
    ).resolves.toEqual({ ok: true, value: undefined })
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

    // Create-only / rename-only codes must not be assignable to read failures.
    expectTypeOf<{
      ok: false
      error: { code: 'already-exists'; path: string }
    }>().not.toMatchTypeOf<Awaited<ReturnType<FilesOperations['readFile']>>>()
    expectTypeOf<{
      ok: false
      error: { code: 'destination-exists' }
    }>().not.toMatchTypeOf<Awaited<ReturnType<FilesOperations['readFile']>>>()
  })
})
