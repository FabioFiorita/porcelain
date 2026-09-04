import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { exceedsReadLimit } from '../fs/read-limits'
import { parseStatus } from './diff'
import { runGit } from './git-exec'

function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

async function isUntracked(repoPath: string, path: string): Promise<boolean> {
  const status = await runGit(repoPath, ['status', '--porcelain=v1', '-uall', '-z', '--', path])
  return parseStatus(status)[0]?.status === 'untracked'
}

// The hash input for an untracked file (no diff vs HEAD): its bytes, tagged so it
// can't collide with a same-content tracked diff. An oversized file falls back to
// size rather than reading it whole into memory; a vanished file hashes empty (its mark then
// prunes). Deliberately omit mtime: fingerprints are content identities, never timestamps.
async function untrackedFingerprintInput(repoPath: string, path: string): Promise<string | Buffer> {
  const abs = join(repoPath, path)
  try {
    const info = await stat(abs)
    if (exceedsReadLimit(info.size)) return `untracked-large:${info.size}`
    return Buffer.concat([Buffer.from('untracked:'), await readFile(abs)])
  } catch {
    return ''
  }
}

/**
 * A content fingerprint for a reviewed mark: sha256 hex of the file's diff vs HEAD, so
 * the mark stops matching (and prunes) once the reviewed content changes. An untracked
 * file hashes its bytes instead; a clean/missing tracked file and an unborn branch hash
 * the empty diff, which never matches a mark taken when the file had changes.
 * `--no-renames` keeps this byte-identical to the batched `reviewedFingerprints`, whose
 * multi-path diff would otherwise pair a rename a single-path diff can't see.
 */
export async function reviewedFingerprint(repoPath: string, path: string): Promise<string> {
  let diff: string | null = null
  try {
    diff = await runGit(repoPath, ['diff', 'HEAD', '--no-renames', '--no-color', '--', path])
  } catch {
    diff = null // no HEAD yet (unborn branch) — treat like an untracked file
  }
  if (diff) return sha256Hex(diff) // non-empty diff: a modified tracked file
  // Empty diff (or no HEAD): an untracked file hashes its bytes; a clean/missing
  // tracked file hashes the empty diff so its mark prunes.
  if (diff === null || (await isUntracked(repoPath, path))) {
    return sha256Hex(await untrackedFingerprintInput(repoPath, path))
  }
  return sha256Hex('')
}

/**
 * Batched `reviewedFingerprint` at a constant spawn count (one `git diff`, plus a
 * `git status` only when some path has an empty diff) — the reconcile polls this every
 * few seconds. The combined diff splits on `diff --git ` header lines (never a content
 * line, which git prefixes with a space/±) so each chunk is byte-identical to that
 * path's single-file diff; a chunk is attributed by `+++ b/<path>`, or `--- a/<path>`
 * when deleted. Anything unattributable falls back to a per-path fingerprint.
 */
export async function reviewedFingerprints(
  repoPath: string,
  paths: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (paths.length === 0) return result

  let combined: string | null = null
  try {
    combined = await runGit(repoPath, [
      'diff',
      'HEAD',
      '--no-renames',
      '--no-color',
      '--',
      ...paths,
    ])
  } catch {
    // No HEAD yet (unborn branch): every path fingerprints as untracked, like the single case.
    for (const path of paths) {
      result.set(path, sha256Hex(await untrackedFingerprintInput(repoPath, path)))
    }
    return result
  }

  const wanted = new Set(paths)
  let hasUnattributable = false
  for (const chunk of splitDiffChunks(combined)) {
    const path = attributeDiffChunk(chunk)
    if (path !== null && wanted.has(path)) result.set(path, sha256Hex(chunk))
    else hasUnattributable = true
  }

  const remaining = paths.filter((path) => !result.has(path))
  if (remaining.length === 0) return result

  // An unattributable chunk belongs to one of the remaining paths but we can't tell which,
  // so resolve each remaining path on its own rather than mislabel an empty-diff path.
  if (hasUnattributable) {
    for (const path of remaining) result.set(path, await reviewedFingerprint(repoPath, path))
    return result
  }

  // Every remaining path has an empty diff: untracked hashes its bytes, clean hashes ''.
  const untracked = new Set(
    parseStatus(
      await runGit(repoPath, ['status', '--porcelain=v1', '-uall', '-z', '--', ...remaining]),
    )
      .filter((entry) => entry.status === 'untracked')
      .map((entry) => entry.path),
  )
  for (const path of remaining) {
    result.set(
      path,
      untracked.has(path)
        ? sha256Hex(await untrackedFingerprintInput(repoPath, path))
        : sha256Hex(''),
    )
  }
  return result
}

/**
 * Deterministic identity of the complete working change-set. Status preserves staged vs
 * unstaged state; per-file content fingerprints make a same-path edit stale without relying on
 * write time. This is persisted with a live Review Canvas, not exposed to clients.
 */
export async function workingTreeFingerprint(repoPath: string): Promise<string> {
  const files = parseStatus(await runGit(repoPath, ['status', '--porcelain=v1', '-uall', '-z']))
    .slice()
    .sort((left, right) => left.path.localeCompare(right.path))
  const fingerprints = await reviewedFingerprints(
    repoPath,
    files.map((file) => file.path),
  )
  return sha256Hex(
    JSON.stringify(
      files.map((file) => ({
        path: file.path,
        status: file.status,
        staged: file.staged === true,
        unstaged: file.unstaged === true,
        content: fingerprints.get(file.path) ?? '',
      })),
    ),
  )
}

/** Split a combined `git diff` into per-file chunks at each `diff --git ` header line. */
function splitDiffChunks(combined: string): string[] {
  const starts: number[] = []
  if (combined.startsWith('diff --git ')) starts.push(0)
  for (
    let pos = combined.indexOf('\ndiff --git ');
    pos !== -1;
    pos = combined.indexOf('\ndiff --git ', pos + 1)
  ) {
    starts.push(pos + 1)
  }
  return starts.map((start, i) => combined.slice(start, starts[i + 1]))
}

/** The repo-relative path a single-file diff chunk describes, or null if unattributable. */
function attributeDiffChunk(chunk: string): string | null {
  const lines = chunk.split('\n')
  const added = lines.find((line) => line.startsWith('+++ '))?.slice(4)
  if (added?.startsWith('b/')) return added.slice(2)
  const removed = lines.find((line) => line.startsWith('--- '))?.slice(4)
  if (removed?.startsWith('a/')) return removed.slice(2)
  return null
}
