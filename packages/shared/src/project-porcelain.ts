import { join } from 'node:path'

/**
 * Repo-local companion data lives under `<repo>/.porcelain/` — board, actions,
 * scope, layers, notes, the active Review, and archived reviews. Machine secrets
 * (daemon token, remotes, UI prefs) stay in `~/.porcelain` / `PORCELAIN_HOME`.
 *
 * Users choose what to share with git via `.porcelain/.gitignore`. Evidence is
 * ignored by default (can be large); everything else is trackable by default.
 */

export const PROJECT_PORCELAIN_DIR = '.porcelain'

/** Filenames under `.porcelain/` (active / project-wide channels). */
export const PROJECT_FILES = {
  actions: 'actions.json',
  board: 'board.json',
  layers: 'layers.json',
  scope: 'scope.json',
  notes: 'notes.md',
  review: 'review.json',
  comments: 'comments.json',
  reviewed: 'reviewed.json',
  featureView: 'feature-view.json',
  gitignore: '.gitignore',
} as const

export const PROJECT_EVIDENCE_DIR = 'evidence'
export const PROJECT_REVIEWS_DIR = 'reviews'

/**
 * Whether a channel is shared with the team through git or kept on this machine.
 * "Local" is not a second storage location — the file lives in `.porcelain/`
 * either way; local just means git ignores it. One place on disk, two git
 * dispositions, so there is never a "which copy wins" question.
 */
export type CompanionDisposition = 'shared' | 'local'

export interface CompanionChannel {
  key: string
  label: string
  /** What the human loses or gains by sharing it — rendered under the toggle. */
  hint: string
  /** Ignore patterns, anchored to `.porcelain/` so depth is never ambiguous. */
  patterns: string[]
  defaultDisposition: CompanionDisposition
}

/**
 * The channels the human chooses a disposition for. Everything else under
 * `.porcelain/` is either derived or per-checkout and is always ignored
 * (`ALWAYS_IGNORED` below) — offering a toggle for those would only let someone
 * commit a snapshot that goes stale the moment anyone else opens the repo.
 */
export const COMPANION_CHANNELS: readonly CompanionChannel[] = [
  {
    key: 'actions',
    label: 'Saved actions',
    hint: 'Named commands for this project. Shared actions from a clone must be trusted before they run.',
    patterns: ['/actions.json'],
    defaultDisposition: 'shared',
  },
  {
    key: 'notes',
    label: 'Repo notes',
    hint: 'The standing brief agents read before they work.',
    patterns: ['/notes.md'],
    defaultDisposition: 'shared',
  },
  {
    key: 'scope',
    label: 'Hidden & pinned paths',
    hint: 'Which parts of a monorepo matter. About the tree, so usually worth sharing.',
    patterns: ['/scope.json'],
    defaultDisposition: 'shared',
  },
  {
    key: 'layers',
    label: 'Flow layers',
    hint: 'How files group into a story in the Review.',
    patterns: ['/layers.json'],
    defaultDisposition: 'shared',
  },
  {
    key: 'board',
    label: 'Board',
    hint: 'A live work queue that turns over constantly — local keeps it out of everyone else’s diff.',
    patterns: ['/board.json'],
    defaultDisposition: 'local',
  },
  {
    key: 'reviews',
    label: 'Reviews',
    hint: 'Local keeps reviews to yourself; publish still shares one review at a time.',
    patterns: ['/reviews/'],
    defaultDisposition: 'local',
  },
] as const

/**
 * Always ignored, no toggle. Anchored (leading `/`) so a rule meant for the
 * companion root never swallows the same filename inside `reviews/<id>/`.
 *
 * - `feature-view.json` is a render snapshot, derived and stale on arrival.
 * - `review.json` names the checkout's active review — per branch, per worktree.
 * - `.migrated-from-home` is a machine artifact from the home→repo migration.
 * - `*.tmp` / `*.corrupt-*` are atomic-write debris.
 * - the per-review evidence glob keeps proof packs opt-in even when Reviews are
 *   shared (spelled out in the array — a block comment cannot hold that glob).
 */
