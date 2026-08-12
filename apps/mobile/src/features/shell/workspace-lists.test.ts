import type { BranchRef, Worktree } from '@porcelain/contracts/git'
import { describe, expect, it } from 'vitest'

import {
  blockingWorktree,
  branchLabel,
  branchRowFacts,
  deriveWorkspaceIdentity,
  errorMessage,
  localBranchNames,
  matchBranches,
  workspaceTestId,
} from './workspace-lists'

const local = (name: string): BranchRef => ({ name, remote: null })
const remote = (name: string, on: string): BranchRef => ({ name, remote: on })
const worktree = (path: string, branch: string): Worktree => ({ branch, path })

describe('errorMessage', () => {
  it('prefers the refusal git itself wrote', () => {
    expect(errorMessage(new Error('fatal: bad ref'), 'Checkout failed.')).toBe('fatal: bad ref')
  })

  it('falls back when there is nothing to read', () => {
    expect(errorMessage(new Error(''), 'Checkout failed.')).toBe('Checkout failed.')
    expect(errorMessage('nope', 'Checkout failed.')).toBe('Checkout failed.')
    expect(errorMessage(undefined, 'Checkout failed.')).toBe('Checkout failed.')
  })
})

describe('workspaceTestId', () => {
  it('slugs a path into a stable identity', () => {
    expect(workspaceTestId('project-row', '/home/me/code/porcelain')).toBe(
      'porcelain-project-row-home-me-code-porcelain',
    )
  })

  it('never emits a trailing or leading separator', () => {
    expect(workspaceTestId('branch-row', '/feat/x/')).toBe('porcelain-branch-row-feat-x')
  })

  it('names an unslugabble value rather than emitting an empty id', () => {
    expect(workspaceTestId('worktree-row', '///')).toBe('porcelain-worktree-row-item')
  })

  it('caps the slug so a deep path cannot grow an unbounded id', () => {
    const id = workspaceTestId('project-row', '/very/long'.repeat(40))
    expect(id.length).toBe('porcelain-project-row-'.length + 80)
  })
})

describe('matchBranches', () => {
  const branches = [local('main'), local('feat/keyboard'), remote('main', 'origin')]

  it('splits local from remote', () => {
    const { local: locals, remote: remotes } = matchBranches(branches, '')
    expect(locals.map((branch) => branch.name)).toEqual(['main', 'feat/keyboard'])
    expect(remotes.map(branchLabel)).toEqual(['origin/main'])
  })

  it('matches case-insensitively and ignores surrounding space', () => {
    expect(matchBranches(branches, '  KEY ').local.map((branch) => branch.name)).toEqual([
      'feat/keyboard',
    ])
  })

  // A remote branch is only findable by the label the row shows.
  it('matches a remote on its qualified label', () => {
    expect(matchBranches(branches, 'origin/').remote.map(branchLabel)).toEqual(['origin/main'])
    expect(matchBranches(branches, 'origin/').local).toEqual([])
  })
})

describe('localBranchNames', () => {
  // The create form must reject a name git already knows, even one the search filtered away.
  it('lists every local name, remotes excluded', () => {
    expect(localBranchNames([local('main'), remote('main', 'origin'), local('wip')])).toEqual([
      'main',
      'wip',
    ])
  })
})

describe('blockingWorktree', () => {
  const worktrees = [worktree('/repo', 'main'), worktree('/repo-worktrees/wip', 'wip')]

  it('finds the other checkout holding a branch', () => {
    expect(blockingWorktree(worktrees, 'wip', '/repo')?.path).toBe('/repo-worktrees/wip')
  })

  // Standing in it is not being blocked by it.
  it('ignores the worktree we are standing in', () => {
    expect(blockingWorktree(worktrees, 'main', '/repo')).toBeUndefined()
  })

  it('returns nothing for a branch no worktree holds', () => {
    expect(blockingWorktree(worktrees, 'feat/x', '/repo')).toBeUndefined()
  })
})

describe('branchRowFacts', () => {
  const worktrees = [worktree('/repo', 'main'), worktree('/repo-worktrees/wip', 'wip')]

  it('marks the checked-out branch as current', () => {
    expect(branchRowFacts(local('main'), 'main', worktrees, '/repo')).toEqual({
      accessibilityLabel: 'main',
      blocked: false,
      detail: 'Current branch',
      label: 'main',
      selected: true,
    })
  })

  it('sends a blocked branch to the worktree that holds it', () => {
    const facts = branchRowFacts(local('wip'), 'main', worktrees, '/repo')
    expect(facts.blocked).toBe(true)
    expect(facts.detail).toBe('Checked out in /repo-worktrees/wip · switch worktree')
    expect(facts.accessibilityLabel).toBe('wip, checked out in another worktree')
  })

  it('labels a remote row and never selects it', () => {
    expect(branchRowFacts(remote('main', 'origin'), 'main', worktrees, '/repo')).toMatchObject({
      detail: 'Remote branch',
      label: 'origin/main',
      selected: false,
    })
  })

  it('leaves a plain local row without a detail line', () => {
    expect(branchRowFacts(local('feat/x'), 'main', worktrees, '/repo').detail).toBeUndefined()
  })
})

describe('deriveWorkspaceIdentity', () => {
  const base = {
    branch: 'main',
    branchFailed: false,
    environmentNickname: 'Beelink',
    mainWorktreePath: '/home/me/code/porcelain',
    projectName: 'porcelain',
    projectPath: '/home/me/code/porcelain',
  }

  it('names the three chips from the main checkout', () => {
    expect(deriveWorkspaceIdentity(base)).toEqual({
      branch: 'main',
      environmentLabel: 'Beelink',
      projectInitial: 'P',
      projectName: 'porcelain',
      worktree: 'Main',
    })
  })

  // The collision this function exists to prevent: in a linked worktree the project chip must
  // still say the project, and the worktree chip must say the folder we stand in.
  it('keeps the project name when standing in a linked worktree', () => {
    const identity = deriveWorkspaceIdentity({
      ...base,
      branch: 'wip',
      projectName: 'wip',
      projectPath: '/home/me/code/porcelain-worktrees/wip',
    })
    expect(identity.projectName).toBe('porcelain')
    expect(identity.worktree).toBe('wip')
  })

  it('falls back to the active folder while the roster is unread', () => {
    const identity = deriveWorkspaceIdentity({ ...base, mainWorktreePath: null })
    expect(identity.projectName).toBe('porcelain')
    expect(identity.worktree).toBe('porcelain')
  })

  it('says nothing is open when no project is', () => {
    expect(
      deriveWorkspaceIdentity({
        ...base,
        branch: null,
        environmentNickname: null,
        mainWorktreePath: null,
        projectName: null,
        projectPath: '',
      }),
    ).toEqual({
      branch: 'No project',
      environmentLabel: 'No environment',
      projectInitial: 'P',
      projectName: 'Project',
      worktree: 'No project',
    })
  })

  // A HEAD still in flight is not a HEAD that failed.
  it('separates a pending HEAD from a failed one', () => {
    expect(deriveWorkspaceIdentity({ ...base, branch: null }).branch).toBe('…')
    expect(deriveWorkspaceIdentity({ ...base, branch: null, branchFailed: true }).branch).toBe(
      'No branch',
    )
  })
})
