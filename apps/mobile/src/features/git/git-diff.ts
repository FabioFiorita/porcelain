import {
  type DiffReadingScope,
  gitCommitDiffQuery,
  gitDiffFileQuery,
  gitDiffReadingQuery,
  gitRangeDiffFileQuery,
} from '@porcelain/client-runtime/git'
import type { DiffHunk, DiffReadingOutput, FileStatus } from '@porcelain/contracts/git'
import { gitProcedures } from '@porcelain/contracts/git'
import { LIVE_POLL_MS } from '@/lib/daemon/poll'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { useGitQuery, useGitScope } from './use-git-transport'

const diffFileProcedure = namedContractProcedure('gitDiffFile', gitProcedures.gitDiffFile)
const rangeDiffFileProcedure = namedContractProcedure(
  'gitRangeDiffFile',
  gitProcedures.gitRangeDiffFile,
)
const commitDiffProcedure = namedContractProcedure('gitCommitDiff', gitProcedures.gitCommitDiff)
const diffReadingProcedure = namedContractProcedure('diffReading', gitProcedures.diffReading)

/**
 * Which diff a file surface reads.
 *
 * `branch` carries the ref the range is measured against, which is `undefined` until the flow
 * read that names it lands. There is nothing to ask git for until then, so the surface stays
 * loading rather than falling back to the working tree and flashing a different diff.
 */
export type DiffSource =
  | { kind: 'working' }
  | { kind: 'branch'; base: string | undefined }
  | { kind: 'commit'; hash: string }

/** The base ref in `DiffSource` terms — the Changes tab's two scopes are one axis. */
export function changesDiffSource(base: string | undefined): DiffSource {
  return base === undefined ? { kind: 'working' } : { kind: 'branch', base }
}

export type DiffFile = {
  hunks: DiffHunk[] | undefined
  /** Working tree and range only: the commit form returns its hunks bare. */
  status: FileStatus | undefined
  image: { dataUrl: string } | undefined
  binary: boolean
  isLoading: boolean
  error: Error | null
}

/**
 * One file's diff from whichever source the surface reads.
 *
 * All three identities are declared because hooks cannot be conditional; the two that do not
 * match the source are disabled, so only one is ever in flight. Only the working tree polls —
 * a range is static until the next commit, and a commit hash is immutable.
 */
export function useDiffFile(filePath: string, source: DiffSource, active: boolean): DiffFile {
  const scope = useGitScope()
  const enabled = scope.ready && active
  const live = source.kind === 'working'
  const base = source.kind === 'branch' ? source.base : undefined
  const hash = source.kind === 'commit' ? source.hash : ''

  const working = useGitQuery(
    gitDiffFileQuery(scope.projectPath, filePath),
    diffFileProcedure,
    { filePath, repoPath: scope.repoPath },
    { enabled: enabled && live, pollMs: live ? LIVE_POLL_MS : undefined, staleTime: 0 },
  )
  const range = useGitQuery(
    gitRangeDiffFileQuery(scope.projectPath, base ?? '', filePath),
    rangeDiffFileProcedure,
    { base: base ?? '', filePath, repoPath: scope.repoPath },
    { enabled: enabled && base !== undefined },
  )
  const commit = useGitQuery(
    gitCommitDiffQuery(scope.projectPath, hash, filePath),
    commitDiffProcedure,
    { filePath, hash, repoPath: scope.repoPath },
    { enabled: enabled && hash !== '', staleTime: Number.POSITIVE_INFINITY },
  )

  if (source.kind === 'commit') {
    return {
      binary: false,
      error: commit.error,
      hunks: commit.data,
      image: undefined,
      isLoading: commit.isLoading,
      status: undefined,
    }
  }
  // A branch scope whose base has not landed yet has no query running at all, so neither
  // result would report the wait — say so here instead of rendering an empty diff.
  if (source.kind === 'branch' && base === undefined) {
    return {
      binary: false,
      error: null,
      hunks: undefined,
      image: undefined,
      isLoading: true,
      status: undefined,
    }
  }

  const query = live ? working : range
  return {
    binary: query.data?.binary === true,
    error: query.error,
    hunks: query.data?.hunks,
    image: query.data?.image,
    isLoading: query.isLoading,
    status: query.data?.status,
  }
}

/**
 * The whole change set as one document: every file with its hunks inlined, in flow order.
 * One read instead of N, which is what makes the stacked surface usable over a phone link.
 */
export function useDiffReading(
  scope: DiffReadingScope,
  active: boolean,
): { reading: DiffReadingOutput | undefined; isLoading: boolean; error: Error | null } {
  const git = useGitScope()
  const live = scope.type === 'working'
  const { data, error, isLoading } = useGitQuery(
    gitDiffReadingQuery(git.projectPath, scope),
    diffReadingProcedure,
    { repoPath: git.repoPath, scope },
    {
      enabled: git.ready && active,
      keepPreviousData: true,
      pollMs: live ? LIVE_POLL_MS : undefined,
      staleTime: live ? 0 : undefined,
    },
  )
  return { error, isLoading, reading: data }
}
