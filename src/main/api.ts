import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { initTRPC } from '@trpc/server'
import { dialog, shell } from 'electron'
import { z } from 'zod'
import {
  addComment,
  deleteComment,
  editComment,
  type ReviewComment,
  readComments,
  setCommentResolved,
} from './comment-store'
import { loadConfig, updateConfig } from './config-store'
import { type CommitConventions, parseConventions } from './conventions'
import type { DiffHunk } from './diff'
import { buildExploreReading, walkExplore } from './feature-explore'
import { featureKey, flowKey } from './feature-key'
import {
  buildFeatureReading,
  buildFeatureView,
  expandContext,
  type FeatureReading,
  type FeatureView,
} from './feature-view'
import { buildFlow, DEFAULT_LAYERS, type FlowGroup, type Layer } from './flow'
import { fuzzySearch } from './fuzzy'
import {
  gitBranch,
  gitCommit,
  gitCommitDiff,
  gitCommitFiles,
  gitDefaultBranch,
  gitDiffFile,
  gitFileInHead,
  gitGrep,
  gitListFiles,
  gitListSearchFiles,
  gitLog,
  gitNumstat,
  gitQuickCommand,
  gitRangeChangedFiles,
  gitRangeDiffFile,
  gitRangeNumstat,
  gitResetPath,
  gitRestoreFromHead,
  gitStageAll,
  gitStageFile,
  gitStatus,
  gitSuggestions,
  gitUnstageFile,
  gitWorktrees,
  QUICK_COMMANDS,
  warmFileList,
} from './git'
import { installPlugin, type PluginInstallResult } from './plugin'
import { installCommands, pluginMarketplaceDir } from './plugin-assets'
import { exceedsReadLimit } from './read-limits'
import {
  hiddenPathsFor,
  layersFor,
  notesFor,
  pinnedPathsFor,
  reviewedPathsFor,
  visibleFilePaths,
  withHiddenPath,
  withoutHiddenPath,
  withoutPinnedPath,
  withoutReviewedPath,
  withPinnedPath,
  withRecentRepo,
  withRepoLayers,
  withRepoNotes,
  withReviewedPath,
} from './repo-config'
import { clearReviewSet, readReviewSet } from './review-store'
import { checkForUpdates, installUpdate, type UpdateStatus, updateStatus } from './updater'

const t = initTRPC.create({ isServer: true })

export interface RepoInfo {
  path: string
  name: string
}

export interface DirEntry {
  name: string
  path: string
  kind: 'file' | 'dir'
  hidden: boolean
  pinned: boolean
}

export type FileView =
  | { type: 'text'; content: string }
  | { type: 'image'; dataUrl: string }
  | { type: 'binary'; size: number }
  | { type: 'too-large'; size: number }
  | { type: 'not-found' }

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  avif: 'image/avif',
}

const toRepoInfo = (path: string): RepoInfo => ({ path, name: basename(path) })

