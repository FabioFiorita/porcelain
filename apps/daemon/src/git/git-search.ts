import type { CodeSearchFile, GrepMatch } from './diff'
import { parseCodeSearch, parseGrep } from './diff'
import { gitErrorOutput, runGit } from './git-exec'

const MAX_GREP_MATCHES = 500

/**
 * `git grep` exits 1 when there are simply no matches — that's not a failure.
 * Any other exit code (or a non-exit error like a missing binary) IS a real
 * problem and must not be hidden as "no results".
 */
export function isNoMatchError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 1
}

/** Literal text search across tracked + untracked files; empty on no matches. */
export async function gitGrep(repoPath: string, query: string): Promise<GrepMatch[]> {
  try {
    const out = await runGit(repoPath, [
      'grep',
      '-n',
      '-I',
      '--untracked',
      '--fixed-strings',
      '-e',
      query,
    ])
    return parseGrep(out).slice(0, MAX_GREP_MATCHES)
  } catch (error) {
    if (isNoMatchError(error)) return [] // exit 1 = no matches, not a failure
    throw new Error(gitErrorOutput(error))
  }
}

export interface CodeSearchOptions {
  query: string
  /** Treat the query as an extended regular expression (`-E`) vs a literal (`-F`). */
  regex: boolean
  caseSensitive: boolean
  /** Comma-separated globs limiting / excluding the search (git pathspecs). */
  include: string
  exclude: string
}

export interface CodeSearchResult {
  files: CodeSearchFile[]
  /** True when whole files were dropped to stay under the match cap. */
  truncated: boolean
}

/** Context lines git grep shows on each side of a match in the Search tab. */
const CODE_SEARCH_CONTEXT = 2

function searchGlobs(value: string): string[] {
  return value
    .split(',')
    .map((glob) => glob.trim())
    .filter((glob) => glob !== '')
}

/** Keep whole files until the match cap is reached, flagging any drop. */
function capCodeSearch(files: CodeSearchFile[]): CodeSearchResult {
  const kept: CodeSearchFile[] = []
  let count = 0
  for (const file of files) {
    if (kept.length > 0 && count + file.matchCount > MAX_GREP_MATCHES) {
      return { files: kept, truncated: true }
    }
    kept.push(file)
    count += file.matchCount
  }
  return { files: kept, truncated: false }
}

/**
 * Rich repo-wide search backing the Search tab: literal/regex, case toggle,
 * include/exclude globs, and `-C` context lines grouped per file. Kept apart
 * from `gitGrep` (still used by the ⌘⇧F overlay + find-references) because the
 * output shape — context hunks, not flat matches — is genuinely different.
 */
export async function gitSearchCode(
  repoPath: string,
  options: CodeSearchOptions,
): Promise<CodeSearchResult> {
  const args = [
    'grep',
    '-n',
    '-I',
    '--untracked',
    '--heading',
    '--break',
    '-C',
    String(CODE_SEARCH_CONTEXT),
  ]
  if (!options.caseSensitive) args.push('-i')
  args.push(options.regex ? '-E' : '-F', '-e', options.query)
  const specs = [
    ...searchGlobs(options.include).map((glob) => `:(glob)${glob}`),
    ...searchGlobs(options.exclude).map((glob) => `:(exclude,glob)${glob}`),
  ]
  if (specs.length > 0) args.push('--', ...specs)
  try {
    return capCodeSearch(parseCodeSearch(await runGit(repoPath, args)))
  } catch (error) {
    if (isNoMatchError(error)) return { files: [], truncated: false }
    throw new Error(gitErrorOutput(error))
  }
}
