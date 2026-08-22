import { type BranchRef, type GitHead, isSingleRefToken } from '@porcelain/contracts/git'
import { parseWorktrees, type Worktree } from './diff'
import { runGit, runGitChecked } from './git-exec'

/**
 * What HEAD points at in this checkout. `--abbrev-ref` answers the literal string
 * `HEAD` when detached, which is not a branch anyone can check out — so a detached
 * HEAD reports `branch: null` plus the short sha instead of that lie. A named
 * branch also resolves `@{u}` so push can tell a first publish from a regular
 * push. Detached HEAD reports no upstream.
 */
export async function gitHead(repoPath: string): Promise<GitHead> {
  const name = (await runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
  if (name === 'HEAD') {
    const sha = (await runGit(repoPath, ['rev-parse', '--short', 'HEAD'])).trim()
    return { branch: null, detachedSha: sha, upstream: null }
  }
  return { branch: name, detachedSha: null, upstream: await currentUpstream(repoPath) }
}

async function currentUpstream(repoPath: string): Promise<string | null> {
  try {
    const upstream = (
      await runGit(repoPath, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
    ).trim()
    return upstream === '' ? null : upstream
  } catch {
    return null
  }
}

export async function gitWorktrees(repoPath: string): Promise<Worktree[]> {
  return parseWorktrees(await runGit(repoPath, ['worktree', 'list', '--porcelain']))
}

export async function gitBranches(repoPath: string): Promise<BranchRef[]> {
  const [localOut, remoteOut] = await Promise.all([
    runGit(repoPath, ['branch', '--format=%(refname:short)']),
    runGit(repoPath, ['for-each-ref', 'refs/remotes', '--format=%(refname:short)']),
  ])
  const lines = (out: string): string[] =>
    out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

  const local = lines(localOut)
  const localNames = new Set(local)
  const branches: BranchRef[] = local.map((name) => ({ name, remote: null }))

  for (const ref of lines(remoteOut)) {
    // `refname:short` renders `refs/remotes/origin/HEAD` as just `origin` and
    // `refs/remotes/origin/main` as `origin/main`; split off the first segment.
    const slash = ref.indexOf('/')
    if (slash === -1) continue // origin/HEAD — no branch part
    const remote = ref.slice(0, slash)
    const name = ref.slice(slash + 1)
    if (name === 'HEAD' || localNames.has(name)) continue
    branches.push({ name, remote })
  }
  return branches
}

/** Create a branch off the current HEAD and switch to it. Throws git's own
 *  message (e.g. "a branch named 'x' already exists") for the UI to surface. */
export async function gitCreateBranch(repoPath: string, branch: string): Promise<void> {
  await runGitChecked(repoPath, ['checkout', '-b', branch])
}

/**
 * The base ref a branch review is measured against: the remote's default branch
 * (origin/HEAD, e.g. "origin/main") if known, else a local main/master.
 */
export async function gitDefaultBranch(repoPath: string): Promise<string> {
  try {
    const ref = (await runGit(repoPath, ['rev-parse', '--abbrev-ref', 'origin/HEAD'])).trim()
    if (ref && ref !== 'origin/HEAD') return ref
  } catch {
    // no remote / origin/HEAD unset — fall through to local heuristics
  }
  for (const candidate of ['main', 'master']) {
    try {
      await runGit(repoPath, ['rev-parse', '--verify', '--quiet', candidate])
      return candidate
    } catch {
      // not present; try next
    }
  }
  return 'main' // last resort; range is empty if it doesn't exist
}

/**
 * Resolve the ref a Branch review is measured against.
 *
 * Everything a client asks to compare against passes through here before it can
 * reach git's argv, because the resolved value is spliced into `merge-base` /
 * `diff` invocations. The rules are deliberately narrow:
 *
 * - `undefined` / empty → the default base (`gitDefaultBranch`), i.e. today's behaviour.
 * - `@{u}` (or `@{upstream}`) → the current branch's own upstream, expanded to its
 *   short name (`origin/main`) so the "vs …" label names a ref a human recognises.
 * - anything else must `rev-parse` to a `refs/heads/` or `refs/remotes/` ref.
 *
 * A raw SHA, a tag, `HEAD~3`, a `--flag`, or a deleted branch all fail — a SHA has
 * no symbolic full name, and the option guard plus `--end-of-options` keep a
 * hostile string from being read as an option even before git sees it.
 *
 * Throws `UnknownCompareBaseError` so callers can choose: the flow falls back to
 * the default (a branch you deleted should not brick the panel), while a per-file
 * range read refuses, because it was handed an already-resolved base.
 */
export class UnknownCompareBaseError extends Error {
  constructor(ref: string) {
    super(`Not a branch or remote-tracking ref: ${ref}`)
    this.name = 'UnknownCompareBaseError'
  }
}

const UPSTREAM_BASES = new Set(['@{u}', '@{upstream}'])

export async function gitResolveCompareBase(
  repoPath: string,
  requested?: string | undefined,
): Promise<string> {
  const ref = requested?.trim() ?? ''
  if (ref === '') return gitDefaultBranch(repoPath)
  if (ref.startsWith('-') || !isSingleRefToken(ref) || ref.length > 255) {
    throw new UnknownCompareBaseError(ref)
  }
  if (UPSTREAM_BASES.has(ref)) {
    const upstream = await symbolicRef(repoPath, ['--abbrev-ref', '@{u}'])
    if (upstream === '') throw new UnknownCompareBaseError(ref)
    return upstream
  }
  const candidates =
    ref.startsWith('refs/heads/') || ref.startsWith('refs/remotes/')
      ? [ref]
      : [`refs/heads/${ref}`, `refs/remotes/${ref}`]
  for (const candidate of candidates) {
    if (await refExists(repoPath, candidate)) return ref
  }
  throw new UnknownCompareBaseError(ref)
}

/**
 * Does this EXACT full ref exist?
 *
 * `show-ref --verify` rather than `rev-parse`, deliberately. rev-parse speaks
 * revision syntax — it would happily accept a raw SHA, a tag, `HEAD~3`, or
 * `main@{yesterday}`, none of which are a branch a reviewer chose from a list.
 * Verifying a full `refs/…` name accepts branches and remote-tracking refs and
 * nothing else, and a hostile string is inert once it is prefixed.
 */
async function refExists(repoPath: string, fullRef: string): Promise<boolean> {
  try {
    await runGit(repoPath, ['show-ref', '--verify', '--quiet', fullRef])
    return true
  } catch {
    return false
  }
}

/** `git rev-parse` for a ref name, with "git said no" flattened to the empty string. */
async function symbolicRef(repoPath: string, args: string[]): Promise<string> {
  try {
    return (await runGit(repoPath, ['rev-parse', ...args])).trim()
  } catch {
    return ''
  }
}
