import { filesPinsQuery, filesTreeSubtreeEffect } from '@porcelain/client-runtime/files'
import { createValidatingDaemonMock } from '@porcelain/client-runtime/testing/daemon-mock'
import { publicErrorFixtures, publicErrorSchema } from '@porcelain/contracts'
import { gitChangeSchema, gitProcedures } from '@porcelain/contracts/git'
import { describe, expect, it } from 'vitest'

import { gitMutations } from './git-mutations'
import { gitDiffQuery } from './git-query-effects'

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

function names(queries: readonly { domain: string; name: string }[]): readonly string[] {
  return queries.map((query) => `${query.domain}/${query.name}`)
}

describe('gitMutations', () => {
  it('binds every definition to its canonical contract procedure', () => {
    expect(gitMutations.checkout.procedure).toBe(gitProcedures.gitCheckout)
    expect(gitMutations.createBranch.procedure).toBe(gitProcedures.gitCreateBranch)
    expect(gitMutations.addWorktree.procedure).toBe(gitProcedures.gitAddWorktree)
    expect(gitMutations.quickCommand.procedure).toBe(gitProcedures.gitQuickCommand)
    expect(gitMutations.push.procedure).toBe(gitProcedures.gitPush)
    expect(gitMutations.stageAll.procedure).toBe(gitProcedures.gitStageAll)
    expect(gitMutations.unstageAll.procedure).toBe(gitProcedures.gitUnstageAll)
    expect(gitMutations.stageFile.procedure).toBe(gitProcedures.gitStageFile)
    expect(gitMutations.unstageFile.procedure).toBe(gitProcedures.gitUnstageFile)
    expect(gitMutations.discardFile.procedure).toBe(gitProcedures.gitDiscardFile)
    expect(gitMutations.commit.procedure).toBe(gitProcedures.gitCommit)
    expect(gitMutations.generateMessage.procedure).toBe(gitProcedures.gitGenerateCommitMessage)
    expect(gitMutations.generateGroups.procedure).toBe(gitProcedures.gitGenerateCommitGroups)
  })

  it('keeps workspace consequences explicit and includes the working diff family', () => {
    const checkout = gitMutations.checkout.affectedQueries(CHECKOUT_INPUT)
    const addWorktree = gitMutations.addWorktree.affectedQueries(CHECKOUT_INPUT)
    expect(names(checkout)).toContain('git/diff')
    expect(names(checkout)).toContain('git/range-diff')
    expect(names(checkout)).toContain('review/inbox')
    expect(names(addWorktree)).toEqual(['git/branches', 'git/worktrees', 'review/inbox'])
    expect(gitMutations.checkout.filesEffects(CHECKOUT_INPUT)).toEqual([])
  })

  it('uses a typed, narrow Files consequence for discard', () => {
    const input = { repoPath: PROJECT, path: 'src/a.ts' }
    expect(gitMutations.discardFile.filesEffects(input)).toEqual([
      filesTreeSubtreeEffect(PROJECT, 'src/a.ts'),
      { type: 'exact', query: filesPinsQuery(PROJECT) },
    ])
  })

  it('declares exact mutation consequences and no optimism', () => {
    expect(
      names(gitMutations.stageFile.affectedQueries({ repoPath: PROJECT, path: 'src/a.ts' })),
    ).toEqual(['git/flow', 'git/status', 'git/diff', 'git/diff-reading', 'git/suggestions'])
    expect(
      gitMutations.quickCommand.affectedQueries({ repoPath: PROJECT, command: 'status' }),
    ).toEqual([])
    expect(
      names(gitMutations.quickCommand.affectedQueries({ repoPath: PROJECT, command: 'stash' })),
    ).toEqual(['git/flow', 'git/status', 'git/diff', 'git/diff-reading', 'git/suggestions'])
    for (const definition of Object.values(gitMutations)) {
      expect(definition.optimistic).toBe(false)
      expect(definition.requiresAuthoritativeRefetch).toBe(true)
      expect(Object.hasOwn(definition, 'optimisticTransition')).toBe(false)
    }
    expect(gitMutations.checkout.affectedQueries(CHECKOUT_INPUT)).toContainEqual(
      gitDiffQuery(PROJECT),
    )
  })

  it('refreshes the working, range, history and Review surfaces after a commit', () => {
    const effects = names(
      gitMutations.commit.affectedQueries({ message: 'feat: x', repoPath: PROJECT }),
    )
    expect(effects).toEqual([
      'git/flow',
      'git/status',
      'git/diff',
      'git/diff-reading',
      'git/suggestions',
      'git/diff-reading',
      'git/head',
      'git/range-flow',
      'git/range-diff',
      'git/log-family',
      'git/file-log-family',
      'git/commit-conventions',
      'review/reading',
      'review/active',
      'review/reviewed-paths',
    ])
    expect(new Set(effects).size).toBe(effects.length - 1)
    expect(names(gitMutations.push.affectedQueries({ repoPath: PROJECT }))).toEqual([
      'git/head',
      'git/range-flow',
      'git/range-diff',
      'git/log-family',
      'git/file-log-family',
      'git/commit-conventions',
      'git/suggestions',
      'review/reading',
      'review/active',
      'review/reviewed-paths',
    ])
    expect(
      names(gitMutations.quickCommand.affectedQueries({ command: 'fetch', repoPath: PROJECT })),
    ).toEqual(['git/head', 'git/range-flow', 'git/branches', 'git/log-family', 'git/suggestions'])
    expect(
      gitMutations.generateMessage.affectedQueries({ model: 'claude', repoPath: PROJECT }),
    ).toEqual([])
  })

  it('dispatches contract-valid workspace successes through the validating mock', async () => {
    const daemon = createValidatingDaemonMock(contractCatalog, {
      gitCheckout: () => ({ ok: true, value: undefined }),
      gitCreateBranch: () => ({ ok: true, value: undefined }),
      gitAddWorktree: () => ({ ok: true, value: ADD_WORKTREE_OUTPUT }),
    })

    const outcomes = await Promise.all([
      daemon.dispatch({
        procedure: gitMutations.checkout.procedureName,
        kind: gitMutations.checkout.procedure.kind,
        input: CHECKOUT_INPUT,
      }),
      daemon.dispatch({
        procedure: gitMutations.createBranch.procedureName,
        kind: gitMutations.createBranch.procedure.kind,
        input: CHECKOUT_INPUT,
      }),
      daemon.dispatch({
        procedure: gitMutations.addWorktree.procedureName,
        kind: gitMutations.addWorktree.procedure.kind,
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

  it('preserves a typed refusal without a local state patch', async () => {
    const refusal = publicErrorFixtures['git.working-tree-conflict']
    const daemon = createValidatingDaemonMock(contractCatalog, {
      gitCheckout: () => ({ ok: false, error: refusal }),
    })

    await expect(
      daemon.dispatch({
        procedure: gitMutations.checkout.procedureName,
        kind: gitMutations.checkout.procedure.kind,
        input: CHECKOUT_INPUT,
      }),
    ).resolves.toEqual({ ok: false, error: refusal })
    expect(gitMutations.checkout.optimistic).toBe(false)
  })
})
