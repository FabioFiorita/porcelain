import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { initTRPC } from '@trpc/server'
import trash from 'trash'
import { z } from 'zod'
import {
  type AgentProvider,
  agentInteractionSchema,
  agentModeSchema,
  agentProviderSchema,
  type ExternalSession,
  type ProviderLimits,
  type ProviderStatus,
  type ThreadInfo,
  threadOptionsSchema,
} from '../shared/agent-protocol'
import {
  type Action,
  addAction,
  deleteAction,
  moveAction,
  readActions,
  updateAction,
} from './actions-store'
import {
  AGENT_NAMES,
  type AgentMcpResult,
  type AgentName,
  installMcpForAgents,
  listAgentMcpInfo,
} from './agent-mcp-install'
import {
  agentCommands,
  agentLimits,
  createThread,
  deleteThread,
  importExternalSession,
  listExternalSessions,
  listThreads,
  providerStatuses,
  renameThread,
  updateThread,
} from './agents/agent-manager'
import type { AgentCommand } from './agents/types'
import {
  type Artifact,
  type ArtifactMeta,
  clearArtifact,
  readArtifact,
  readArtifactMeta,
} from './artifact-store'
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
import { type BrowseResult, browseDirs } from './browse'
import {
  type ChatMessage,
  clearMessages as clearChatMessages,
  postMessage as postChatMessage,
  readMessages as readChatMessages,
} from './chat-store'
import {
  addComment,
  clearResolvedComments,
  deleteComment,
  editComment,
  type ReviewComment,
  readComments,
  setCommentResolved,
} from './comment-store'
import { loadConfig, updateConfig } from './config-store'
import { type CommitConventions, parseConventions } from './conventions'
import type { ChangedFile, DiffHunk, DiffStat } from './diff'
import {
  clearEvidence,
  type Evidence,
  type EvidenceMeta,
  readEvidence,
  readEvidenceMeta,
} from './evidence-store'
import { buildExploreReading, walkExplore } from './feature-explore'
import { featureKey, flowKey } from './feature-key'
import { writeFeatureSnapshot } from './feature-snapshot-store'
import {
  buildDiffReading,
  buildFeatureReading,
  buildFeatureView,
  expandContext,
  type FeatureReading,
  type FeatureView,
} from './feature-view'
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
  gitCreateBranch,
  gitDefaultBranch,
  gitDiffFile,
  gitFileInHead,
  gitFileLog,
  gitGrep,
  gitListFiles,
  gitListSearchFiles,
  gitLog,
  gitMergeBase,
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
  reviewedFingerprint,
  reviewedFingerprints,
  warmFileList,
} from './git'
import { readLayers, writeLayers } from './layers-store'
import { readNotes, writeNotes } from './notes-store'
import { exceedsReadLimit } from './read-limits'
import {
  hiddenPathsFor,
  type LimitsRefresh,
  limitsRefreshSchema,
  pinnedPathsFor,
  resolveCreationDefaults,
  toggleModelFavorite,
  visibleFilePaths,
  withAgentDefaults,
  withAgentProviderCache,
  withHiddenPath,
  withoutHiddenPath,
  withoutPinnedPath,
  withoutRecentRepo,
  withPinnedPath,
  withRecentRepo,
} from './repo-config'
import {
  copyRepoSettings,
  exportRepoSettings,
  type ImportRepoSettingsResult,
  importRepoSettings,
  type RepoSettings,
  repoSettingsSchema,
} from './repo-settings'
import { clearReviewSet, readReviewSet } from './review-store'
import {
  clearReviewedPaths,
  markReviewed,
  readReviewedMarks,
  reconcileReviewed,
  setReviewedMarks,
  unmarkReviewed,
} from './reviewed-store'
import {
  lanBindError,
  lanNumericUrl,
  lanUrl,
  startLanListener,
  startTailnetListener,
  stopLanListener,
  stopTailnetListener,
  tailnetBindError,
  tailnetUrl,
} from './tailnet-listener'
import { listTerminals, renameTerminal, type TerminalInfo } from './terminal-manager'
import { clearWorkingTreeSnapshot, workingTreeSnapshot } from './working-tree'

// No per-connection context: appRouter procedures are pure Node and must never
// reference a caller (per-connection concerns live shell-side until the Stage 2
// WS session exists). The Electron-native procedures live in src/main/shell-api.ts.
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

