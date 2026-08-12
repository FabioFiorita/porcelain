import { join } from 'node:path'

/**
 * Repo-local companion data lives under `<repo>/.porcelain/` — board, actions,
 * scope, layers, notes, the active Review, and archived reviews. Machine secrets
 * (daemon token, remotes, UI prefs) stay in `~/.porcelain` / `PORCELAIN_HOME`.
 *
 * Users choose what to share with git via `.porcelain/.gitignore`. Evidence is
 * ignored by default (can be large); everything else is trackable by default.
 *
 * NODE-ONLY. The `node:path` import below externalizes in a browser bundle and
 * Metro cannot resolve it at all, so web and mobile may only `import type` from
 * this module. Anything a client needs at runtime belongs in
 * `@porcelain/client-runtime` — see `companion-disposition.ts` there.
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
  manifest: 'project-manifest.json',
} as const

export const PROJECT_EVIDENCE_DIR = 'evidence'
export const PROJECT_REVIEWS_DIR = 'reviews'

/**
 * The unit in flight lives in ONE directory, shaped exactly like an archived one
 * under `reviews/<id>/`. Archiving is then a directory move rather than five
 * per-file copies, the companion root stays legible (durable project data at the
 * top, the review in its own folder), and the whole active review is one ignore
 * rule instead of one per slot.
 */
export const PROJECT_ACTIVE_DIR = 'active-review'

/**
 * Channel names for the review in flight, prefixed with the active directory so
 * every existing path helper resolves inside it without a special case.
 */
export const ACTIVE_FILES = {
  review: `${PROJECT_ACTIVE_DIR}/review.json`,
  comments: `${PROJECT_ACTIVE_DIR}/comments.json`,
  reviewed: `${PROJECT_ACTIVE_DIR}/reviewed.json`,
} as const

/**
 * Intent as a document set rather than one field: `.porcelain/intent/` holds the
 * agent's case for the change in whatever medium carries it — markdown, or a
 * self-contained HTML page with its own CSS and images.
 * More than one file becomes more than one tab. Archived with the review.
 */
export const PROJECT_INTENT_DIR = 'intent'
/** Ordered tab manifest inside `intent/` — readdir order is filesystem-dependent. */
export const INTENT_MANIFEST = 'meta.json'
/** Conventional home for images an intent or evidence document references. */
export const ASSETS_DIR = 'assets'

/**
 * Evidence is three sub-tabs over one directory: structured checks (`meta.json`),
 * a document set (`evidence/results/`, the same primitive as Intent), and a
 * gallery (`evidence/assets/`). Results is its own folder so a screenshot beside
 * a report never gets mistaken for a document — and so the gallery can be a
 * plain directory listing rather than a manifest.
 */
export const EVIDENCE_RESULTS_DIR = 'results'

/**
 * The tabs an agent reaches for first when it has nothing to say yet. A
 * **recommended convention, not a schema**: `readDocSet` renders whatever is on
 * disk, in manifest order, whatever it is named. It lives here so the CLI
 * scaffolder and the skill that describes it cannot drift apart.
 */
export const INTENT_CANONICAL_TABS = [
  { file: 'why.md', label: 'Why' },
  { file: 'approach.md', label: 'Approach' },
  { file: 'decisions.md', label: 'Decisions' },
] as const

/**
 * Whether a channel is shared with the team through git or kept on this machine.
 * "Local" is not a second storage location — the file lives in `.porcelain/`
 * either way; local just means git ignores it. One place on disk, two git
 * dispositions, so there is never a "which copy wins" question.
 */
export type CompanionDisposition = 'shared' | 'local'

/**
 * The sentence each client renders under a channel row lives in
 * `@porcelain/client-runtime/companion-disposition` — this module reaches for
 * `node:path`, which Metro cannot resolve, so shared copy for the mobile client
 * cannot live here.
 */
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
    hint: 'Named commands for this project.',
    patterns: ['/actions.json'],
    defaultDisposition: 'shared',
  },
  {
    key: 'notes',
    label: 'Repo notes',
    hint: 'Your standing brief for agents.',
    patterns: ['/notes.md'],
    defaultDisposition: 'local',
  },
  {
    key: 'scope',
    label: 'Hidden & pinned paths',
    hint: 'Which parts of a monorepo matter.',
    patterns: ['/scope.json'],
    defaultDisposition: 'shared',
  },
  {
    key: 'layers',
    label: 'Flow layers',
    hint: 'How files group into a story.',
    patterns: ['/layers.json'],
    defaultDisposition: 'shared',
  },
  {
    key: 'board',
    label: 'Board',
    hint: 'A live work queue.',
    patterns: ['/board.json'],
    defaultDisposition: 'local',
  },
  {
    key: 'reviews',
    label: 'Reviews',
    hint: 'Publishing shares one at a time.',
    // Contents, not the directory: git cannot re-include a path whose PARENT is
    // excluded, so `/reviews/` would make publishing a single review impossible.
    patterns: ['/reviews/*'],
    defaultDisposition: 'local',
  },
] as const

