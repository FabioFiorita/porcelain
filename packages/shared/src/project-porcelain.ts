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
 * Default ignore for a new `.porcelain/`. Teams delete lines to track more
 * (e.g. evidence for a shared proof pack).
 */
export const DEFAULT_PROJECT_GITIGNORE = `# Porcelain project companion — edit freely.
# Evidence packs can be large; ignored by default. Remove a line to track it.
evidence/
reviews/*/evidence/
`

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
