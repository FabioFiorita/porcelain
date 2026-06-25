import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { initTRPC } from '@trpc/server'
import { dialog, shell, type WebContents } from 'electron'
import { z } from 'zod'
import {
  type Action,
  addAction,
  deleteAction,
  moveAction,
  readActions,
  updateAction,
} from './actions-store'
import {
  addCard,
  type BoardCard,
  CARD_STATUSES,
  clearCards,
  deleteCard,
  moveCard,
  readCards,
  updateCard,
} from './board-store'
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
import type { ChangedFile, DiffHunk, DiffStat } from './diff'
import { buildExploreReading, walkExplore } from './feature-explore'
import { featureKey, flowKey } from './feature-key'
import { writeFeatureSnapshot } from './feature-snapshot-store'
import {
  buildFeatureReading,
  buildFeatureView,
  expandContext,
  type FeatureReading,
  type FeatureView,
} from './feature-view'
import { setWatchedFiles } from './file-watch'
import { buildFlow, DEFAULT_LAYERS, type FlowGroup, type Layer } from './flow'
import { uniqueDuplicatePath } from './fs-ops'
import { directoriesOf, fuzzySearch, type SearchResult } from './fuzzy'
import {
  gitBranch,
  gitBranches,
  gitCheckout,
  gitCommit,
  gitCommitDiff,
  gitCommitFiles,
  gitCommitMessage,
  gitCommitNumstat,
  gitDefaultBranch,
  gitDiffFile,
  gitFileInHead,
  gitGrep,
  gitListFiles,
  gitListSearchFiles,
  gitLog,
  gitMergeBase,
  gitNumstat,
  gitQuickCommand,
  gitRangeChangedFilesFrom,
  gitRangeDiffFile,
  gitRangeNumstatFrom,
  gitResetPath,
  gitRestoreFromHead,
  gitSearchCode,
  gitStageAll,
  gitStageFile,
  gitStatus,
  gitSuggestions,
  gitUnstageAll,
  gitUnstageFile,
  gitWorktrees,
  QUICK_COMMANDS,
  warmFileList,
} from './git'
import { readLayers, writeLayers } from './layers-store'
import type { Diagnostic, HoverInfo, SymbolLocation } from './lsp'
import {
  lspDefinition,
  lspDiagnostics,
  lspDidChange,
  lspDidClose,
  lspDidOpen,
  lspHover,
  lspReferences,
} from './lsp-manager'
import { readNotes, writeNotes } from './notes-store'
import { installPlugin, type PluginInstallResult } from './plugin'
import { installCommands, PLUGIN_VERSION, pluginMarketplaceDir } from './plugin-assets'
import { exceedsReadLimit } from './read-limits'
import {
  hiddenPathsFor,
  pinnedPathsFor,
  visibleFilePaths,
  withHiddenPath,
  withoutHiddenPath,
  withoutPinnedPath,
  withPinnedPath,
  withRecentRepo,
} from './repo-config'
import { clearReviewSet, readReviewSet } from './review-store'
import {
  clearReviewedPaths,
  markReviewed,
  readReviewedPaths,
  unmarkReviewed,
} from './reviewed-store'
import { checkForUpdates, installUpdate, type UpdateStatus, updateStatus } from './updater'
import { createWindow, type WindowInit, windowInitFor } from './window'

export interface TrpcContext {
  sender: WebContents
}
const t = initTRPC.context<TrpcContext>().create({ isServer: true })

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

