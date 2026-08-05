import { LIVE_POLL_MS } from '@/lib/daemon/poll'
import {
  type DiffHunk,
  type DiffReadingScope,
  diffReadingQuery,
  type FeatureReading,
  type FileStatus,
  gitCommitDiffQuery,
  gitDiffFileQuery,
  gitRangeDiffFileQuery,
} from '@/lib/daemon/procedures/changes'
import { useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'

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
 * All three queries are declared because hooks cannot be conditional; the two that do not
 * match the source are disabled, so only one is ever in flight. Only the working tree polls —
 * a range is static until the next commit, and a commit hash is immutable.
 */
export function useDiffFile(filePath: string, source: DiffSource, active: boolean): DiffFile {
  const repo = useActiveRepo()
  const repoPath = repo?.path ?? ''
  const enabled = active && repo !== null
  const live = source.kind === 'working'
  const base = source.kind === 'branch' ? source.base : undefined
  const hash = source.kind === 'commit' ? source.hash : ''

  const working = useDaemonQuery(
    gitDiffFileQuery,
    { filePath, repoPath },
    {
      enabled: enabled && live,
      pollMs: live ? LIVE_POLL_MS : undefined,
      staleTime: 0,
    },
  )
  const range = useDaemonQuery(
    gitRangeDiffFileQuery,
    { base: base ?? '', filePath, repoPath },
    {
      enabled: enabled && base !== undefined,
    },
  )
  const commit = useDaemonQuery(
    gitCommitDiffQuery,
    { filePath, hash, repoPath },
    {
      enabled: enabled && hash !== '',
      staleTime: Number.POSITIVE_INFINITY,
    },
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
): { reading: FeatureReading | undefined; isLoading: boolean; error: Error | null } {
  const repo = useActiveRepo()
  const live = scope.type === 'working'
  const { data, error, isLoading } = useDaemonQuery(
    diffReadingQuery,
    { repoPath: repo?.path ?? '', scope },
    {
      enabled: active && repo !== null,
      placeholderData: 'keepPreviousData',
      pollMs: live ? LIVE_POLL_MS : undefined,
      staleTime: live ? 0 : undefined,
    },
  )
  return { error, isLoading, reading: data }
}