// Probing each provider CLI's status shells out (or will, once the drivers land), so
// cache the roster of statuses for a short TTL — the model picker polls it and doesn't
// need per-keystroke freshness.
const PROVIDER_STATUS_TTL_MS = 30_000
let providerStatusCache: { at: number; value: ProviderStatus[] } | null = null

// Stale-while-revalidate for agentProviders across launches: a single background re-probe
// refreshes both the in-memory cache and the persisted `agentProviderCache`. The in-flight
// flag stops a burst of first-open queries from stampeding the CLI probe.
let providerReprobeInFlight = false
async function reprobeProviders(): Promise<void> {
  if (providerReprobeInFlight) return
  providerReprobeInFlight = true
  try {
    const value = await providerStatuses()
    providerStatusCache = { at: Date.now(), value }
    await updateConfig((c) => withAgentProviderCache(c, value))
  } finally {
    providerReprobeInFlight = false
  }
}
function kickProviderReprobe(): void {
  // Fire-and-forget: the persisted cache is already serving this request; errors are
  // swallowed so a failed re-probe just leaves the stale value in place.
  reprobeProviders().catch(() => {})
}

// Slash-command lists are scanned from disk per (repo, provider); cache them for the same
// short TTL so the composer's command menu doesn't re-walk the filesystem per keystroke.
const agentCommandsCache = new Map<string, { at: number; value: AgentCommand[] }>()

// Provider limit probes hit the network (Claude) / an RPC round-trip (Codex), so cache the
// result per provider for a longer TTL — the Quick Access poll only needs coarse freshness.
const AGENT_LIMITS_TTL_MS = 60_000
const agentLimitsCache = new Map<AgentProvider, { at: number; value: ProviderLimits | null }>()

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

/** Working-tree flow groups (shared by gitFlow + diffReading). */
async function loadWorkingFlow(repoPath: string): Promise<FlowGroup[]> {
  const [{ files, stats }, stored] = await Promise.all([
    workingTreeSnapshot(repoPath),
    readLayers(repoPath),
  ])
  const layers = stored ?? DEFAULT_LAYERS
  const key = flowKey(files, stats, layers)
  const cached = flowCache.get(repoPath)
  if (cached && cached.key === key) return cached.groups
  const groups = await readSourcesAndBuildFlow(repoPath, files, stats, layers)
  flowCache.set(repoPath, { key, groups })
  return groups
}

/** Branch-range flow groups + base label (shared by gitRangeFlow + diffReading). */
async function loadRangeFlow(repoPath: string): Promise<{ groups: FlowGroup[]; base: string }> {
  const base = await gitDefaultBranch(repoPath)
  try {
    const mergeBase = await gitMergeBase(repoPath, base)
    const [files, stored, stats] = await Promise.all([
      gitRangeChangedFilesFrom(repoPath, mergeBase),
      readLayers(repoPath),
      gitRangeNumstatFrom(repoPath, mergeBase),
    ])
    const layers = stored ?? DEFAULT_LAYERS
    const key = `${base}\n${flowKey(files, stats, layers)}`
    const cached = rangeFlowCache.get(repoPath)
    if (cached && cached.key === key) return { groups: cached.groups, base }
    const groups = await readSourcesAndBuildFlow(repoPath, files, stats, layers)
    rangeFlowCache.set(repoPath, { key, groups })
    return { groups, base }
  } catch {
    return { groups: [], base }
  }
}