// Read up to 200 files' working-tree contents, run buildFlow, and attach
// additions/deletions from the stat map. Shared by gitFlow, gitRangeFlow, and
// gitCommitFlow — each procedure owns its own file/stat gathering, cache key,
// and cache store; this helper is the common "sources → groups" pipeline.
async function readSourcesAndBuildFlow(
  repoPath: string,
  files: ChangedFile[],
  stats: DiffStat[],
  layers: Layer[],
): Promise<FlowGroup[]> {
  const sources = new Map<string, string>()
  await Promise.all(
    files.slice(0, 200).map(async (file) => {
      try {
        const content = await readFile(join(repoPath, file.path), 'utf8')
        if (content.length < 1024 * 1024) sources.set(file.path, content)
      } catch {
        // deleted / no-longer-in-working-tree files have no source to parse
      }
    }),
  )
  const statByPath = new Map(stats.map((s) => [s.path, s]))
  return buildFlow(files, sources, layers).map((group) => ({
    ...group,
    files: group.files.map((file) => ({
      ...file,
      additions: statByPath.get(file.path)?.additions,
      deletions: statByPath.get(file.path)?.deletions,
    })),
  }))
}

// gitFlow polls every 3s; re-reading up to 200 changed files each tick is the
// single heaviest recurring cost. Memoize on the parsed status+numstat+layers —
// file contents are only re-read when the working tree actually changes.
const flowCache = new Map<string, { key: string; groups: FlowGroup[] }>()

// Same memoization as flowCache for the branch-range flow: keyed on the base ref
// + range numstat + layers. The range is static until the next commit, so the
// cache is invalidated only on commit (gitRangeFlow.invalidate in use-commit).
const rangeFlowCache = new Map<string, { key: string; groups: FlowGroup[] }>()

// Commit hashes are immutable, so this cache never busts for the same commit.
// Keyed by `repoPath\nhash` so different repos' commits don't collide.
const commitFlowCache = new Map<string, { key: string; groups: FlowGroup[] }>()

// One shared build per snapshot — both feature procedures reuse it instead of each
// re-reading ≤200 sources and rebuilding the view for the identical key. Keyed on
// repoPath; the key encodes status+numstat+layers+reviewSet so it self-busts on any
// working-tree change that affects the feature view.
const featureBuildCache = new Map<
  string,
  { key: string; view: FeatureView; sources: Map<string, string> }
>()

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
  const [files, stored, stats, repoFiles, reviewSet] = await Promise.all([
    gitStatus(input),
    readLayers(input),
    gitNumstat(input),
    gitListFiles(input),
    readReviewSet(input),
  ])
  const layers = stored ?? DEFAULT_LAYERS
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

// Shared cache accessor — returns the memoized build for the current snapshot,
// or runs buildFeatureFromGather once and stores the result. Both feature
// procedures call this so the expensive source-read + view-build runs at most
// once per snapshot regardless of which procedure polls first.
async function getFeatureBuild(
  input: string,
  g: Awaited<ReturnType<typeof gatherFeature>>,
): Promise<{ key: string; view: FeatureView; sources: Map<string, string> }> {
  const cached = featureBuildCache.get(input)
  if (cached && cached.key === g.key) return cached
  const { view, sources } = await buildFeatureFromGather(input, g)
  const entry = { key: g.key, view, sources }
  featureBuildCache.set(input, entry)
  // Snapshot the computed view to the app→agent channel so the MCP server can tell
  // the agent which files are actually `changed` (diffed) vs context/shipped — git
  // truth the dependency-free server can't derive itself. Skipped when unchanged.
  await writeFeatureSnapshot(input, {
    name: view.name,
    files: view.groups.flatMap((group) =>
      group.files.map((file) => ({ path: file.path, source: file.source, layer: group.layer })),
    ),
  })
  return entry
}

// The finder searches visible files PLUS their ancestor folders. Both the
// hidden-path filtering and the directory derivation run over the full file
// list, so they're recomputed only when the list or the hidden set changes —
// never on every search keystroke (only the fuzzy scoring runs per keystroke).
interface SearchCandidates {
  paths: readonly string[]
  dirs: ReadonlySet<string>
}

const searchCandidatesCache = new Map<
  string,
  { files: readonly string[]; hiddenKey: string; candidates: SearchCandidates }
>()

