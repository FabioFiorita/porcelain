import { type GitWorkspaceQuery, gitProjectKey } from './git-queries'

/**
 * The broad freshness consequences a mutation or notification declares when it cannot name a
 * file, hash, limit, or reading scope. A family is never a cache key — only an effect.
 */
type GitFamilyEffect =
  | { readonly domain: 'git'; readonly name: 'diff'; readonly projectPath: string }
  | { readonly domain: 'git'; readonly name: 'range-diff'; readonly projectPath: string }
  | { readonly domain: 'git'; readonly name: 'log-family'; readonly projectPath: string }
  | { readonly domain: 'git'; readonly name: 'file-log-family'; readonly projectPath: string }
  | { readonly domain: 'git'; readonly name: 'diff-reading-family'; readonly projectPath: string }
  | { readonly domain: 'git'; readonly name: 'review-presentation'; readonly projectPath: string }

/** Exact identities plus explicit broad families used by freshness consequences. */
export type GitQueryEffect = GitWorkspaceQuery | GitFamilyEffect

/** Semantic family for every per-file `gitDiffFile` wire query. */
export type GitDiffQuery = GitFamilyEffect & { readonly name: 'diff' }
export type GitRangeDiffQuery = GitFamilyEffect & { readonly name: 'range-diff' }
export type GitLogFamilyEffect = GitFamilyEffect & { readonly name: 'log-family' }
export type GitFileLogFamilyEffect = GitFamilyEffect & { readonly name: 'file-log-family' }
export type GitDiffReadingFamilyEffect = GitFamilyEffect & { readonly name: 'diff-reading-family' }
/** Review Canvas metadata changes the reading order for working, range, and commit views. */
export type GitReviewPresentationEffect = GitFamilyEffect & { readonly name: 'review-presentation' }

/** Semantic project family for all current working-tree file diff queries. */
export function gitDiffQuery(projectPath: string): GitDiffQuery {
  return { domain: 'git', name: 'diff', projectPath: gitProjectKey(projectPath) }
}

export function gitRangeDiffQuery(projectPath: string): GitRangeDiffQuery {
  return { domain: 'git', name: 'range-diff', projectPath: gitProjectKey(projectPath) }
}

export function gitLogQueryFamily(projectPath: string): GitLogFamilyEffect {
  return { domain: 'git', name: 'log-family', projectPath: gitProjectKey(projectPath) }
}

export function gitFileLogQueryFamily(projectPath: string): GitFileLogFamilyEffect {
  return { domain: 'git', name: 'file-log-family', projectPath: gitProjectKey(projectPath) }
}

export function gitDiffReadingQueryFamily(projectPath: string): GitDiffReadingFamilyEffect {
  return { domain: 'git', name: 'diff-reading-family', projectPath: gitProjectKey(projectPath) }
}

export function gitReviewPresentationEffect(projectPath: string): GitReviewPresentationEffect {
  return { domain: 'git', name: 'review-presentation', projectPath: gitProjectKey(projectPath) }
}

/** Return the project dimension shared by all project-scoped exact identities. */
export function gitQueryProjectPath(query: GitQueryEffect): string | undefined {
  return 'projectPath' in query ? query.projectPath : undefined
}

/** Match one typed exact/family effect against one exact cached identity. */
export function gitQueryEffectMatchesQuery(
  query: GitWorkspaceQuery,
  effect: GitQueryEffect,
): boolean {
  if (query.domain !== effect.domain) return false
  const effectProject = gitQueryProjectPath(effect)
  if (effectProject !== undefined && gitQueryProjectPath(query) !== effectProject) return false
  switch (effect.name) {
    case 'diff':
      return query.domain === 'git' && query.name === 'diff-file'
    case 'range-diff':
      return query.domain === 'git' && query.name === 'range-diff-file'
    case 'log-family':
      return query.domain === 'git' && query.name === 'log'
    case 'file-log-family':
      return query.domain === 'git' && query.name === 'file-log'
    case 'diff-reading-family':
      return query.domain === 'git' && query.name === 'diff-reading'
    case 'review-presentation':
      return (
        query.domain === 'git' &&
        (query.name === 'flow' ||
          query.name === 'range-flow' ||
          query.name === 'commit-flow' ||
          query.name === 'diff-reading')
      )
    default:
      return (
        baseAgnosticMatch(query, effect) || gitQueryEffectKey(query) === gitQueryEffectKey(effect)
      )
  }
}

/**
 * A Branch-scope effect names a SCOPE, not a comparison base.
 *
 * Since a reviewer can compare their branch against any ref, one project can hold
 * several cached branch-range identities at once — `origin/main`, `develop`, the
 * upstream. A commit or a fetch invalidates all of them, and the mutation that
 * declares the consequence has no idea which ones a client is holding. So an
 * effect built WITHOUT a base ("the branch view is stale") matches every base;
 * an effect that names one still matches only that one.
 */
function baseAgnosticMatch(query: GitWorkspaceQuery, effect: GitQueryEffect): boolean {
  if (query.domain !== 'git' || effect.domain !== 'git') return false
  if (query.name === 'range-flow' && effect.name === 'range-flow') return effect.base === undefined
  return (
    query.name === 'diff-reading' &&
    effect.name === 'diff-reading' &&
    query.scope.type === 'branch' &&
    effect.scope.type === 'branch' &&
    effect.scope.base === undefined
  )
}

function gitQueryEffectKey(effect: GitQueryEffect): string {
  return JSON.stringify(effect)
}

/** Deduplicate effect declarations while preserving their first-seen order. */
export function dedupeGitQueryEffects(
  effects: readonly GitQueryEffect[],
): readonly GitQueryEffect[] {
  const seen = new Set<string>()
  const result: GitQueryEffect[] = []
  for (const effect of effects) {
    const key = gitQueryEffectKey(effect)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(effect)
  }
  return result
}