export const ALWAYS_IGNORED = [
  '/feature-view.json',
  '/review.json',
  '/reviewed.json',
  '/comments.json',
  '/.migrated-from-home',
  '*.tmp',
  '*.corrupt-*',
  'reviews/*/evidence/',
] as const

const MANAGED_BEGIN = '# >>> porcelain:managed — Settings › Companion owns these lines'
const MANAGED_END = '# <<< porcelain:managed'

function managedBlock(dispositions: Record<string, CompanionDisposition>): string {
  const lines: string[] = [MANAGED_BEGIN]
  for (const channel of COMPANION_CHANNELS) {
    const disposition = dispositions[channel.key] ?? channel.defaultDisposition
    if (disposition !== 'local') continue
    lines.push(...channel.patterns)
  }
  lines.push(...ALWAYS_IGNORED, MANAGED_END)
  return lines.join('\n')
}

function defaultDispositions(): Record<string, CompanionDisposition> {
  return Object.fromEntries(COMPANION_CHANNELS.map((c) => [c.key, c.defaultDisposition]))
}

/**
 * Default ignore for a new `.porcelain/`. Everything outside the managed block
 * is the human's to edit; Porcelain only ever rewrites between the markers.
 */
export const DEFAULT_PROJECT_GITIGNORE = `# Porcelain project companion.
# Lines outside the managed block are yours — Porcelain never touches them.

${managedBlock(defaultDispositions())}
`

/**
 * Read each channel's disposition back out of a `.gitignore`. A channel counts
 * as local when ANY of its patterns is ignored anywhere in the file, so a human
 * who hand-writes \`board.json\` outside the block still reads as local rather
 * than having the UI lie about it.
 */
export function parseDispositions(gitignore: string): Record<string, CompanionDisposition> {
  const active = new Set(
    gitignore
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#')),
  )
  return Object.fromEntries(
    COMPANION_CHANNELS.map((channel) => [
      channel.key,
      channel.patterns.some((p) => active.has(p) || active.has(p.replace(/^\//, '')))
        ? 'local'
        : 'shared',
    ]),
  )
}

/**
 * Rewrite only the managed block, preserving the human's own lines and their
 * order. Appends the block when the file has none (an older companion, or one
 * a human trimmed).
 */
export function renderGitignore(
  current: string,
  dispositions: Record<string, CompanionDisposition>,
): string {
  const block = managedBlock(dispositions)
  const lines = current.split('\n')
  const begin = lines.findIndex((l) => l.trim().startsWith('# >>> porcelain:managed'))
  const end = lines.findIndex((l) => l.trim() === MANAGED_END)
  if (begin === -1 || end === -1 || end < begin) {
    const base = current.trimEnd()
    return base === '' ? `${block}\n` : `${base}\n\n${block}\n`
  }
  return [...lines.slice(0, begin), block, ...lines.slice(end + 1)].join('\n').replace(/\n+$/, '\n')
}

export function projectPorcelainDir(repoPath: string): string {
  return join(repoPath, PROJECT_PORCELAIN_DIR)
}

export function projectPorcelainPath(repoPath: string, ...parts: string[]): string {
  return join(projectPorcelainDir(repoPath), ...parts)
}

export function projectEvidenceDir(repoPath: string): string {
  return projectPorcelainPath(repoPath, PROJECT_EVIDENCE_DIR)
}

export function projectReviewsDir(repoPath: string): string {
  return projectPorcelainPath(repoPath, PROJECT_REVIEWS_DIR)
}

export function projectArchivedReviewDir(repoPath: string, reviewId: string): string {
  return projectPorcelainPath(repoPath, PROJECT_REVIEWS_DIR, reviewId)
}
