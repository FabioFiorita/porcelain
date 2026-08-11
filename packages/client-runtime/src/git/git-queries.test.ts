import { describe, expect, it } from 'vitest'
import {
  GitIdentityError,
  gitBranchesQuery,
  gitCommitConventionsQuery,
  gitDiffQuery,
  gitFlowQuery,
  gitHeadQuery,
  gitLogQuery,
  gitQuerySchema,
  gitRangeFlowQuery,
  gitStatusQuery,
  gitSuggestionsQuery,
  gitWorkspaceQuerySchema,
  gitWorktreesQuery,
  reviewedPathsQuery,
  reviewReadingQuery,
  reviewViewQuery,
  reviewWorkspaceQuerySchema,
  worktreeInboxQuery,
} from './git-queries'

const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other-repo'

const gitQueries = [
  gitHeadQuery,
  gitFlowQuery,
  gitRangeFlowQuery,
  gitStatusQuery,
  gitDiffQuery,
  gitBranchesQuery,
  gitWorktreesQuery,
  gitLogQuery,
  gitCommitConventionsQuery,
  gitSuggestionsQuery,
] as const

const reviewQueries = [
  reviewReadingQuery,
  reviewViewQuery,
  reviewedPathsQuery,
  worktreeInboxQuery,
] as const

describe('Git workspace query identities', () => {
  it('keeps each identity project-scoped and equal for the same project', () => {
    for (const query of gitQueries) {
      expect(query(PROJECT)).toEqual(query(PROJECT))
      expect(query(PROJECT).projectPath).toBe(PROJECT)
      expect(query(PROJECT)).not.toEqual(query(OTHER_PROJECT))
    }
    for (const query of reviewQueries) {
      expect(query(PROJECT)).toEqual(query(PROJECT))
      expect(query(PROJECT).projectPath).toBe(PROJECT)
      expect(query(PROJECT)).not.toEqual(query(OTHER_PROJECT))
    }
  })

  it('represents the per-file diff procedure as one project-scoped semantic family', () => {
    expect(gitDiffQuery(PROJECT)).toEqual({
      domain: 'git',
      name: 'diff',
      projectPath: PROJECT,
    })
  })

  it('accepts every constructor result through its owning strict schema', () => {
    for (const query of gitQueries) {
      expect(gitQuerySchema.safeParse(query(PROJECT)).success).toBe(true)
    }
    for (const query of reviewQueries) {
      expect(reviewWorkspaceQuerySchema.safeParse(query(PROJECT)).success).toBe(true)
      expect(gitWorkspaceQuerySchema.safeParse(query(PROJECT)).success).toBe(true)
    }
  })

  it('rejects empty, extra-field, foreign-domain, and unknown-name identities', () => {
    expect(() => gitHeadQuery('')).toThrow(GitIdentityError)
    expect(() => reviewViewQuery('')).toThrow('project path must be non-empty')
    expect(gitQuerySchema.safeParse({ domain: 'git', name: 'head', projectPath: '' }).success).toBe(
      false,
    )
    expect(
      gitQuerySchema.safeParse({ domain: 'git', name: 'head', projectPath: PROJECT, extra: true })
        .success,
    ).toBe(false)
    expect(
      gitQuerySchema.safeParse({ domain: 'review', name: 'head', projectPath: PROJECT }).success,
    ).toBe(false)
    expect(
      gitWorkspaceQuerySchema.safeParse({ domain: 'git', name: 'unknown', projectPath: PROJECT })
        .success,
    ).toBe(false)
  })
})
