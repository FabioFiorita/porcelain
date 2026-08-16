import { reviewedPathsQuery } from '@porcelain/client-runtime/review'
import { describe, expect, it } from 'vitest'
import {
  GitIdentityError,
  gitBranchesQuery,
  gitCommitConventionsQuery,
  gitCommitDiffQuery,
  gitCommitFlowQuery,
  gitCommitMessageQuery,
  gitCommitModelsQuery,
  gitDiffFileQuery,
  gitDiffReadingQuery,
  gitFileLogQuery,
  gitFlowQuery,
  gitHeadQuery,
  gitLogQuery,
  gitQuerySchema,
  gitRangeDiffFileQuery,
  gitRangeFlowQuery,
  gitStatusQuery,
  gitSuggestionsQuery,
  gitWorkspaceQuerySchema,
  gitWorktreesQuery,
} from './git-queries'
import {
  dedupeGitQueryEffects,
  gitDiffQuery,
  gitDiffReadingQueryFamily,
  gitFileLogQueryFamily,
  gitLogQueryFamily,
  gitQueryEffectMatchesQuery,
  gitQueryProjectPath,
  gitRangeDiffQuery,
} from './git-query-effects'

const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other-repo'

describe('Git query identities', () => {
  it('keeps exact identities project-scoped and strict', () => {
    const queries = [
      gitHeadQuery(PROJECT),
      gitFlowQuery(PROJECT),
      gitRangeFlowQuery(PROJECT),
      gitStatusQuery(PROJECT),
      gitDiffFileQuery(PROJECT, 'src/a.ts'),
      gitRangeDiffFileQuery(PROJECT, 'main', 'src/a.ts'),
      gitCommitDiffQuery(PROJECT, 'abc123', 'src/a.ts'),
      gitDiffReadingQuery(PROJECT, { type: 'commit', hash: 'abc123' }),
      gitBranchesQuery(PROJECT),
      gitWorktreesQuery(PROJECT),
      gitLogQuery(PROJECT, 50),
      gitFileLogQuery(PROJECT, 'src/a.ts', 10),
      gitCommitMessageQuery(PROJECT, 'abc123'),
      gitCommitFlowQuery(PROJECT, 'abc123'),
      gitCommitConventionsQuery(PROJECT),
      gitSuggestionsQuery(PROJECT),
      gitCommitModelsQuery(),
    ]

    for (const query of queries) {
      expect(gitQuerySchema.safeParse(query).success).toBe(true)
    }
    expect(gitCommitModelsQuery()).toEqual({ domain: 'git', name: 'commit-models' })
    expect(gitLogQuery(PROJECT, 50)).not.toEqual(gitLogQuery(PROJECT, 200))
    expect(gitFileLogQuery(PROJECT, 'src/a.ts', 10)).not.toEqual(
      gitFileLogQuery(PROJECT, 'src/a.ts', 50),
    )
    expect(gitDiffReadingQuery(PROJECT, { type: 'working' })).not.toEqual(
      gitDiffReadingQuery(PROJECT, { type: 'branch' }),
    )
    expect(gitDiffFileQuery(PROJECT, 'src/a.ts')).not.toEqual(gitDiffFileQuery(PROJECT, 'src/b.ts'))
    expect(gitCommitMessageQuery(PROJECT, 'abc123')).not.toEqual(
      gitCommitMessageQuery(PROJECT, 'def456'),
    )
  })

  it('keeps every project identity distinct by project path', () => {
    expect(gitHeadQuery(PROJECT)).not.toEqual(gitHeadQuery(OTHER_PROJECT))
    expect(gitDiffFileQuery(PROJECT, 'src/a.ts')).not.toEqual(
      gitDiffFileQuery(OTHER_PROJECT, 'src/a.ts'),
    )
    expect(gitDiffReadingQuery(PROJECT, { type: 'working' })).not.toEqual(
      gitDiffReadingQuery(OTHER_PROJECT, { type: 'working' }),
    )
  })

  it('matches family effects to every exact query in that family only', () => {
    const diff = gitDiffFileQuery(PROJECT, 'src/a.ts')
    const rangeDiff = gitRangeDiffFileQuery(PROJECT, 'main', 'src/a.ts')
    const log = gitLogQuery(PROJECT, 200)
    const fileLog = gitFileLogQuery(PROJECT, 'src/a.ts', 50)
    const reading = gitDiffReadingQuery(PROJECT, { type: 'working' })

    expect(gitQueryEffectMatchesQuery(diff, gitDiffQuery(PROJECT))).toBe(true)
    expect(gitQueryEffectMatchesQuery(rangeDiff, gitRangeDiffQuery(PROJECT))).toBe(true)
    expect(gitQueryEffectMatchesQuery(log, gitLogQueryFamily(PROJECT))).toBe(true)
    expect(gitQueryEffectMatchesQuery(fileLog, gitFileLogQueryFamily(PROJECT))).toBe(true)
    expect(gitQueryEffectMatchesQuery(reading, gitDiffReadingQueryFamily(PROJECT))).toBe(true)
    expect(gitQueryEffectMatchesQuery(diff, gitRangeDiffQuery(PROJECT))).toBe(false)
    expect(gitQueryEffectMatchesQuery(gitHeadQuery(OTHER_PROJECT), gitHeadQuery(PROJECT))).toBe(
      false,
    )
    expect(gitQueryEffectMatchesQuery(gitLogQuery(PROJECT, 50), gitLogQuery(PROJECT, 200))).toBe(
      false,
    )
  })

  it('keeps the relocated reviewed-path identity in gitWorkspaceQuerySchema', () => {
    const queries = [reviewedPathsQuery(PROJECT)]
    for (const query of queries) {
      expect(gitWorkspaceQuerySchema.safeParse(query).success).toBe(true)
    }
  })

  it('rejects invalid or foreign identities', () => {
    expect(() => gitHeadQuery('')).toThrow(GitIdentityError)
    expect(() => gitDiffReadingQuery(PROJECT, { type: 'commit', hash: '' })).not.toThrow()
    expect(gitQuerySchema.safeParse({ domain: 'git', name: 'head', projectPath: '' }).success).toBe(
      false,
    )
    expect(
      gitQuerySchema.safeParse({
        domain: 'git',
        name: 'diff-file',
        projectPath: PROJECT,
        filePath: 'src/a.ts',
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      gitQuerySchema.safeParse({ domain: 'review', name: 'head', projectPath: PROJECT }).success,
    ).toBe(false)
    expect(
      gitWorkspaceQuerySchema.safeParse({ domain: 'git', name: 'unknown', projectPath: PROJECT })
        .success,
    ).toBe(false)
  })

  it('deduplicates repeated effects while preserving first-seen order', () => {
    const effects = dedupeGitQueryEffects([
      gitFlowQuery(PROJECT),
      gitDiffQuery(PROJECT),
      gitFlowQuery(PROJECT),
      gitDiffQuery(OTHER_PROJECT),
    ])
    expect(effects).toEqual([
      gitFlowQuery(PROJECT),
      gitDiffQuery(PROJECT),
      gitDiffQuery(OTHER_PROJECT),
    ])
  })

  it('reports the project dimension of exact and family effects', () => {
    expect(gitQueryProjectPath(gitFlowQuery(PROJECT))).toBe(PROJECT)
    expect(gitQueryProjectPath(gitLogQueryFamily(PROJECT))).toBe(PROJECT)
    expect(gitQueryProjectPath(gitCommitModelsQuery())).toBeUndefined()
  })
})
