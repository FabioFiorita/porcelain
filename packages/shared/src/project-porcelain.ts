import { join } from 'node:path'

/**
 * Repo-local companion data lives under `<repo>/.porcelain/` — explicit Git
 * overlays only. Machine secrets
 * (daemon token, remotes, UI prefs) stay in `~/.porcelain` / `PORCELAIN_HOME`.
 *
 * Users choose what to share with git via `.porcelain/.gitignore`. Evidence is
 * ignored by default (can be large); everything else is trackable by default.
 *
 * NODE-ONLY. The `node:path` import below externalizes in a browser bundle and
 * Metro cannot resolve it at all, so web and mobile may only `import type` from
 * this module. Anything a client needs at runtime belongs in
 * `@porcelain/client-runtime` — see `project-data` there.
 */

export const PROJECT_PORCELAIN_DIR = '.porcelain'

/** Filenames under `.porcelain/` (active / project-wide channels). */
export const PROJECT_FILES = {
  actions: 'actions.json',
  layers: 'layers.json',
  gitignore: '.gitignore',
  manifest: 'project-manifest.json',
} as const

/**
 * The two literals `project-manifest.json` carries. Project Data is the only
 * writer; the CLI reads them to refuse a write into a companion root some newer
 * Porcelain laid out differently, rather than silently converting it.
 */
export const PROJECT_COMPANION_LAYOUT = 'project-companion-v1' as const
export const PROJECT_COMPANION_FORMAT_VERSION = 1 as const

/**
 * Whether a channel is shared with the team through git or kept on this machine.
 * "Local" is not a second storage location — the file lives in `.porcelain/`
 * either way; local just means git ignores it. One place on disk, two git
 * dispositions, so there is never a "which copy wins" question.
 */
export type CompanionDisposition = 'shared' | 'local'

/**
 * The sentence each client renders under a channel row lives in
 * `@porcelain/client-runtime/project-data` — this module reaches for
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
    key: 'layers',
    label: 'Flow layers',
    hint: 'How files group into a story.',
    patterns: ['/layers.json'],
    defaultDisposition: 'shared',
  },
] as const

/**
 * Always ignored, no toggle. Anchored (leading `/`) so a rule meant for the
 * companion root never swallows paths in the tracked overlay.
 *
 * - `project-manifest.json` is a per-checkout v1 root marker recreated on first
 *   write; it is not a `COMPANION_CHANNELS` toggle.
 * - `*.tmp` / `*.corrupt-*` are atomic-write debris.
 */
export const ALWAYS_IGNORED = ['/project-manifest.json', '*.tmp', '*.corrupt-*'] as const

// The trailing prose is free to change: `renderGitignore` finds the opening
// marker by prefix, so a companion written by an older build is still replaced
// rather than duplicated.
const MANAGED_BEGIN = '# >>> porcelain:managed — Settings › Data owns these lines'
const MANAGED_END = '# <<< porcelain:managed'

function managedBlock(dispositions: Record<string, CompanionDisposition>): string {
  const lines: string[] = [MANAGED_BEGIN]
  for (const channel of COMPANION_CHANNELS) {
    const disposition = dispositions[channel.key] ?? channel.defaultDisposition
    if (disposition !== 'local') continue
    lines.push(...channel.patterns)
  }
  lines.push(...ALWAYS_IGNORED)
  lines.push(MANAGED_END)
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
 * who hand-writes a channel path outside the block still reads as local rather
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

/**
 * The Git overlay (ADR 0002 / #26). Everything above this block is the legacy
 * repo-local companion; everything below is the OPT-IN tracked overlay a human
 * creates by promoting private daemon-root Project data into the repository.
 *
 * `.porcelain/` is never created by merely opening a repo — promotion is the
 * only thing that materializes these paths, and once promoted the tracked file
 * is the canonical source (the private copy is MOVED, never duplicated), so a
 * Canvas can never have a private and a tracked version that diverge.
 *
 * `OVERLAY_CHANNELS` is the index: one entry per kind of promotable data, so
 * adding Actions later (once they live in the daemon-root Project store, #24)
 * is one more channel here plus one more reader — not a second overlay design.
 */
export const OVERLAY_CANVASES_DIR = 'canvases'
export const OVERLAY_OVERRIDES_FILE = 'project.json'
/** Per-bundle manifest — one record in the daemon-root `StoredCanvas` shape. */
export const OVERLAY_CANVAS_MANIFEST_FILE = 'canvas.json'

export const OVERLAY_CHANNELS = [
  { key: 'canvases', kind: 'directory', path: OVERLAY_CANVASES_DIR },
  { key: 'overrides', kind: 'file', path: OVERLAY_OVERRIDES_FILE },
] as const satisfies readonly {
  key: string
  kind: 'directory' | 'file'
  path: string
}[]

export type OverlayChannelKey = (typeof OVERLAY_CHANNELS)[number]['key']

/** `<repo>/.porcelain/canvases` — every promoted Canvas bundle. */
export function projectOverlayCanvasesDir(repoPath: string): string {
  return projectPorcelainPath(repoPath, OVERLAY_CANVASES_DIR)
}

/** `<repo>/.porcelain/canvases/<canvasId>` — one promoted bundle, served in place. */
export function projectOverlayCanvasBundleDir(repoPath: string, canvasId: string): string {
  return join(projectOverlayCanvasesDir(repoPath), canvasId)
}

export function projectOverlayCanvasManifestPath(repoPath: string, canvasId: string): string {
  return join(projectOverlayCanvasBundleDir(repoPath, canvasId), OVERLAY_CANVAS_MANIFEST_FILE)
}

/** `<repo>/.porcelain/project.json` — promoted project/Worktree defaults. */
export function projectOverlayOverridesPath(repoPath: string): string {
  return projectPorcelainPath(repoPath, OVERLAY_OVERRIDES_FILE)
}