function isValidPattern(pattern: string): boolean {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

async function recordRecent(path: string): Promise<void> {
  await updateConfig((config) => withRecentRepo(config, path))
}

// gitFlow polls every 3s; re-reading up to 200 changed files each tick is the
// single heaviest recurring cost. Memoize on the parsed status+numstat+layers —
// file contents are only re-read when the working tree actually changes.
const flowCache = new Map<string, { key: string; groups: FlowGroup[] }>()

// Same memoization as flowCache for the branch-range flow: keyed on the base ref
// + range numstat + layers. The range is static until the next commit, so the
// cache is invalidated only on commit (gitRangeFlow.invalidate in use-commit).
const rangeFlowCache = new Map<string, { key: string; groups: FlowGroup[] }>()

// Same memoization as flowCache for the (heavier) feature view: keyed on the
// working-tree state, layers, and the agent-fed review set, so the poll only
// re-reads file contents when something that affects the view actually changed.
const featureViewCache = new Map<string, { key: string; view: FeatureView }>()

// The (heavier still) inline reading surface, memoized on the same key. Only built
// when an agent review set is present (MCP-only), so the slice heuristic runs only
// on curated files; the baseline returns null cheaply from the gather alone.
const featureReadingCache = new Map<string, { key: string; reading: FeatureReading }>()

// Read working-tree sources into `sources`, skipping already-read and oversized
// files. Shared by both feature procedures (they parse imports off the contents).
async function readSourcesInto(
  repoPath: string,
  paths: readonly string[],
  sources: Map<string, string>,
): Promise<void> {
  await Promise.all(
    paths.map(async (path) => {
      if (sources.has(path)) return
      try {
        const content = await readFile(join(repoPath, path), 'utf8')
        if (content.length < 1024 * 1024) sources.set(path, content)
      } catch {
        // deleted / unreadable files have no working-tree source to parse
      }
    }),
  )
}

// Cheap phase shared by both feature procedures: the working-tree snapshot, agent
// set, and layers → the memo key. Each procedure checks its own cache on this key
// before doing the expensive source reads.
async function gatherFeature(input: string) {
  const [files, config, stats, repoFiles, reviewSet] = await Promise.all([
    gitStatus(input),
    loadConfig(),
    gitNumstat(input),
    gitListFiles(input),
    readReviewSet(input),
  ])
  const layers = layersFor(config, input) ?? DEFAULT_LAYERS
  const key = featureKey(files, stats, layers, reviewSet)
  return { files, stats, layers, reviewSet, repoFiles, key }
}

// Expensive phase shared on a cache miss: read changed + context + agent-declared
// sources, then build the feature view. Returns the view AND the sources (the
// reading surface needs them to slice context/shipped files).
async function buildFeatureFromGather(
  input: string,
  g: Awaited<ReturnType<typeof gatherFeature>>,
): Promise<{ view: FeatureView; sources: Map<string, string> }> {
  const sources = new Map<string, string>()
  await readSourcesInto(
    input,
    g.files.slice(0, 200).map((file) => file.path),
    sources,
  )
  const contextPaths = expandContext(
    g.files.map((file) => file.path),
    sources,
    new Set(g.repoFiles),
  )
  await readSourcesInto(
    input,
    [...contextPaths, ...(g.reviewSet?.files.map((file) => file.path) ?? [])],
    sources,
  )
  const statByPath = new Map(
    g.stats.map((s) => [s.path, { additions: s.additions, deletions: s.deletions }]),
  )
  const view = buildFeatureView({
    name: g.reviewSet?.name ?? 'Feature view',
    changed: g.files,
    contextPaths,
    reviewSet: g.reviewSet,
    sources,
    stats: statByPath,
    layers: g.layers,
  })
  return { view, sources }
}

// Hidden-path filtering over the full file list is recomputed only when the
// list or the hidden set changes, not on every search keystroke.
const visibleFilesCache = new Map<
  string,
  { files: readonly string[]; hiddenKey: string; visible: string[] }
>()

function visibleFiles(repoPath: string, files: string[], hidden: ReadonlySet<string>): string[] {
  const hiddenKey = [...hidden].sort().join('\0')
  const cached = visibleFilesCache.get(repoPath)
  if (cached && cached.files === files && cached.hiddenKey === hiddenKey) return cached.visible
  const visible = visibleFilePaths(repoPath, files, hidden)
  visibleFilesCache.set(repoPath, { files, hiddenKey, visible })
  return visible
}

export const router = t.router({
  openRepo: t.procedure.query(async (): Promise<RepoInfo | null> => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    const path = result.filePaths[0]
    if (!path) return null
    await recordRecent(path)
    warmFileList(path)
    return toRepoInfo(path)
  }),

  openRepoPath: t.procedure.input(z.string()).mutation(async ({ input }): Promise<RepoInfo> => {
    await stat(input)
    await recordRecent(input)
    warmFileList(input)
    return toRepoInfo(input)
  }),

  recentRepos: t.procedure.query(async (): Promise<RepoInfo[]> => {
    const config = await loadConfig()
    const existing = await Promise.all(
      config.recentRepos.map(async (path) => {
        try {
          await stat(path)
          return path
        } catch {
          return null
        }
      }),
    )
    return existing.filter((p): p is string => p !== null).map(toRepoInfo)
  }),

  readDir: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string(), showHidden: z.boolean() }))
    .query(async ({ input }): Promise<DirEntry[]> => {
      const config = await loadConfig()
      const hidden = hiddenPathsFor(config, input.repoPath)
      const pinned = new Set(pinnedPathsFor(config, input.repoPath))
      const entries = await readdir(input.path, { withFileTypes: true })
      return entries
        .filter((entry) => entry.name !== '.DS_Store')
        .map(
          (entry): DirEntry => ({
            name: entry.name,
            path: join(input.path, entry.name),
            kind: entry.isDirectory() ? 'dir' : 'file',
            hidden: hidden.has(join(input.path, entry.name)),
            pinned: pinned.has(join(input.path, entry.name)),
          }),
        )
        .filter((entry) => input.showHidden || !entry.hidden)
        .sort((a, b) =>
          a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1,
        )
    }),

  hidePath: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await updateConfig((config) => withHiddenPath(config, input.repoPath, input.path))
    }),

  unhidePath: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await updateConfig((config) => withoutHiddenPath(config, input.repoPath, input.path))
    }),

  pinPath: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await updateConfig((config) => withPinnedPath(config, input.repoPath, input.path))
    }),

  unpinPath: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await updateConfig((config) => withoutPinnedPath(config, input.repoPath, input.path))
    }),

  pinnedEntries: t.procedure.input(z.string()).query(async ({ input }): Promise<DirEntry[]> => {
    const config = await loadConfig()
    const hidden = hiddenPathsFor(config, input)
    const entries = await Promise.all(
      pinnedPathsFor(config, input).map(async (path): Promise<DirEntry | null> => {
        try {
          const info = await stat(path)
          return {
            name: basename(path),
            path,
            kind: info.isDirectory() ? 'dir' : 'file',
            hidden: hidden.has(path),
            pinned: true,
          }
        } catch {
          return null // pinned path no longer exists; keep the config, skip the row
        }
      }),
    )
    return entries.filter((e): e is DirEntry => e !== null)
  }),

  markReviewed: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await updateConfig((config) => withReviewedPath(config, input.repoPath, input.path))
    }),

  unmarkReviewed: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await updateConfig((config) => withoutReviewedPath(config, input.repoPath, input.path))
    }),

  reviewedPaths: t.procedure
    .input(z.string())
    .query(async ({ input }): Promise<string[]> => reviewedPathsFor(await loadConfig(), input)),

  gitSuggestions: t.procedure.input(z.string()).query(({ input }) => gitSuggestions(input)),

  gitQuickCommand: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        command: z.string().refine((id) => id in QUICK_COMMANDS, 'unknown command'),
        pullMode: z.enum(['merge', 'rebase']).optional(),
      }),
    )
    .mutation(({ input }) => gitQuickCommand(input.repoPath, input.command, input.pullMode)),

  gitStageAll: t.procedure
    .input(z.object({ repoPath: z.string() }))
    .mutation(({ input }) => gitStageAll(input.repoPath)),

  gitStageFile: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(({ input }) => gitStageFile(input.repoPath, input.path)),

  gitUnstageFile: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(({ input }) => gitUnstageFile(input.repoPath, input.path)),

  // Discard a single file's changes. A tracked file reverts to its committed
  // version (staged + unstaged edits gone, deletions restored); a new file is
  // unstaged then moved to the Trash (recoverable, like the tree's Delete) since
  // it has no committed version to fall back to.
  gitDiscardFile: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      if (await gitFileInHead(input.repoPath, input.path)) {
        await gitRestoreFromHead(input.repoPath, input.path)
      } else {
        await gitResetPath(input.repoPath, input.path)
        await shell.trashItem(join(input.repoPath, input.path))
      }
    }),

  gitCommit: t.procedure
    .input(z.object({ repoPath: z.string(), message: z.string().trim().min(1) }))
    .mutation(({ input }) => gitCommit(input.repoPath, input.message)),

  gitCommitConventions: t.procedure
    .input(z.string())
    .query(async ({ input }): Promise<CommitConventions> => {
      const commits = await gitLog(input, 200)
      return parseConventions(commits.map((c) => c.subject))
    }),

  readFile: t.procedure.input(z.string()).query(async ({ input }): Promise<FileView> => {
    try {
      const info = await stat(input)
      if (exceedsReadLimit(info.size)) {
        return { type: 'too-large', size: info.size }
      }
      const ext = input.split('.').at(-1)?.toLowerCase() ?? ''
      const imageMime = IMAGE_MIME[ext]
      if (imageMime) {
        const buffer = await readFile(input)
        return { type: 'image', dataUrl: `data:${imageMime};base64,${buffer.toString('base64')}` }
      }
      const buffer = await readFile(input)
      if (buffer.subarray(0, 8000).includes(0)) {
        return { type: 'binary', size: buffer.length }
      }
      return { type: 'text', content: buffer.toString('utf8') }
    } catch (err) {
      // The file vanished (deleted on disk while a stale tree row still points at
      // it) — surface a clean state instead of a raw ENOENT; the viewer refreshes
      // the tree so the phantom row drops.
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
        return { type: 'not-found' }
      }
      throw err
    }
  }),

  writeTextFile: t.procedure
    .input(z.object({ path: z.string(), content: z.string() }))
    .mutation(async ({ input }) => {
      await writeFile(input.path, input.content, 'utf8')
    }),

  searchText: t.procedure
    .input(z.object({ repoPath: z.string(), query: z.string().min(1) }))
    .query(({ input }) => gitGrep(input.repoPath, input.query)),

  revealInFinder: t.procedure.input(z.string()).mutation(({ input }) => {
    shell.showItemInFolder(input)
  }),

  trashPath: t.procedure.input(z.string()).mutation(async ({ input }) => {
    await shell.trashItem(input)
  }),

  gitStatus: t.procedure.input(z.string()).query(({ input }) => gitStatus(input)),

  gitFlow: t.procedure.input(z.string()).query(async ({ input }): Promise<FlowGroup[]> => {
    const [files, config, stats] = await Promise.all([
      gitStatus(input),
      loadConfig(),
      gitNumstat(input),
    ])
    const layers = layersFor(config, input) ?? DEFAULT_LAYERS
    const key = flowKey(files, stats, layers)
    const cached = flowCache.get(input)
    if (cached && cached.key === key) return cached.groups
    const sources = new Map<string, string>()
    await Promise.all(
      files.slice(0, 200).map(async (file) => {
        try {
          const content = await readFile(join(input, file.path), 'utf8')
          if (content.length < 1024 * 1024) sources.set(file.path, content)
        } catch {
          // deleted files have no working-tree source to parse
        }
      }),
    )
    const statByPath = new Map(stats.map((s) => [s.path, s]))
    const groups = buildFlow(files, sources, layers).map((group) => ({
      ...group,
      files: group.files.map((file) => ({
        ...file,
        additions: statByPath.get(file.path)?.additions,
        deletions: statByPath.get(file.path)?.deletions,
      })),
    }))
    flowCache.set(input, { key, groups })
    return groups
  }),

  gitRangeFlow: t.procedure
    .input(z.string())
    .query(async ({ input }): Promise<{ groups: FlowGroup[]; base: string }> => {
      const base = await gitDefaultBranch(input)
      try {
        const [files, config, stats] = await Promise.all([
          gitRangeChangedFiles(input, base),
          loadConfig(),
          gitRangeNumstat(input, base),
        ])
        const layers = layersFor(config, input) ?? DEFAULT_LAYERS
        const key = `${base}\n${flowKey(files, stats, layers)}`
        const cached = rangeFlowCache.get(input)
        if (cached && cached.key === key) return { groups: cached.groups, base }
        const sources = new Map<string, string>()
        await Promise.all(
          files.slice(0, 200).map(async (file) => {
            try {
              const content = await readFile(join(input, file.path), 'utf8')
              if (content.length < 1024 * 1024) sources.set(file.path, content)
            } catch {
              // deleted-in-range files have no working-tree source to parse
            }
          }),
        )
        const statByPath = new Map(stats.map((s) => [s.path, s]))
        const groups = buildFlow(files, sources, layers).map((group) => ({
          ...group,
          files: group.files.map((file) => ({
            ...file,
            additions: statByPath.get(file.path)?.additions,
            deletions: statByPath.get(file.path)?.deletions,
          })),
        }))
        rangeFlowCache.set(input, { key, groups })
        return { groups, base }
      } catch {
        return { groups: [], base }
      }
    }),

  gitRangeDiffFile: t.procedure
    .input(z.object({ repoPath: z.string(), base: z.string(), filePath: z.string() }))
    .query(({ input }) => gitRangeDiffFile(input.repoPath, input.base, input.filePath)),

  // The feature view: the change under review widened into the whole feature.
  // No-MCP baseline = changed files + the unchanged files they reach by relative
  // import (tagged `context`). When an agent has pushed a review set for this repo
  // (via the MCP server → ~/.porcelain/review-sets.json), its cross-seam files and
  // invariant notes overlay on top. One render either way.
  featureView: t.procedure.input(z.string()).query(async ({ input }): Promise<FeatureView> => {
    const g = await gatherFeature(input)
    const cached = featureViewCache.get(input)
    if (cached && cached.key === g.key) return cached.view
    const { view } = await buildFeatureFromGather(input, g)
    featureViewCache.set(input, { key: g.key, view })
    return view
  }),

  // The inline reading surface: the feature rendered as one flow-ordered document
  // with just the relevant lines (diff hunks for changed files, symbol slices for
  // context/shipped). MCP-only — returns null when there's no agent review set, so
  // the baseline stays the lightweight Feature list and the slice heuristic only
  // ever runs on the agent's curated, annotated set.
  featureReading: t.procedure
    .input(z.string())
    .query(async ({ input }): Promise<FeatureReading | null> => {
      const g = await gatherFeature(input)
      if (!g.reviewSet) return null
      const cached = featureReadingCache.get(input)
      if (cached && cached.key === g.key) return cached.reading
      const { view, sources } = await buildFeatureFromGather(input, g)
      const changed = view.groups
        .flatMap((group) => group.files)
        .filter((f) => f.source === 'changed')
      const diffs = new Map<string, DiffHunk[]>()
      await Promise.all(
        changed.map(async (file) => {
          try {
            diffs.set(file.path, await gitDiffFile(input, file.path))
          } catch {
            // file vanished/renamed between the status snapshot and this read —
            // leave it out; buildFeatureReading falls back to an empty hunk list
          }
        }),
      )
      const reading = buildFeatureReading({ view, sources, diffs })
      featureReadingCache.set(input, { key: g.key, reading })
      return reading
    }),

  // Clear a repo's agent review set → revert the feature view to the static
  // baseline. The app's one write to the agent channel (see `clearReviewSet`);
  // the next featureView/featureReading poll reads null and rebuilds (cache key
  // includes the review set, so it self-busts).
  clearFeatureReview: t.procedure.input(z.string()).mutation(async ({ input }) => {
    await clearReviewSet(input)
  }),

  // Review comments — the human's notes on lines/files, fed to the agent as context
  // over MCP (`get_review_comments`) and resolvable by it (`resolve_review_comment`).
  // Stored in ~/.porcelain/comments.json (see `comment-store.ts`); a two-way channel.
  reviewComments: t.procedure
    .input(z.string())
    .query(({ input }): Promise<ReviewComment[]> => readComments(input)),

  addReviewComment: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        path: z.string().min(1),
        startLine: z.number().int().positive().optional(),
        endLine: z.number().int().positive().optional(),
        anchorText: z.string().optional(),
        body: z.string().min(1),
      }),
    )
    .mutation(({ input }): Promise<ReviewComment> => {
      const { repoPath, ...comment } = input
      return addComment(repoPath, comment)
    }),

  editReviewComment: t.procedure
    .input(z.object({ repoPath: z.string(), id: z.string(), body: z.string().min(1) }))
    .mutation(({ input }) => editComment(input.repoPath, input.id, input.body)),

  deleteReviewComment: t.procedure
    .input(z.object({ repoPath: z.string(), id: z.string() }))
    .mutation(({ input }) => deleteComment(input.repoPath, input.id)),

  resolveReviewComment: t.procedure
    .input(z.object({ repoPath: z.string(), id: z.string(), resolved: z.boolean() }))
    .mutation(({ input }) => setCommentResolved(input.repoPath, input.id, input.resolved)),

  // Explore an existing feature read-only: seed from a symbol (or a whole file)
  // and walk the import/reference graph into the SAME flow-ordered, sliced reading
  // surface — no working-tree change, no agent. Files outside the working tree are
  // read on demand (bounded by the walk's depth/file caps + the 10MB read limit).
  exploreFeature: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        seed: z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('file'), path: z.string() }),
          z.object({ kind: z.literal('symbol'), path: z.string(), symbol: z.string() }),
        ]),
      }),
    )
    .query(async ({ input }): Promise<FeatureReading> => {
      const repoFiles = new Set(await gitListFiles(input.repoPath))
      const sources = new Map<string, string>()
      const readSource = async (path: string): Promise<string | undefined> => {
        const cached = sources.get(path)
        if (cached !== undefined) return cached
        try {
          const content = await readFile(join(input.repoPath, path), 'utf8')
          if (content.length < 1024 * 1024) {
            sources.set(path, content)
            return content
          }
        } catch {
          // unreadable / outside the repo — the walk just treats it as a leaf
        }
        return undefined
      }
      const nodes = await walkExplore(input.seed, readSource, repoFiles)
      const layers = layersFor(await loadConfig(), input.repoPath) ?? DEFAULT_LAYERS
      const name =
        input.seed.kind === 'symbol'
          ? input.seed.symbol
          : (input.seed.path.split('/').at(-1) ?? input.seed.path)
      return buildExploreReading(name, nodes, sources, layers)
    }),

  gitDiffFile: t.procedure
    .input(z.object({ repoPath: z.string(), filePath: z.string() }))
    .query(({ input }) => gitDiffFile(input.repoPath, input.filePath)),

  repoLayers: t.procedure
    .input(z.string())
    .query(async ({ input }): Promise<{ layers: Layer[]; custom: boolean }> => {
      const override = layersFor(await loadConfig(), input)
      return { layers: override ?? DEFAULT_LAYERS, custom: override !== undefined }
    }),

  setRepoLayers: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        // null clears the override back to the defaults
        layers: z
          .array(
            z.object({
              label: z.string().trim().min(1),
              pattern: z.string().min(1).refine(isValidPattern, 'invalid regular expression'),
            }),
          )
          .min(1)
          .nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      await updateConfig((config) => withRepoLayers(config, input.repoPath, input.layers))
    }),

  repoNotes: t.procedure
    .input(z.string())
    .query(async ({ input }): Promise<string> => notesFor(await loadConfig(), input)),

  setRepoNotes: t.procedure
    .input(z.object({ repoPath: z.string(), notes: z.string() }))
    .mutation(async ({ input }) => {
      await updateConfig((config) => withRepoNotes(config, input.repoPath, input.notes))
    }),

  gitBranch: t.procedure.input(z.string()).query(({ input }) => gitBranch(input)),

  gitWorktrees: t.procedure.input(z.string()).query(({ input }) => gitWorktrees(input)),

  gitLog: t.procedure
    .input(z.object({ repoPath: z.string(), limit: z.number().int().max(500).default(200) }))
    .query(({ input }) => gitLog(input.repoPath, input.limit)),

  gitCommitFiles: t.procedure
    .input(z.object({ repoPath: z.string(), hash: z.string() }))
    .query(({ input }) => gitCommitFiles(input.repoPath, input.hash)),

  gitCommitDiff: t.procedure
    .input(z.object({ repoPath: z.string(), hash: z.string(), filePath: z.string() }))
    .query(({ input }) => gitCommitDiff(input.repoPath, input.hash, input.filePath)),

  searchFiles: t.procedure
    .input(z.object({ repoPath: z.string(), query: z.string() }))
    .query(async ({ input }): Promise<string[]> => {
      if (input.query.trim() === '') return []
      const [files, config] = await Promise.all([gitListSearchFiles(input.repoPath), loadConfig()])
      const hidden = hiddenPathsFor(config, input.repoPath)
      return fuzzySearch(input.query, visibleFiles(input.repoPath, files, hidden), 50).map(
        (r) => r.path,
      )
    }),

  updateStatus: t.procedure.query((): UpdateStatus => updateStatus()),

  checkForUpdates: t.procedure.mutation(() => checkForUpdates()),

  installUpdate: t.procedure.mutation(() => {
    installUpdate()
  }),

  // The Claude Code plugin (bundles the feature-review MCP server + skill).
  pluginInfo: t.procedure.query((): { marketplaceDir: string; commands: string[] } => ({
    marketplaceDir: pluginMarketplaceDir(),
    commands: installCommands(),
  })),

  installPlugin: t.procedure.mutation((): Promise<PluginInstallResult> => installPlugin()),
})

export type AppRouter = typeof router
