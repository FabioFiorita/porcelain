// @vitest-environment node
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isWorkspaceRef, resolveWorkspace, type WorkspaceInventory } from './mcp-workspace'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'porcelain-workspace-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

function inventory(path: string): WorkspaceInventory {
  return {
    projects: [
      {
        id: 'proj-1',
        path,
        worktrees: [{ id: 'wt-1', path, isPrimary: true }],
      },
    ],
  }
}

describe('isWorkspaceRef', () => {
  it.each([
    ['/repo'],
    [{ projectId: 'proj-1' }],
    [{ projectId: 'proj-1', worktreeId: 'wt-1' }],
  ])('accepts %j', (value) => {
    expect(isWorkspaceRef(value)).toBe(true)
  })

  it.each([[''], [null], [42], [{}], [{ worktreeId: 'wt-1' }]])('refuses %j', (value) => {
    expect(isWorkspaceRef(value)).toBe(false)
  })
})

describe('resolveWorkspace', () => {
  it('resolves a checkout path to the identity the Hub minted', async () => {
    const result = await resolveWorkspace(root, inventory(root))
    expect(result).toEqual({
      ok: true,
      value: { projectId: 'proj-1', worktreeId: 'wt-1', worktreePath: root },
    })
  })

  it('resolves a subdirectory — an agent rarely stands at the root', async () => {
    const nested = join(root, 'apps', 'daemon')
    await mkdir(nested, { recursive: true })
    const result = await resolveWorkspace(nested, inventory(root))
    expect(result.ok && result.value.worktreeId).toBe('wt-1')
  })

  it('resolves through a symlink but not a lookalike', async () => {
    const link = join(root, '..', `link-${Date.now()}`)
    await symlink(root, link)
    try {
      const viaLink = await resolveWorkspace(link, inventory(root))
      expect(viaLink.ok).toBe(true)
    } finally {
      await rm(link, { force: true })
    }
    const lookalike = `${root}-other`
    await mkdir(lookalike, { recursive: true })
    try {
      const result = await resolveWorkspace(lookalike, inventory(root))
      expect(result.ok).toBe(false)
    } finally {
      await rm(lookalike, { recursive: true, force: true })
    }
  })

  it('refuses a checkout Porcelain has not opened, and says what fixes it', async () => {
    const stranger = await mkdtemp(join(tmpdir(), 'porcelain-stranger-'))
    try {
      const result = await resolveWorkspace(stranger, inventory(root))
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.message).toMatch(/Open it in the Porcelain app first/)
      // The refusal has to name a Project, or "pass {projectId}" is a dead end: an
      // agent has no other way to learn an id, so it guesses or goes around the tool.
      expect(result.message).toContain('proj-1')
      expect(result.message).toContain(root)
    } finally {
      await rm(stranger, { recursive: true, force: true })
    }
  })

  it('refuses a directory that does not exist', async () => {
    const result = await resolveWorkspace(join(root, 'nope'), inventory(root))
    expect(result.ok).toBe(false)
  })

  it('takes the primary worktree when addressed by project id alone', async () => {
    const result = await resolveWorkspace({ projectId: 'proj-1' }, inventory(root))
    expect(result.ok && result.value.worktreeId).toBe('wt-1')
  })

  it('refuses ids this daemon does not know', async () => {
    expect((await resolveWorkspace({ projectId: 'nope' }, inventory(root))).ok).toBe(false)
    expect(
      (await resolveWorkspace({ projectId: 'proj-1', worktreeId: 'nope' }, inventory(root))).ok,
    ).toBe(false)
  })
})
