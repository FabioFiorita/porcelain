// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createFilesOperations } from './files-operations'
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
})
