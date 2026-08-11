import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorFixtures, publicErrorSchema } from '@porcelain/contracts'
import { gitChangeSchema, gitProcedures } from '@porcelain/contracts/git'
import { describe, expect, it } from 'vitest'
import { gitWorkspaceMutations } from './git-mutations'
import { gitDiffQuery } from './git-queries'

const PROJECT = '/synthetic/repo'
const CHECKOUT_INPUT = { repoPath: PROJECT, branch: 'topic/synthetic' }
const ADD_WORKTREE_OUTPUT = {
  path: '/synthetic/repo-worktrees/topic-synthetic',
  branch: 'topic/synthetic',
}

const contractCatalog = {
  procedures: gitProcedures,
  notification: gitChangeSchema,
  publicError: publicErrorSchema,
}

function queryNames(queries: readonly { domain: string; name: string }[]): readonly string[] {
  return queries.map((query) => `${query.domain}/${query.name}`)
}

describe('gitWorkspaceMutations', () => {
  it('binds each definition to its canonical contract procedure', () => {
    expect(gitWorkspaceMutations.checkout.procedure).toBe(gitProcedures.gitCheckout)
    expect(gitWorkspaceMutations.checkout.procedureName).toBe('gitCheckout')
    expect(gitWorkspaceMutations.createBranch.procedure).toBe(gitProcedures.gitCreateBranch)
    expect(gitWorkspaceMutations.createBranch.procedureName).toBe('gitCreateBranch')
    expect(gitWorkspaceMutations.addWorktree.procedure).toBe(gitProcedures.gitAddWorktree)
    expect(gitWorkspaceMutations.addWorktree.procedureName).toBe('gitAddWorktree')
  })

  it('gives checkout and create-branch the same exact consequence set', () => {
    const checkout = gitWorkspaceMutations.checkout.affectedQueries(CHECKOUT_INPUT)
    const createBranch = gitWorkspaceMutations.createBranch.affectedQueries(CHECKOUT_INPUT)
    expect(checkout).toEqual(createBranch)
    expect(queryNames(checkout)).toEqual([
      'git/head',
      'git/flow',
      'git/range-flow',
      'git/status',
      'git/diff',
      'git/branches',
      'git/worktrees',
      'git/log',
      'git/commit-conventions',
      'git/suggestions',
      'review/reading',
      'review/view',
      'review/reviewed-paths',
      'review/worktree-inbox',
    ])
  })

  it('keeps add-worktree a strict branch/worktree/inbox subset', () => {
    const checkout = gitWorkspaceMutations.checkout.affectedQueries(CHECKOUT_INPUT)
    const addWorktree = gitWorkspaceMutations.addWorktree.affectedQueries(CHECKOUT_INPUT)
    expect(queryNames(addWorktree)).toEqual([
      'git/branches',
      'git/worktrees',
      'review/worktree-inbox',
    ])
    expect(checkout).toEqual(expect.arrayContaining(addWorktree))
    expect(addWorktree).toHaveLength(3)
    expect(checkout).toHaveLength(14)
    expect(addWorktree).not.toEqual(checkout)
  })

  it('declares authoritative, non-optimistic behavior for all three mutations', () => {
    for (const definition of Object.values(gitWorkspaceMutations)) {
      expect(definition.optimistic).toBe(false)
      expect(definition.requiresAuthoritativeRefetch).toBe(true)
      expect(Object.hasOwn(definition, 'optimisticTransition')).toBe(false)
    }
    expect(gitWorkspaceMutations.checkout.affectedQueries(CHECKOUT_INPUT)).toContainEqual(
      gitDiffQuery(PROJECT),
    )
  })

  it('dispatches contract-valid workspace successes through the TST-001 mock', async () => {
    const daemon = createValidatingDaemonMock(contractCatalog, {
      gitCheckout: () => ({ ok: true, value: undefined }),
      gitCreateBranch: () => ({ ok: true, value: undefined }),
      gitAddWorktree: () => ({ ok: true, value: ADD_WORKTREE_OUTPUT }),
    })

    const outcomes = await Promise.all([
      daemon.dispatch({
        procedure: gitWorkspaceMutations.checkout.procedureName,
        kind: gitWorkspaceMutations.checkout.procedure.kind,
        input: CHECKOUT_INPUT,
      }),
      daemon.dispatch({
        procedure: gitWorkspaceMutations.createBranch.procedureName,
        kind: gitWorkspaceMutations.createBranch.procedure.kind,
        input: CHECKOUT_INPUT,
      }),
      daemon.dispatch({
        procedure: gitWorkspaceMutations.addWorktree.procedureName,
        kind: gitWorkspaceMutations.addWorktree.procedure.kind,
        input: CHECKOUT_INPUT,
      }),
    ])

    expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, true, true])
    expect(daemon.requests().map((request) => request.procedure)).toEqual([
      'gitCheckout',
      'gitCreateBranch',
      'gitAddWorktree',
    ])
  })

  it('preserves a typed refusal as an observable public error without a local state patch', async () => {
    const refusal = publicErrorFixtures['git.working-tree-conflict']
    const daemon = createValidatingDaemonMock(contractCatalog, {
      gitCheckout: () => ({ ok: false, error: refusal }),
    })

    await expect(
      daemon.dispatch({
        procedure: gitWorkspaceMutations.checkout.procedureName,
        kind: gitWorkspaceMutations.checkout.procedure.kind,
        input: CHECKOUT_INPUT,
      }),
    ).resolves.toEqual({ ok: false, error: refusal })
    expect(gitWorkspaceMutations.checkout.optimistic).toBe(false)
  })
})