function searchCandidates(
  repoPath: string,
  files: string[],
  hidden: ReadonlySet<string>,
): SearchCandidates {
  const hiddenKey = [...hidden].sort().join('\0')
  const cached = searchCandidatesCache.get(repoPath)
  if (cached && cached.files === files && cached.hiddenKey === hiddenKey) return cached.candidates
  const visible = visibleFilePaths(repoPath, files, hidden)
  const dirs = directoriesOf(visible)
  const candidates: SearchCandidates = { paths: [...visible, ...dirs], dirs: new Set(dirs) }
  searchCandidatesCache.set(repoPath, { files, hiddenKey, candidates })
  return candidates
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

  windowInit: t.procedure.query(({ ctx }): WindowInit => windowInitFor(ctx.sender)),

  newWindow: t.procedure
    .input(z.object({ repoPath: z.string().optional() }).optional())
    .mutation(({ input }) => {
      createWindow(
        input?.repoPath ? { mode: 'open', repoPath: input.repoPath } : { mode: 'welcome' },
      )
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
      await markReviewed(input.repoPath, input.path)
    }),

  unmarkReviewed: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await unmarkReviewed(input.repoPath, input.path)
    }),

  reviewedPaths: t.procedure
    .input(z.string())
    .query(async ({ input }): Promise<string[]> => readReviewedPaths(input)),

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

  gitUnstageAll: t.procedure
    .input(z.object({ repoPath: z.string() }))
    .mutation(({ input }) => gitUnstageAll(input.repoPath)),

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
    .mutation(async ({ input }) => {
      await gitCommit(input.repoPath, input.message)
      // The reviewed marks describe working-tree changes; once committed they no longer
      // apply, so clear them — a later re-edit of the same file starts unreviewed.
      const committed = await gitCommitFiles(input.repoPath, 'HEAD')
      await clearReviewedPaths(
        input.repoPath,
        committed.map((file) => file.path),
      )
    }),

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

  // The renderer pushes its open file-tab paths whenever the set changes; main
  // watches their dirs and emits `working-tree` so an external write (the coding
  // agent in the terminal) live-refreshes the open document. See `file-watch.ts`.
  watchFiles: t.procedure
    .input(z.array(z.string()))
    .mutation(({ input, ctx }) => setWatchedFiles(ctx.sender, input)),

  writeTextFile: t.procedure
    .input(z.object({ path: z.string(), content: z.string() }))
    .mutation(async ({ input }) => {
      await writeFile(input.path, input.content, 'utf8')
    }),

  // Create an empty file at an absolute path. `wx` fails if it already exists, so a
  // collision surfaces as an error instead of silently clobbering the file.
  createFile: t.procedure.input(z.object({ path: z.string() })).mutation(async ({ input }) => {
    await writeFile(input.path, '', { flag: 'wx' })
  }),

  // Create a directory; throws (EEXIST) if one is already there — no recursive so a
  // typo can't quietly conjure a whole path.
  createFolder: t.procedure.input(z.object({ path: z.string() })).mutation(async ({ input }) => {
    await mkdir(input.path)
  }),

  // Move/rename within the repo. `rename` overwrites an existing target on POSIX, so we
  // guard first — a rename should never destroy the file it lands on.
  renamePath: t.procedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .mutation(async ({ input }) => {
      if (input.to !== input.from && existsSync(input.to)) {
        throw new Error(`“${basename(input.to)}” already exists`)
      }
      await rename(input.from, input.to)
    }),

  // Copy a file or directory to a free "… copy" sibling and return the new path so the
  // caller can reveal it.
  duplicatePath: t.procedure
    .input(z.object({ path: z.string() }))
    .mutation(async ({ input }): Promise<string> => {
      const info = await stat(input.path)
      const target = uniqueDuplicatePath(input.path, info.isDirectory(), existsSync)
      await cp(input.path, target, { recursive: info.isDirectory() })
      return target
    }),

  searchText: t.procedure
    .input(z.object({ repoPath: z.string(), query: z.string().min(1) }))
    .query(({ input }) => gitGrep(input.repoPath, input.query)),

  searchCode: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        query: z.string().min(1),
        regex: z.boolean(),
        caseSensitive: z.boolean(),
        include: z.string(),
        exclude: z.string(),
      }),
    )
    .query(({ input }) =>
      gitSearchCode(input.repoPath, {
        query: input.query,
        regex: input.regex,
        caseSensitive: input.caseSensitive,
        include: input.include,
        exclude: input.exclude,
      }),
    ),

  revealInFinder: t.procedure.input(z.string()).mutation(({ input }) => {
    shell.showItemInFolder(input)
  }),

  trashPath: t.procedure.input(z.string()).mutation(async ({ input }) => {
    await shell.trashItem(input)
  }),

  gitStatus: t.procedure.input(z.string()).query(({ input }) => gitStatus(input)),

  gitSuggestions: t.procedure.input(z.string()).query(({ input }) => gitSuggestions(input)),

  gitFlow: t.procedure.input(z.string()).query(async ({ input }): Promise<FlowGroup[]> => {
    const [files, stored, stats] = await Promise.all([
      gitStatus(input),
      readLayers(input),
      gitNumstat(input),
    ])
    const layers = stored ?? DEFAULT_LAYERS
    const key = flowKey(files, stats, layers)
    const cached = flowCache.get(input)
    if (cached && cached.key === key) return cached.groups
    const groups = await readSourcesAndBuildFlow(input, files, stats, layers)
    flowCache.set(input, { key, groups })
    return groups
  }),

  gitRangeFlow: t.procedure
    .input(z.string())
    .query(async ({ input }): Promise<{ groups: FlowGroup[]; base: string }> => {
      const base = await gitDefaultBranch(input)
      try {
        const mergeBase = await gitMergeBase(input, base)
        const [files, stored, stats] = await Promise.all([
          gitRangeChangedFilesFrom(input, mergeBase),
          readLayers(input),
          gitRangeNumstatFrom(input, mergeBase),
        ])
        const layers = stored ?? DEFAULT_LAYERS
        const key = `${base}\n${flowKey(files, stats, layers)}`
        const cached = rangeFlowCache.get(input)
        if (cached && cached.key === key) return { groups: cached.groups, base }
        const groups = await readSourcesAndBuildFlow(input, files, stats, layers)
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
    return (await getFeatureBuild(input, g)).view
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
      const { view, sources } = await getFeatureBuild(input, g)
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

  // Project board — todo/doing/done cards the human and the agent both manage,
  // stored in ~/.porcelain/board.json (see `board-store.ts`); a two-way channel the
  // agent reads (list_cards) and mutates (create/update/move/delete_card) over MCP.
  boardCards: t.procedure
    .input(z.string())
    .query(({ input }): Promise<BoardCard[]> => readCards(input)),

  addBoardCard: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        title: z.string().min(1),
        body: z.string().optional(),
        status: z.enum(CARD_STATUSES).optional(),
      }),
    )
    .mutation(({ input }): Promise<BoardCard> => {
      const { repoPath, ...card } = input
      return addCard(repoPath, card)
    }),

  updateBoardCard: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        id: z.string(),
        title: z.string().min(1).optional(),
        body: z.string().optional(),
      }),
    )
    .mutation(({ input }) =>
      updateCard(input.repoPath, input.id, { title: input.title, body: input.body }),
    ),

  moveBoardCard: t.procedure
    .input(z.object({ repoPath: z.string(), id: z.string(), status: z.enum(CARD_STATUSES) }))
    .mutation(({ input }) => moveCard(input.repoPath, input.id, input.status)),

  deleteBoardCard: t.procedure
    .input(z.object({ repoPath: z.string(), id: z.string() }))
    .mutation(({ input }) => deleteCard(input.repoPath, input.id)),

  clearBoardCards: t.procedure
    .input(z.object({ repoPath: z.string(), status: z.enum(CARD_STATUSES) }))
    .mutation(({ input }) => clearCards(input.repoPath, input.status)),

  // Saved actions — named commands the human runs in the embedded terminal with one
  // click, stored in ~/.porcelain/actions.json (see `actions-store.ts`); a two-way
  // channel the agent reads (list_actions) and curates (create/update/delete_action)
  // over MCP. The agent never EXECUTES one — running is human-only (see the audit skill).
  actions: t.procedure
    .input(z.string())
    .query(({ input }): Promise<Action[]> => readActions(input)),

  addAction: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        title: z.string().trim().min(1),
        command: z.string().trim().min(1),
        cwd: z.string().optional(),
      }),
    )
    .mutation(({ input }): Promise<Action> => {
      const { repoPath, ...action } = input
      return addAction(repoPath, action)
    }),

  updateAction: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        id: z.string(),
        title: z.string().trim().min(1).optional(),
        command: z.string().trim().min(1).optional(),
        cwd: z.string().optional(),
      }),
    )
    .mutation(({ input }) =>
      updateAction(input.repoPath, input.id, {
        title: input.title,
        command: input.command,
        cwd: input.cwd,
      }),
    ),

  moveAction: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        id: z.string(),
        direction: z.enum(['up', 'down']),
      }),
    )
    .mutation(({ input }) => moveAction(input.repoPath, input.id, input.direction)),

  deleteAction: t.procedure
    .input(z.object({ repoPath: z.string(), id: z.string() }))
    .mutation(({ input }) => deleteAction(input.repoPath, input.id)),

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
      const layers = (await readLayers(input.repoPath)) ?? DEFAULT_LAYERS
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
      const stored = await readLayers(input)
      return { layers: stored ?? DEFAULT_LAYERS, custom: stored !== null }
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
      await writeLayers(input.repoPath, input.layers)
    }),

  repoNotes: t.procedure.input(z.string()).query(({ input }): Promise<string> => readNotes(input)),

  setRepoNotes: t.procedure
    .input(z.object({ repoPath: z.string(), notes: z.string() }))
    .mutation(async ({ input }) => {
      await writeNotes(input.repoPath, input.notes)
    }),

  gitBranch: t.procedure.input(z.string()).query(({ input }) => gitBranch(input)),

  gitBranches: t.procedure.input(z.string()).query(({ input }) => gitBranches(input)),

  gitCheckout: t.procedure
    .input(z.object({ repoPath: z.string(), branch: z.string() }))
    .mutation(({ input }) => gitCheckout(input.repoPath, input.branch)),

  gitWorktrees: t.procedure.input(z.string()).query(({ input }) => gitWorktrees(input)),

  gitLog: t.procedure
    .input(z.object({ repoPath: z.string(), limit: z.number().int().max(500).default(200) }))
    .query(({ input }) => gitLog(input.repoPath, input.limit)),

  gitCommitMessage: t.procedure
    .input(z.object({ repoPath: z.string(), hash: z.string() }))
    .query(({ input }) => gitCommitMessage(input.repoPath, input.hash)),

  gitCommitDiff: t.procedure
    .input(z.object({ repoPath: z.string(), hash: z.string(), filePath: z.string() }))
    .query(({ input }) => gitCommitDiff(input.repoPath, input.hash, input.filePath)),

  // Flow-grouped file list for a single historical commit. Uses the same
  // buildFlow pipeline as gitFlow/gitRangeFlow; sources are read from the
  // working tree (option A — best-effort, consistent with gitRangeFlow). A
  // commit hash is immutable, so the cache never needs to bust for the same hash.
  gitCommitFlow: t.procedure
    .input(z.object({ repoPath: z.string(), hash: z.string() }))
    .query(async ({ input }): Promise<FlowGroup[]> => {
      try {
        const [files, stored, stats] = await Promise.all([
          gitCommitFiles(input.repoPath, input.hash),
          readLayers(input.repoPath),
          gitCommitNumstat(input.repoPath, input.hash),
        ])
        const layers = stored ?? DEFAULT_LAYERS
        const cacheKey = `${input.repoPath}\n${input.hash}`
        const key = `${input.hash}\n${flowKey(files, stats, layers)}`
        const cached = commitFlowCache.get(cacheKey)
        if (cached && cached.key === key) return cached.groups
        const groups = await readSourcesAndBuildFlow(input.repoPath, files, stats, layers)
        commitFlowCache.set(cacheKey, { key, groups })
        return groups
      } catch {
        return []
      }
    }),

  searchFiles: t.procedure
    .input(z.object({ repoPath: z.string(), query: z.string() }))
    .query(async ({ input }): Promise<SearchResult[]> => {
      if (input.query.trim() === '') return []
      const [files, config] = await Promise.all([gitListSearchFiles(input.repoPath), loadConfig()])
      const hidden = hiddenPathsFor(config, input.repoPath)
      const { paths, dirs } = searchCandidates(input.repoPath, files, hidden)
      return fuzzySearch(input.query, paths, 50).map((r) => ({
        path: r.path,
        kind: dirs.has(r.path) ? 'dir' : 'file',
      }))
    }),

  updateStatus: t.procedure.query((): UpdateStatus => updateStatus()),

  checkForUpdates: t.procedure.mutation(() => checkForUpdates()),

  installUpdate: t.procedure.mutation(() => {
    installUpdate()
  }),

  // The Claude Code plugin (bundles the feature-review MCP server + skill).
  pluginInfo: t.procedure.query(
    (): { marketplaceDir: string; commands: string[]; version: string } => ({
      marketplaceDir: pluginMarketplaceDir(),
      commands: installCommands(),
      version: PLUGIN_VERSION,
    }),
  ),

  installPlugin: t.procedure.mutation((): Promise<PluginInstallResult> => installPlugin()),

  // Opt-in TypeScript language server (see lsp-manager.ts). A per-repo
  // typescript-language-server child, spawned lazily on first call — if the renderer
  // never invokes these (feature off), nothing spawns. Diagnostics are pushed via the
  // `diagnostics` app-event (the renderer invalidates lspDiagnostics on it); the rest
  // are direct request/response. didOpen/didChange/didClose mirror the renderer's open
  // documents into the server's text-sync so hover/definition/references stay accurate.
  lspDidOpen: t.procedure
    .input(z.object({ repo: z.string(), path: z.string(), content: z.string() }))
    .mutation(({ input }) => lspDidOpen(input.repo, input.path, input.content)),

  lspDidChange: t.procedure
    .input(z.object({ repo: z.string(), path: z.string(), content: z.string() }))
    .mutation(({ input }) => lspDidChange(input.repo, input.path, input.content)),

  lspDidClose: t.procedure
    .input(z.object({ repo: z.string(), path: z.string() }))
    .mutation(({ input }) => lspDidClose(input.repo, input.path)),

  lspHover: t.procedure
    .input(
      z.object({ repo: z.string(), path: z.string(), line: z.number(), character: z.number() }),
    )
    .query(
      ({ input }): Promise<HoverInfo | null> =>
        lspHover(input.repo, input.path, { line: input.line, character: input.character }),
    ),

  lspDefinition: t.procedure
    .input(
      z.object({ repo: z.string(), path: z.string(), line: z.number(), character: z.number() }),
    )
    .query(
      ({ input }): Promise<SymbolLocation[]> =>
        lspDefinition(input.repo, input.path, { line: input.line, character: input.character }),
    ),

  lspReferences: t.procedure
    .input(
      z.object({ repo: z.string(), path: z.string(), line: z.number(), character: z.number() }),
    )
    .query(
      ({ input }): Promise<SymbolLocation[]> =>
        lspReferences(input.repo, input.path, { line: input.line, character: input.character }),
    ),

  lspDiagnostics: t.procedure
    .input(z.object({ repo: z.string(), path: z.string() }))
    .query(({ input }): Diagnostic[] => lspDiagnostics(input.repo, input.path)),
})

export type AppRouter = typeof router