/**
 * Always ignored, no toggle. Anchored (leading `/`) so a rule meant for the
 * companion root never swallows the same filename inside `reviews/<id>/`.
 *
 * - `feature-view.json` is a render snapshot, derived and stale on arrival.
 * - `active-review/` is the unit in flight — per branch, per worktree, and
 *   rewritten constantly. Publishing is what shares a review: it copies the
 *   directory to `reviews/<id>/` and re-includes that one folder. Tracking the
 *   live directory would put every agent's work-in-progress and every
 *   screenshot it took into everyone else's diff. The directory glob already
 *   covers everything the evidence pack grew — checks, `results/`, `assets/` —
 *   so no rule needs to name them.
 * - `.migrated-from-home` is a machine artifact from the home→repo migration.
 * - `project-manifest.json` is a per-checkout v1 root marker recreated on first
 *   write; it is not a `COMPANION_CHANNELS` toggle.
 * - `*.tmp` / `*.corrupt-*` are atomic-write debris.
 * - the per-review evidence glob keeps proof packs opt-in even when Reviews are
 *   shared (spelled out in the array — a block comment cannot hold that glob).
 */
export const ALWAYS_IGNORED = [
  '/feature-view.json',
  '/active-review/',
  '/.migrated-from-home',
  '/project-manifest.json',
  '*.tmp',
  '*.corrupt-*',
  'reviews/*/evidence/',
] as const

// The trailing prose is free to change: `renderGitignore` finds the opening
// marker by prefix, so a companion written by an older build is still replaced
// rather than duplicated.
const MANAGED_BEGIN = '# >>> porcelain:managed — Settings › Data owns these lines'
const MANAGED_END = '# <<< porcelain:managed'

/**
 * Re-include one published review, LAST so it beats the rules above it —
 * including the per-review evidence glob, because a review without its proof is
 * half a review and the publish dialog already priced the bytes.
 *
 * Two lines are required: the directory, then everything beneath it. Git will
 * not descend into an excluded directory, so re-including only `**` would never
 * be reached, and re-including only the directory would leave the evidence glob
 * winning underneath.
 */
function publishedLines(id: string): string[] {
  return [`!/${PROJECT_REVIEWS_DIR}/${id}/`, `!/${PROJECT_REVIEWS_DIR}/${id}/**`]
}

function managedBlock(
  dispositions: Record<string, CompanionDisposition>,
  published: readonly string[] = [],
): string {
  const lines: string[] = [MANAGED_BEGIN]
  for (const channel of COMPANION_CHANNELS) {
    const disposition = dispositions[channel.key] ?? channel.defaultDisposition
    if (disposition !== 'local') continue
    lines.push(...channel.patterns)
  }
  lines.push(...ALWAYS_IGNORED)
  for (const id of published) lines.push(...publishedLines(id))
  lines.push(MANAGED_END)
  return lines.join('\n')
}

/** Review ids this companion has published (negated back in). */
export function parsePublishedReviews(gitignore: string): string[] {
  const out = new Set<string>()
  const re = new RegExp(`^!/${PROJECT_REVIEWS_DIR}/([^/]+)/$`)
  for (const raw of gitignore.split('\n')) {
    const match = re.exec(raw.trim())
    if (match?.[1]) out.add(match[1])
  }
  return [...out]
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
  published: readonly string[] = parsePublishedReviews(current),
): string {
  const block = managedBlock(dispositions, published)
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
  return activeReviewPath(repoPath, PROJECT_EVIDENCE_DIR)
}

export function projectReviewsDir(repoPath: string): string {
  return projectPorcelainPath(repoPath, PROJECT_REVIEWS_DIR)
}

/** `<repo>/.porcelain/active-review` — the unit currently in flight. */
export function projectActiveReviewDir(repoPath: string): string {
  return projectPorcelainPath(repoPath, PROJECT_ACTIVE_DIR)
}

/** A file inside the active review (`review.json`, `comments.json`, …). */
export function activeReviewPath(repoPath: string, ...parts: string[]): string {
  return join(projectActiveReviewDir(repoPath), ...parts)
}

export function projectIntentDir(repoPath: string): string {
  return activeReviewPath(repoPath, PROJECT_INTENT_DIR)
}

/** `…/active-review/evidence/results` — the Results document set. */
export function projectEvidenceResultsDir(repoPath: string): string {
  return join(projectEvidenceDir(repoPath), EVIDENCE_RESULTS_DIR)
}

/** `…/active-review/evidence/assets` — the images the gallery lists. */
export function projectEvidenceAssetsDir(repoPath: string): string {
  return join(projectEvidenceDir(repoPath), ASSETS_DIR)
}

/** `…/active-review/intent/assets` — images an intent document references. */
export function projectIntentAssetsDir(repoPath: string): string {
  return join(projectIntentDir(repoPath), ASSETS_DIR)
}

export function projectArchivedReviewDir(repoPath: string, reviewId: string): string {
  return projectPorcelainPath(repoPath, PROJECT_REVIEWS_DIR, reviewId)
}
