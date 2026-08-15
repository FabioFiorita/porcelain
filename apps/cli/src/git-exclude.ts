import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { OVERLAY_CHANNELS, PROJECT_PORCELAIN_DIR } from '@shared/project-porcelain'

/**
 * The CLI's synchronous twin of the daemon's `revealCompanionOverlay`
 * (apps/daemon/src/project/git-exclude.ts). Same file, same managed lines, same
 * refusal to touch a repo that never hid its companion — the CLI just cannot
 * import the daemon (CLI-001: node: builtins and @shared only), so the constants
 * are re-derived from the same `OVERLAY_CHANNELS` index rather than re-invented.
 *
 * Promotion writes tracked bytes into `<repo>/.porcelain/`, which git is blind to
 * while `info/exclude` carries the directory-form line. Rewriting that line to
 * `.porcelain/*` plus one negation per overlay channel makes ONLY the overlay
 * visible; every other companion channel stays exactly as hidden as before.
 */

const MARKER = '# Porcelain companion — hidden from git in this clone only.'
const EXCLUDE_LINE = `${PROJECT_PORCELAIN_DIR}/`
const OVERLAY_EXCLUDE_LINE = `${PROJECT_PORCELAIN_DIR}/*`
const OVERLAY_NEGATIONS = OVERLAY_CHANNELS.map((channel) =>
  channel.kind === 'directory'
    ? `!${PROJECT_PORCELAIN_DIR}/${channel.path}/`
    : `!${PROJECT_PORCELAIN_DIR}/${channel.path}`,
)

const MANAGED_LINES = new Set<string>([
  MARKER,
  EXCLUDE_LINE,
  PROJECT_PORCELAIN_DIR,
  OVERLAY_EXCLUDE_LINE,
  ...OVERLAY_NEGATIONS,
])

/** `$GIT_COMMON_DIR/info/exclude` — one file per clone, shared by every worktree. */
function excludeFilePath(repoPath: string): string | null {
  let common: string
  try {
    common = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: repoPath,
      encoding: 'utf8',
      // Not a repo is an answer, not an incident: never print git's fatal.
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
  if (common === '') return null
  return join(isAbsolute(common) ? common : resolve(repoPath, common), 'info', 'exclude')
}

function readLines(path: string): string[] {
  try {
    return readFileSync(path, 'utf8').split('\n')
  } catch {
    return []
  }
}

function hasLine(lines: string[]): boolean {
  return lines.some((line) => {
    const trimmed = line.trim()
    return (
      trimmed === EXCLUDE_LINE ||
      trimmed === PROJECT_PORCELAIN_DIR ||
      trimmed === OVERLAY_EXCLUDE_LINE
    )
  })
}

function hasOverlayLines(lines: string[]): boolean {
  const present = new Set(lines.map((line) => line.trim()))
  return present.has(OVERLAY_EXCLUDE_LINE) && OVERLAY_NEGATIONS.every((line) => present.has(line))
}

/**
 * Make the promoted overlay — and only the overlay — visible to git in this
 * clone. Returns true when the exclude file changed. A repo that never hid its
 * companion is left completely alone, so this can never widen what is shared.
 */
export function revealCompanionOverlay(repoPath: string): boolean {
  const path = excludeFilePath(repoPath)
  if (path === null) return false
  const lines = readLines(path)
  if (!hasLine(lines)) return false
  if (hasOverlayLines(lines)) return false
  const kept = lines.filter((line) => !MANAGED_LINES.has(line.trim()))
  const body = kept.join('\n').replace(/\n+$/, '')
  const block = [MARKER, OVERLAY_EXCLUDE_LINE, ...OVERLAY_NEGATIONS].join('\n')
  writeFileSync(path, body === '' ? `${block}\n` : `${body}\n${block}\n`)
  return true
}