/** Historical commit flow groups (shared by gitCommitFlow + diffReading). */
async function loadCommitFlow(repoPath: string, hash: string): Promise<FlowGroup[]> {
  try {
    const [files, stored, stats] = await Promise.all([
      gitCommitFiles(repoPath, hash),
      readLayers(repoPath),
      gitCommitNumstat(repoPath, hash),
    ])
    const layers = stored ?? DEFAULT_LAYERS
    const cacheKey = `${repoPath}\n${hash}`
    const key = `${hash}\n${flowKey(files, stats, layers)}`
    const cached = commitFlowCache.get(cacheKey)
    if (cached && cached.key === key) return cached.groups
    const groups = await readSourcesAndBuildFlow(repoPath, files, stats, layers)
    commitFlowCache.set(cacheKey, { key, groups })
    return groups
  } catch {
    return []
  }
}

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
  const [{ files, stats }, stored, repoFiles, reviewSet] = await Promise.all([
    workingTreeSnapshot(input),
    readLayers(input),
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

  // Drop a repo from the recents list. Removes only the recents entry — the repo's
  // per-repo config under `repos` (hidden/pinned paths) survives, so re-opening it
  // restores those settings.
  removeRecentRepo: t.procedure.input(z.string()).mutation(async ({ input }) => {
    await updateConfig((config) => withoutRecentRepo(config, input))
  }),

  // Daemon-side directory browser for the repo picker (replaces the native
  // open-folder dialog — repos are daemon paths, so a remote daemon must pick
  // ITS paths; see remote-envs decision 5). `null` starts at the daemon home.
  // Directory NAMES only, never file contents; any token-holder can already open
  // any path via openRepoPath, so this widens nothing.
  browseDirs: t.procedure
    .input(z.string().nullable())
    .query(({ input }): Promise<BrowseResult> => browseDirs(input)),

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

  // A mark stores a content fingerprint (sha256 of the file's diff vs HEAD) so it can be
  // reconciled: `reviewedPaths` re-derives each marked file's current fingerprint and
  // prunes any mark whose content changed (external commit, amend, post-mark edit).
  markReviewed: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await markReviewed(
        input.repoPath,
        input.path,
        await reviewedFingerprint(input.repoPath, input.path),
      )
    }),

  unmarkReviewed: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await unmarkReviewed(input.repoPath, input.path)
    }),

  reviewedPaths: t.procedure.input(z.string()).query(async ({ input }): Promise<string[]> => {
    // Only the marked paths need fingerprinting (few files); reconcile prunes stale
    // marks and writes through so reviewed.json stays truthful for the MCP reader.
    // reconcileReviewed re-reads after prune so a concurrent markReviewed (the UI's
    // optimistic tick) is never omitted from this response — that omission used to
    // overwrite the client cache and make the mark appear to un-toggle a second later.
    const marks = await readReviewedMarks(input)
    const current = await reviewedFingerprints(
      input,
      marks.map((mark) => mark.path),
    )
    return reconcileReviewed(input, marks, current)
  }),

  setReviewed: t.procedure
    .input(z.object({ repoPath: z.string(), paths: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      const fingerprints = await reviewedFingerprints(input.repoPath, input.paths)
      await setReviewedMarks(
        input.repoPath,
        Array.from(fingerprints, ([path, fingerprint]) => ({ path, fingerprint })),
      )
    }),

  gitQuickCommand: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        command: z.string().refine((id) => id in QUICK_COMMANDS, 'unknown command'),
        pullMode: z.enum(['merge', 'rebase']).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const out = await gitQuickCommand(input.repoPath, input.command, input.pullMode)
      clearWorkingTreeSnapshot(input.repoPath)
      return out
    }),

  gitStageAll: t.procedure.input(z.object({ repoPath: z.string() })).mutation(async ({ input }) => {
    await gitStageAll(input.repoPath)
    clearWorkingTreeSnapshot(input.repoPath)
  }),

  gitUnstageAll: t.procedure
    .input(z.object({ repoPath: z.string() }))
    .mutation(async ({ input }) => {
      await gitUnstageAll(input.repoPath)
      clearWorkingTreeSnapshot(input.repoPath)
    }),

  gitStageFile: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await gitStageFile(input.repoPath, input.path)
      clearWorkingTreeSnapshot(input.repoPath)
    }),

  gitUnstageFile: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await gitUnstageFile(input.repoPath, input.path)
      clearWorkingTreeSnapshot(input.repoPath)
    }),

  // Discard a single file's changes. A tracked file reverts to its committed
  // version (staged + unstaged edits gone, deletions restored); a new file is
  // unstaged then moved to the Trash (recoverable, like the tree's Delete) since
  // it has no committed version to fall back to. `trash` (npm) replaces Electron's
  // shell.trashItem — files must be trashed on the machine that owns them, and this
  // module stays Electron-free.
  gitDiscardFile: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      if (await gitFileInHead(input.repoPath, input.path)) {
        await gitRestoreFromHead(input.repoPath, input.path)
      } else {
        await gitResetPath(input.repoPath, input.path)
        await trash(join(input.repoPath, input.path))
      }
      clearWorkingTreeSnapshot(input.repoPath)
    }),

  gitCommit: t.procedure
    .input(z.object({ repoPath: z.string(), message: z.string().trim().min(1) }))
    .mutation(async ({ input }) => {
      await gitCommit(input.repoPath, input.message)
      clearWorkingTreeSnapshot(input.repoPath)
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

  trashPath: t.procedure.input(z.string()).mutation(async ({ input }) => {
    await trash(input)
  }),

  gitStatus: t.procedure.input(z.string()).query(({ input }) => gitStatus(input)),

  gitSuggestions: t.procedure.input(z.string()).query(({ input }) => gitSuggestions(input)),

  gitFlow: t.procedure
    .input(z.string())
    .query(({ input }): Promise<FlowGroup[]> => loadWorkingFlow(input)),

  gitRangeFlow: t.procedure
    .input(z.string())
    .query(({ input }): Promise<{ groups: FlowGroup[]; base: string }> => loadRangeFlow(input)),

  gitRangeDiffFile: t.procedure
    .input(z.object({ repoPath: z.string(), base: z.string(), filePath: z.string() }))
    .query(({ input }) => gitRangeDiffFile(input.repoPath, input.base, input.filePath)),

  // Continuous stacked-diff reading surface for Changes (working/branch) and
  // History (a single commit). Same flow order as the lists; every file carries
  // its full diff so the viewer can scroll the whole change as one document.
  diffReading: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        scope: z.discriminatedUnion('type', [
          z.object({ type: z.literal('working') }),
          z.object({ type: z.literal('branch') }),
          z.object({ type: z.literal('commit'), hash: z.string() }),
        ]),
      }),
    )
    .query(async ({ input }): Promise<FeatureReading> => {
      const { repoPath, scope } = input
      let groups: FlowGroup[]
      let name: string
      let fetchHunks: (path: string) => Promise<DiffHunk[]>

      if (scope.type === 'working') {
        groups = await loadWorkingFlow(repoPath)
        name = 'Changes'
        fetchHunks = async (path) => (await gitDiffFile(repoPath, path)).hunks
      } else if (scope.type === 'branch') {
        const range = await loadRangeFlow(repoPath)
        groups = range.groups
        name = `vs ${range.base}`
        fetchHunks = async (path) => (await gitRangeDiffFile(repoPath, range.base, path)).hunks
      } else {
        groups = await loadCommitFlow(repoPath, scope.hash)
        const message = await gitCommitMessage(repoPath, scope.hash)
        name = message.split('\n')[0]?.trim() || scope.hash.slice(0, 12)
        fetchHunks = (path) => gitCommitDiff(repoPath, scope.hash, path)
      }

      const files = groups.flatMap((group) => group.files)
      const diffs = new Map<string, DiffHunk[]>()
      await Promise.all(
        files.map(async (file) => {
          try {
            diffs.set(file.path, await fetchHunks(file.path))
          } catch {
            // vanished/renamed between the flow snapshot and this read — empty hunks
          }
        }),
      )
      return buildDiffReading({ name, groups, diffs })
    }),

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
            diffs.set(file.path, (await gitDiffFile(input, file.path)).hunks)
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

  // The feature artifact: an agent-authored, self-contained HTML document explaining
  // the feature, rendered in a fully sandboxed iframe (see `artifact-store.ts`).
  // Split into a cheap metadata query (the Feature list polls this to show/hide the
  // opener without shuttling the whole document) and a full query the artifact view
  // reads only while open. Both re-validate + size-cap on read (external process owns
  // the file). `clearFeatureArtifact` is the app's one write to this channel.
  featureArtifact: t.procedure
    .input(z.string())
    .query(({ input }): Promise<ArtifactMeta | null> => readArtifactMeta(input)),

  featureArtifactHtml: t.procedure
    .input(z.string())
    .query(({ input }): Promise<Artifact | null> => readArtifact(input)),

  clearFeatureArtifact: t.procedure.input(z.string()).mutation(async ({ input }) => {
    await clearArtifact(input)
  }),

  // Loop evidence: agent-authored HTML proving the work was validated (browser /
  // simulator / screenshots). Same sandbox + size-cap rules as the feature artifact;
  // different product role (ephemeral proof, not narrative explainer). See
  // `evidence-store.ts`. Cheap metadata for the Feature list opener; full HTML only
  // while the evidence view is open. `clearLoopEvidence` is the app's one write.
  loopEvidence: t.procedure
    .input(z.string())
    .query(({ input }): Promise<EvidenceMeta | null> => readEvidenceMeta(input)),

  loopEvidenceHtml: t.procedure
    .input(z.string())
    .query(({ input }): Promise<Evidence | null> => readEvidence(input)),

  clearLoopEvidence: t.procedure.input(z.string()).mutation(async ({ input }) => {
    await clearEvidence(input)
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

  clearResolvedReviewComments: t.procedure
    .input(z.object({ repoPath: z.string() }))
    .mutation(({ input }) => clearResolvedComments(input.repoPath)),

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

  // Agent chat — relay messages between agents (and the human) on this daemon host,
  // stored in ~/.porcelain/chat.json. Local↔remote collab needs the same host as the
  // hub (or the agent-chat skill's SSH path); see the companion skill.
  chatMessages: t.procedure
    .input(z.string())
    .query(({ input }): Promise<ChatMessage[]> => readChatMessages(input)),

  postChatMessage: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        from: z.string().trim().min(1),
        body: z.string().trim().min(1),
      }),
    )
    .mutation(
      ({ input }): Promise<ChatMessage> =>
        postChatMessage(input.repoPath, { from: input.from, body: input.body }),
    ),

  clearChatMessages: t.procedure
    .input(z.object({ repoPath: z.string() }))
    .mutation(({ input }) => clearChatMessages(input.repoPath)),

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

  // Explicit seed of per-repo channel settings (actions/notes/board/layers/comments)
  // — used to carry project setup from one environment/path to another. Never
  // silent: the caller supplies source + target; present channels replace on the
  // target.
  exportRepoSettings: t.procedure
    .input(z.string())
    .query(({ input }): Promise<RepoSettings> => exportRepoSettings(input)),

  importRepoSettings: t.procedure
    .input(z.object({ repoPath: z.string(), settings: repoSettingsSchema }))
    .mutation(
      ({ input }): Promise<ImportRepoSettingsResult> =>
        importRepoSettings(input.repoPath, input.settings),
    ),

  copyRepoSettings: t.procedure
    .input(z.object({ fromPath: z.string(), toPath: z.string() }))
    .mutation(
      ({ input }): Promise<ImportRepoSettingsResult> =>
        copyRepoSettings(input.fromPath, input.toPath),
    ),

  // Agent MCP install on the *daemon host* (not the Mac shell). When the app is
  // pointed at a remote daemon, Settings → Agents must configure that machine's
  // ~/.claude.json etc. so agents there can use the channel tools. `configured`
  // is probed from disk — never a client-local flag (false-negative trap).
  agentMcpInfo: t.procedure.query(
    async (): Promise<{
      agents: { name: AgentName; configPath: string; configured: boolean }[]
    }> => ({
      agents: await listAgentMcpInfo(),
    }),
  ),

  installAgentMcp: t.procedure
    .input(z.array(z.enum(AGENT_NAMES as [AgentName, ...AgentName[]])).optional())
    .mutation(
      async ({ input }): Promise<AgentMcpResult[]> => installMcpForAgents(input ?? AGENT_NAMES),
    ),

  // Remote access over Tailscale: the daemon can additionally listen on the
  // detected Tailscale interface (same token, fixed port; see tailnet-listener.ts).
  // `enabled` is the persisted config flag OR the boot env override (`envForced`,
  // PORCELAIN_TAILNET_BIND=1 — a headless daemon enabled by its unit file, so the
  // GUI shows it on but not togglable); `url` is non-null only while the second
  // listener is actually up, and `error` says why nothing bound ('in-use' = the
  // fixed port is squatted) so the UI can distinguish that from "no tailnet here".
  tailnetStatus: t.procedure.query(
    async (): Promise<{
      enabled: boolean
      url: string | null
      error: 'in-use' | null
      envForced: boolean
    }> => {
      const config = await loadConfig()
      const envForced = process.env.PORCELAIN_TAILNET_BIND === '1'
      return {
        enabled: config.tailnetBind === true || envForced,
        url: tailnetUrl(),
        error: tailnetBindError(),
        envForced,
      }
    },
  ),

  setTailnetBind: t.procedure.input(z.boolean()).mutation(
    async ({
      input,
    }): Promise<{
      enabled: boolean
      url: string | null
      error: 'in-use' | null
      envForced: boolean
    }> => {
      await updateConfig((config) => ({ ...config, tailnetBind: input }))
      // Apply the change live: start the second listener (null url ⇒ no Tailscale
      // interface here) or tear it down. The loopback listener is untouched either way.
      if (input) await startTailnetListener()
      else await stopTailnetListener()
      const envForced = process.env.PORCELAIN_TAILNET_BIND === '1'
      return {
        enabled: input || envForced,
        url: tailnetUrl(),
        error: tailnetBindError(),
        envForced,
      }
    },
  ),

  // Remote access over the home LAN: the daemon can additionally listen on the
  // machine's RFC1918 private addresses (same token, same fixed port; see
  // lan.ts + tailnet-listener.ts). `url` prefers the `<host>.local` Bonjour name;
  // `numericUrl` is the numeric fallback. Both are non-null only while the LAN
  // listener is actually up; `enabled`/`envForced` (PORCELAIN_LAN_BIND=1) and
  // `error` ('in-use' = the fixed port is squatted) mirror tailnetStatus above.
  lanStatus: t.procedure.query(
    async (): Promise<{
      enabled: boolean
      url: string | null
      numericUrl: string | null
      error: 'in-use' | null
      envForced: boolean
    }> => {
      const config = await loadConfig()
      const envForced = process.env.PORCELAIN_LAN_BIND === '1'
      return {
        enabled: config.lanBind === true || envForced,
        url: lanUrl(),
        numericUrl: lanNumericUrl(),
        error: lanBindError(),
        envForced,
      }
    },
  ),

  setLanBind: t.procedure.input(z.boolean()).mutation(
    async ({
      input,
    }): Promise<{
      enabled: boolean
      url: string | null
      numericUrl: string | null
      error: 'in-use' | null
      envForced: boolean
    }> => {
      await updateConfig((config) => ({ ...config, lanBind: input }))
      // Apply the change live: start the LAN listener(s) (null url ⇒ no private
      // interface here) or tear them down. The loopback listener is untouched.
      if (input) await startLanListener()
      else await stopLanListener()
      const envForced = process.env.PORCELAIN_LAN_BIND === '1'
      return {
        enabled: input || envForced,
        url: lanUrl(),
        numericUrl: lanNumericUrl(),
        error: lanBindError(),
        envForced,
      }
    },
  ),

  gitBranch: t.procedure.input(z.string()).query(({ input }) => gitBranch(input)),

  gitBranches: t.procedure.input(z.string()).query(({ input }) => gitBranches(input)),

  gitCheckout: t.procedure
    .input(z.object({ repoPath: z.string(), branch: z.string() }))
    .mutation(({ input }) => gitCheckout(input.repoPath, input.branch)),

  gitCreateBranch: t.procedure
    .input(z.object({ repoPath: z.string(), branch: z.string().min(1) }))
    .mutation(({ input }) => gitCreateBranch(input.repoPath, input.branch)),

  gitWorktrees: t.procedure.input(z.string()).query(({ input }) => gitWorktrees(input)),

  gitLog: t.procedure
    .input(z.object({ repoPath: z.string(), limit: z.number().int().max(500).default(200) }))
    .query(({ input }) => gitLog(input.repoPath, input.limit)),

  gitCommitMessage: t.procedure
    .input(z.object({ repoPath: z.string(), hash: z.string() }))
    .query(({ input }) => gitCommitMessage(input.repoPath, input.hash)),

  // File timeline: the commit history of a single file (--follow across renames).
  gitFileLog: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        filePath: z.string(),
        limit: z.number().int().max(200).default(50),
      }),
    )
    .query(({ input }) => gitFileLog(input.repoPath, input.filePath, input.limit)),

  gitCommitDiff: t.procedure
    .input(z.object({ repoPath: z.string(), hash: z.string(), filePath: z.string() }))
    .query(({ input }) => gitCommitDiff(input.repoPath, input.hash, input.filePath)),

  // Flow-grouped file list for a single historical commit. Uses the same
  // buildFlow pipeline as gitFlow/gitRangeFlow; sources are read from the
  // working tree (option A — best-effort, consistent with gitRangeFlow). A
  // commit hash is immutable, so the cache never needs to bust for the same hash.
  gitCommitFlow: t.procedure
    .input(z.object({ repoPath: z.string(), hash: z.string() }))
    .query(({ input }): Promise<FlowGroup[]> => loadCommitFlow(input.repoPath, input.hash)),

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

  // The daemon-owned terminal roster — every live/exited PTY with its name, cwd, and
  // status. The renderer hydrates its sidebar list from this (filtered to the current
  // repo) on repo open and on daemon reconnect, so a still-running session reappears
  // after a reload. Create/attach/write ride the WS session (byte streams); list/rename
  // are plain request/response, so they live here.
  terminalSessions: t.procedure.query((): TerminalInfo[] => listTerminals()),

  renameTerminal: t.procedure
    .input(z.object({ id: z.string(), name: z.string() }))
    .mutation(({ input }) => {
      renameTerminal(input.id, input.name)
    }),

  // The daemon-owned Agent thread roster for a repo — like the terminal roster, the
  // renderer hydrates its Agent list from this and re-reads it on the `agent-threads`
  // app event. Turn streaming + approvals ride the WS session; the roster is plain
  // request/response, so it lives here.
  agentThreads: t.procedure
    .input(z.object({ repoPath: z.string() }))
    .query(({ input }): Promise<ThreadInfo[]> => listThreads(input.repoPath)),

  // Create a thread. Every field except repoPath is optional: whatever the caller omits is
  // filled from the chosen provider's remembered defaults — model, access mode, effort/
  // context options, and Build/Plan interaction — so a bare "+" reopens the last-used
  // provider exactly how it was left, and an explicit-provider pick inherits THAT provider's
  // defaults (see resolveCreationDefaults). A create resolving to a non-empty model records
  // the resolved config as that provider's new defaults.
  createAgentThread: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        provider: agentProviderSchema.optional(),
        model: z.string().optional(),
        mode: agentModeSchema.optional(),
        options: threadOptionsSchema.optional(),
      }),
    )
    .mutation(async ({ input }): Promise<ThreadInfo> => {
      const config = await loadConfig()
      const resolved = resolveCreationDefaults(config, {
        provider: input.provider,
        model: input.model,
        mode: input.mode,
        options: input.options,
      })
      if (resolved.model !== '') {
        await updateConfig((c) =>
          withAgentDefaults(c, resolved.provider, {
            model: resolved.model,
            mode: resolved.mode,
            ...(resolved.options !== undefined ? { options: resolved.options } : {}),
            ...(resolved.interaction !== undefined ? { interaction: resolved.interaction } : {}),
          }),
        )
      }
      return createThread({
        repoPath: input.repoPath,
        provider: resolved.provider,
        model: resolved.model,
        mode: resolved.mode,
        ...(resolved.options !== undefined ? { options: resolved.options } : {}),
        ...(resolved.interaction !== undefined ? { interaction: resolved.interaction } : {}),
      })
    }),

  renameAgentThread: t.procedure
    .input(z.object({ id: z.string(), title: z.string().min(1) }))
    .mutation(({ input }) => renameThread(input.id, input.title)),

  updateAgentThread: t.procedure
    .input(
      z.object({
        id: z.string(),
        model: z.string().optional(),
        mode: agentModeSchema.optional(),
        provider: agentProviderSchema.optional(),
        interaction: agentInteractionSchema.optional(),
        options: threadOptionsSchema.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const updated = await updateThread(input.id, {
        model: input.model,
        mode: input.mode,
        provider: input.provider,
        interaction: input.interaction,
        options: input.options,
      })
      // Whenever the switch touched any remembered field (model/mode/interaction/options —
      // not just the model), record the thread's resulting config as that provider's
      // defaults (the provider may have followed the model), so the next new thread for
      // this provider resumes exactly how it was left.
      if (
        updated &&
        (input.model !== undefined ||
          input.mode !== undefined ||
          input.interaction !== undefined ||
          input.options !== undefined)
      ) {
        await updateConfig((c) =>
          withAgentDefaults(c, updated.provider, {
            model: updated.model,
            mode: updated.mode,
            ...(updated.interaction !== undefined ? { interaction: updated.interaction } : {}),
            ...(updated.options !== undefined ? { options: updated.options } : {}),
          }),
        )
      }
    }),

  deleteAgentThread: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => deleteThread(input.id)),

  // Recent on-disk CLI sessions for the repo (Grok/Claude/Codex/OpenCode) that can be
  // opened as Agent threads. Sessions already imported carry `threadId` so the UI reopens
  // instead of duplicating. Not cached — the store is local and the scan is cheap enough.
  agentExternalSessions: t.procedure
    .input(
      z.object({ repoPath: z.string(), limit: z.number().int().positive().max(100).optional() }),
    )
    .query(
      ({ input }): Promise<ExternalSession[]> => listExternalSessions(input.repoPath, input.limit),
    ),

  // Import a CLI session into a Porcelain thread (or return the existing one if already
  // linked). The transcript becomes the timeline; the next send resumes that CLI session.
  importAgentSession: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        provider: agentProviderSchema,
        externalId: z.string().min(1),
      }),
    )
    .mutation(async ({ input }): Promise<ThreadInfo> => {
      const thread = await importExternalSession(input.repoPath, input.provider, input.externalId)
      if (thread === null) {
        throw new Error(
          `Could not import ${input.provider} session ${input.externalId} for this repo.`,
        )
      }
      return thread
    }),

  // Install/auth state + model catalog per provider, probed from the installed CLIs
  // (tolerant of a missing one — see providerStatuses). Cached 30s (see the TTL above).
  agentProviders: t.procedure.query(async (): Promise<ProviderStatus[]> => {
    const now = Date.now()
    if (providerStatusCache && now - providerStatusCache.at < PROVIDER_STATUS_TTL_MS) {
      return providerStatusCache.value
    }
    // Stale-while-revalidate across launches: a persisted probe returns instantly (so the
    // model picker's favorites render on first open) while a single background re-probe
    // refreshes both caches. With nothing persisted, probe inline as before and store it.
    const config = await loadConfig()
    if (config.agentProviderCache) {
      kickProviderReprobe()
      providerStatusCache = { at: now, value: config.agentProviderCache }
      return config.agentProviderCache
    }
    const value = await providerStatuses()
    providerStatusCache = { at: now, value }
    await updateConfig((c) => withAgentProviderCache(c, value))
    return value
  }),

  // The custom slash commands a provider's CLI exposes for a repo (scanned from its command
  // `.md` files). Cached 30s per (repo, provider) like agentProviders.
  agentCommands: t.procedure
    .input(z.object({ repoPath: z.string(), provider: agentProviderSchema }))
    .query(async ({ input }): Promise<AgentCommand[]> => {
      const key = `${input.provider}:${input.repoPath}`
      const cached = agentCommandsCache.get(key)
      const now = Date.now()
      if (cached && now - cached.at < PROVIDER_STATUS_TTL_MS) return cached.value
      const value = await agentCommands(input.repoPath, input.provider)
      agentCommandsCache.set(key, { at: now, value })
      return value
    }),

  // A provider's live quota windows + plan (Codex rate limits, Claude OAuth `/usage`), or
  // null when it exposes none / isn't subscription-authed / the probe failed. Cached 60s per
  // provider — the Agent Quick Access polls it. Only DERIVED percentages/labels cross here;
  // no provider auth token ever does (see the audit skill's agent-driver invariant).
  agentLimits: t.procedure
    .input(z.object({ provider: agentProviderSchema }))
    .query(async ({ input }): Promise<ProviderLimits | null> => {
      const cached = agentLimitsCache.get(input.provider)
      const now = Date.now()
      if (cached && now - cached.at < AGENT_LIMITS_TTL_MS) return cached.value
      const value = await agentLimits(input.provider)
      agentLimitsCache.set(input.provider, { at: now, value })
      return value
    }),

  // Manual on-demand refresh (the Limits group's reload button): fetch fresh limits,
  // bypassing the TTL cache, and OVERWRITE the cache entry so the next auto poll sees the
  // new value. The renderer invalidates `agentLimits` on success (hooks own invalidation).
  // The driver fetch is itself bounded (~30s worst case), so this can't stampede the cache.
  agentLimitsRefresh: t.procedure
    .input(z.object({ provider: agentProviderSchema }))
    .mutation(async ({ input }): Promise<ProviderLimits | null> => {
      const value = await agentLimits(input.provider)
      agentLimitsCache.set(input.provider, { at: Date.now(), value })
      return value
    }),

  // How often the Agent Limits group re-polls (global config). Null when unset — the
  // renderer resolves the DEFAULT_LIMITS_REFRESH default in one place (see useAgentLimits).
  limitsRefresh: t.procedure.query(async (): Promise<LimitsRefresh | null> => {
    const config = await loadConfig()
    return config.limitsRefresh ?? null
  }),

  setLimitsRefresh: t.procedure
    .input(limitsRefreshSchema)
    .mutation(async ({ input }): Promise<LimitsRefresh> => {
      await updateConfig((config) => ({ ...config, limitsRefresh: input }))
      return input
    }),

  // The Agent tab's favorited models (`provider:modelId` keys), stored global in the
  // daemon config so they follow the user to the iPad/browser client.
  agentModelFavorites: t.procedure.query(async (): Promise<string[]> => {
    const config = await loadConfig()
    return config.agentModelFavorites ?? []
  }),

  toggleAgentModelFavorite: t.procedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input }): Promise<string[]> => {
      const updated = await updateConfig((config) => toggleModelFavorite(config, input.key))
      return updated.agentModelFavorites ?? []
    }),
})

export type AppRouter = typeof router
