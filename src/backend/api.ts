import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { initTRPC, TRPCError } from '@trpc/server'
import trash from 'trash'
import { z } from 'zod'
import {
  type AuthIdentity,
  accessSnapshot,
  issuePairingGrant,
  revokeAuthorizedClient,
  revokePairingGrant,
} from './access-store'
import {
  type Action,
  addAction,
  deleteAction,
  moveAction,
  readActions,
  updateAction,
} from './actions-store'
import { displayAdminTokenPath } from './admin-token'
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
import { type DaemonIdentity, daemonIdentity } from './daemon-identity'
import { daemonVersion } from './daemon-version'
import type { DiffHunk } from './diff'
import { inlineLocalAssets } from './evidence-assets'
import {
  clearEvidence,
  type Evidence,
  type EvidenceMeta,
  MAX_HTML_BYTES,
  readEvidence,
  readEvidenceMeta,
} from './evidence-store'
import {
  cachedFeatureReading,
  gatherFeature,
  getFeatureBuild,
  storeFeatureReading,
} from './feature-build'
import { buildExploreReading, walkExplore } from './feature-explore'
import {
  buildDiffReading,
  buildFeatureReading,
  type FeatureReading,
  type FeatureView,
} from './feature-view'
import { DEFAULT_LAYERS, type FlowGroup, type Layer } from './flow'
import { loadCommitFlow, loadRangeFlow, loadWorkingFlow } from './flow-build'
import { uniqueDuplicatePath } from './fs-ops'
import { funnelStatus, startFunnel, stopFunnel } from './funnel'
import { fuzzySearch, type SearchResult } from './fuzzy'
import {
  gitAddWorktree,
  gitBranches,
  gitCheckout,
  gitCommit,
  gitCommitDiff,
  gitCommitFiles,
  gitCommitMessage,
  gitCreateBranch,
  gitDiffFile,
  gitFileInHead,
  gitFileLog,
  gitGrep,
  gitHead,
  gitListFiles,
  gitListSearchFiles,
  gitLog,
  gitPush,
  gitQuickCommand,
  gitRangeDiffFile,
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
import { imageMimeForPath, isBinaryBuffer } from './image-mime'
import { readLayers, writeLayers } from './layers-store'
import { isLinkedWorktree } from './linked-worktree'
import { readNotes, writeNotes } from './notes-store'
import { expandUserPath } from './path-expand'
import { exceedsReadLimit } from './read-limits'
import { withoutRecentRepo, withRecentRepo } from './repo-config'
import {
  copyRepoSettings,
  exportRepoSettings,
  type ImportRepoSettingsResult,
  importRepoSettings,
  type RepoSettings,
  repoSettingsSchema,
  seedRepoSettings,
  seedWorktreeSettings,
} from './repo-settings'
import { clearReviewSet } from './review-store'
import {
  clearReviewedPaths,
  markReviewed,
  readReviewedMarks,
  reconcileReviewed,
  setReviewedMarks,
  unmarkReviewed,
} from './reviewed-store'
import {
  hiddenPathsForRepo,
  hidePath as hideScopePath,
  pinnedPathsForRepo,
  pinPath as pinScopePath,
  type RepoScope,
  readRepoScope,
  unhidePath as unhideScopePath,
  unpinPath as unpinScopePath,
} from './scope-store'
import { searchCandidates } from './search-candidates'
import { clientSessionCount, closeClientSessions } from './session'
import {
  ifaceListenerPort,
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
import { clearWorkingTreeSnapshot } from './working-tree'
import { worktreeInbox } from './worktree-inbox'

export interface DaemonTrpcContext {
  auth: AuthIdentity
}

const t = initTRPC.context<DaemonTrpcContext>().create({ isServer: true })
const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.auth.kind !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Host administrator access required' })
  }
  return next()
})

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

export const router = t.router({
  // The daemon's build version, so the client can detect and surface skew (a client
  // on a newer/older build than the daemon it's bound to) once and clearly, instead
  // of a cryptic per-procedure "No procedure found" failure. A daemon older than
  // 0.30 has no such procedure, so the client's query 404s (NOT_FOUND) — it treats
  // that as a definitely-older 'pre-0.30' rather than surfacing the raw error.
  //
  // It also carries this daemon's IDENTITY (host/platform/arch — see daemon-identity.ts)
  // so a client can name and recognize the machine it reached instead of relying on a
  // nickname the human typed. Widened rather than split into a second procedure: this
  // is already the probe every client calls, and a daemon older than that widening
  // returns `{ version }` alone — clients must read the identity fields as OPTIONAL.
  daemonInfo: t.procedure.query((): { version: string } & DaemonIdentity => ({
    version: daemonVersion(),
    ...daemonIdentity(),
  })),

  // Host access administration. These procedures are callable only with the
  // administrator credential held by the local Electron shell / host CLI.
  // Paired devices receive client identities and are rejected by the middleware.
  accessStatus: adminProcedure.query(async () => ({
    ...(await accessSnapshot()),
    connected: clientSessionCount(),
    adminTokenPath: displayAdminTokenPath(),
  })),

  issuePairingLink: adminProcedure
    .input(
      z.object({
        label: z.string().trim().min(1).max(80),
        baseUrl: z.string().url(),
      }),
    )
    .mutation(async ({ input }) => {
      const base = new URL(input.baseUrl)
      if (base.protocol !== 'http:' && base.protocol !== 'https:') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pairing requires HTTP or HTTPS' })
      }
      if (base.username !== '' || base.password !== '' || base.search !== '' || base.hash !== '') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Pairing endpoint must not contain credentials, query, or fragment',
        })
      }
      base.pathname = '/pair'
      const grant = await issuePairingGrant(input.label)
      base.hash = new URLSearchParams([['token', grant.credential]]).toString()
      return { ...grant, url: base.toString() }
    }),

  revokePairingLink: adminProcedure.input(z.string()).mutation(async ({ input }) => {
    await revokePairingGrant(input)
  }),

  revokeAuthorizedClient: adminProcedure.input(z.string()).mutation(async ({ input }) => {
    if (await revokeAuthorizedClient(input)) closeClientSessions(input)
  }),

  revokeCurrentClient: t.procedure.mutation(async ({ ctx }) => {
    if (ctx.auth.kind !== 'client') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'No paired-device credential to revoke' })
    }
    if (await revokeAuthorizedClient(ctx.auth.clientId)) closeClientSessions(ctx.auth.clientId)
  }),

  openRepoPath: t.procedure.input(z.string()).mutation(async ({ input }): Promise<RepoInfo> => {
    await stat(input)
    await recordRecent(input)
    // A worktree opened for the first time inherits its family's companion data
    // (see seedWorktreeSettings). Never overwrites, never throws.
    await seedWorktreeSettings(input)
    warmFileList(input)
    return toRepoInfo(input)
  }),

  recentRepos: t.procedure
    // Linked worktrees are dropped by default: a worktree already has a home in the
    // footer's worktree switcher, so listing it as a project too shows one checkout
    // under two identities. They stay in the STORED recents — `includeWorktrees` is
    // what lets last-repo restore land back in the worktree the human left.
    .input(z.object({ includeWorktrees: z.boolean().default(false) }).optional())
    .query(async ({ input }): Promise<RepoInfo[]> => {
      const includeWorktrees = input?.includeWorktrees ?? false
      const config = await loadConfig()
      const existing = await Promise.all(
        config.recentRepos.map(async (path) => {
          try {
            await stat(path)
            if (!includeWorktrees && (await isLinkedWorktree(path))) return null
            return path
          } catch {
            return null
          }
        }),
      )
      return existing.filter((p): p is string => p !== null).map(toRepoInfo)
    }),

  // Drop a repo from the recents list. Removes only the recents entry — scope
  // (hidden/pinned) lives in ~/.porcelain/scope.json and is keyed by path, so it
  // survives remove + re-open.
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
      const [hidden, pinnedList] = await Promise.all([
        hiddenPathsForRepo(input.repoPath),
        pinnedPathsForRepo(input.repoPath),
      ])
      const pinned = new Set(pinnedList)
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
      await hideScopePath(input.repoPath, input.path)
    }),

  unhidePath: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await unhideScopePath(input.repoPath, input.path)
    }),

  pinPath: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await pinScopePath(input.repoPath, input.path)
    }),

  unpinPath: t.procedure
    .input(z.object({ repoPath: z.string(), path: z.string() }))
    .mutation(async ({ input }) => {
      await unpinScopePath(input.repoPath, input.path)
    }),

  pinnedEntries: t.procedure.input(z.string()).query(async ({ input }): Promise<DirEntry[]> => {
    const [hidden, pinned] = await Promise.all([
      hiddenPathsForRepo(input),
      pinnedPathsForRepo(input),
    ])
    const entries = await Promise.all(
      pinned.map(async (path): Promise<DirEntry | null> => {
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
          return null // pinned path no longer exists; keep the scope entry, skip the row
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
    // marks and writes through so reviewed.json stays truthful for the CLI reader.
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

  gitPush: t.procedure.input(z.object({ repoPath: z.string() })).mutation(async ({ input }) => {
    // Push doesn't touch the working tree, so no clearWorkingTreeSnapshot here.
    return gitPush(input.repoPath)
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
    // Agents (and humans pasting paths) use ~/… and file://…; expand on the daemon
    // host so a remote environment resolves its own home, not the client's.
    const path = expandUserPath(input)
    try {
      const info = await stat(path)
      if (exceedsReadLimit(info.size)) {
        return { type: 'too-large', size: info.size }
      }
      const imageMime = imageMimeForPath(path)
      if (imageMime) {
        const buffer = await readFile(path)
        return { type: 'image', dataUrl: `data:${imageMime};base64,${buffer.toString('base64')}` }
      }
      const buffer = await readFile(path)
      if (isBinaryBuffer(buffer)) {
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

  // HTML preview for the built-in viewer: read a .html/.htm file and inline
  // sibling relative images as data URIs so a sandboxed srcdoc can show them
  // under the app CSP (same helper and size cap as loop evidence).
  previewHtml: t.procedure.input(z.string()).query(async ({ input }): Promise<string | null> => {
    try {
      const info = await stat(input)
      if (exceedsReadLimit(info.size) || info.size > MAX_HTML_BYTES) return null
      const raw = await readFile(input, 'utf8')
      if (raw.length === 0) return null
      if (Buffer.byteLength(raw, 'utf8') > MAX_HTML_BYTES) return null
      const html = await inlineLocalAssets(dirname(input), raw)
      if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) return null
      return html
    } catch (err) {
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return null
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

  // The feature view (the Review's Execution outline): exactly the files the agent
  // listed in the review set (porcelain CLI → ~/.porcelain/review-sets.json), in
  // agent order, with notes/layers/thesis/sections. Null without a set (the
  // renderer shows the "No review yet" empty state). Working-tree changes that
  // the agent did not list never appear here.
  featureView: t.procedure
    .input(z.string())
    .query(async ({ input }): Promise<FeatureView | null> => {
      const g = await gatherFeature(input)
      if (!g.reviewSet) return null
      return (await getFeatureBuild(input, { ...g, reviewSet: g.reviewSet })).view
    }),

  // The Review document: thesis + walkthrough sections (prose/diagram + anchored
  // code blocks) + the leftover files flow-grouped, with just the relevant lines
  // (diff hunks for changed files, symbol slices for context/shipped) and the
  // loop-evidence meta as the final chapter. Review-set-only — null without an
  // agent review set, so the slice heuristic only ever runs on the agent's
  // curated, annotated set.
  featureReading: t.procedure
    .input(z.string())
    .query(async ({ input }): Promise<FeatureReading | null> => {
      const g = await gatherFeature(input)
      if (!g.reviewSet) return null
      // Evidence meta is read fresh on every poll (a cheap stat-level read): it is
      // NOT part of the feature key, so a cached reading would otherwise pin a
      // stale/absent final chapter until the working tree changed.
      const meta = await readEvidenceMeta(input)
      const evidence = meta
        ? {
            title: meta.title,
            updatedAt: meta.updatedAt,
            checks: meta.checks,
            medium: meta.medium,
          }
        : null
      const canvas = g.reviewSet.canvas
      const cached = cachedFeatureReading(input, g.key)
      // Evidence + canvas can change without the feature key; always reattach them.
      if (cached) return { ...cached, evidence, canvas }
      const { view, sources } = await getFeatureBuild(input, { ...g, reviewSet: g.reviewSet })
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
      const reading = buildFeatureReading({
        view,
        sections: g.reviewSet.sections,
        sources,
        diffs,
        evidence,
        canvas,
      })
      storeFeatureReading(input, g.key, reading)
      return reading
    }),

  // Clear a repo's agent review set AND its loop evidence → the Review reverts to
  // its "No review yet" empty state with no orphaned ~/.porcelain/loop-evidence
  // directory. The app's one write to each channel (see `clearReviewSet` /
  // `clearEvidence`); the next featureView/featureReading poll reads null.
  clearFeatureReview: t.procedure.input(z.string()).mutation(async ({ input }) => {
    await clearReviewSet(input)
    // Clear evidence too: Feature Clear is the human's "I'm done with this Review"
    // affordance. Leaving loop-evidence on disk after dropping the review set
    // orphans files with no UI surface (board card 6281e071). Evidence-only Clear
    // still lives on the Loop evidence chapter header.
    await clearEvidence(input)
  }),

  // Loop evidence: agent-authored HTML proving the work was validated (browser /
  // simulator / screenshots), rendered sandboxed as the Review's final chapter.
  // See `evidence-store.ts` — re-validated + size-capped on every read (external
  // process owns the files). Cheap metadata query; full HTML fetched only while
  // the evidence chapter is on screen. `clearLoopEvidence` is the app's one write.
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
  // via the porcelain CLI (`comments list`) and resolvable by it (`comments resolve`).
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
  // agent reads (`board list`) and mutates (`board create/update/move/delete`) via the CLI.
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
  // channel the agent reads (`actions list`) and curates (`actions create/update/delete`)
  // via the CLI. The agent never EXECUTES one — running is human-only (see the audit skill).
  actions: t.procedure
    .input(z.string())
    .query(({ input }): Promise<Action[]> => readActions(input)),

  addAction: t.procedure
    .input(
      z.object({
        repoPath: z.string(),
        title: z.string().trim().min(1),
        command: z.string().trim().min(1),
        where: z.enum(['primary', 'local']).optional(),
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
        where: z.enum(['primary', 'local']).optional(),
      }),
    )
    .mutation(({ input }) =>
      updateAction(input.repoPath, input.id, {
        title: input.title,
        command: input.command,
        where: input.where,
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
        // null clears the override back to the Docs + Agents starters
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

  /** Monorepo hide/pin lists for this repo (empty arrays when never configured). */
  repoScope: t.procedure.input(z.string()).query(async ({ input }): Promise<RepoScope> => {
    return readRepoScope(input)
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

  // Remote access over Tailscale: the daemon can additionally listen on the
  // detected Tailscale interface (same token, fixed port; see tailnet-listener.ts).
  // `enabled` is the persisted config flag OR the boot env override (`envForced`,
  // PORCELAIN_TAILNET_BIND=1 — a headless daemon enabled by its unit file, so the
  // GUI shows it on but not togglable); `url` is non-null only while the second
  // listener is actually up, and `error` says why nothing bound ('in-use' = the
  // fixed port is squatted) so the UI can distinguish that from "no tailnet here".
  tailnetStatus: adminProcedure.query(
    async (): Promise<{
      enabled: boolean
      url: string | null
      error: 'in-use' | null
      envForced: boolean
      /** Port LAN/tailnet bind (same as PORCELAIN_DAEMON_PORT when set). */
      port: number
    }> => {
      const config = await loadConfig()
      const envForced = process.env.PORCELAIN_TAILNET_BIND === '1'
      return {
        enabled: config.tailnetBind === true || envForced,
        url: tailnetUrl(),
        error: tailnetBindError(),
        envForced,
        port: ifaceListenerPort(),
      }
    },
  ),

  setTailnetBind: adminProcedure.input(z.boolean()).mutation(
    async ({
      input,
    }): Promise<{
      enabled: boolean
      url: string | null
      error: 'in-use' | null
      envForced: boolean
      port: number
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
        port: ifaceListenerPort(),
      }
    },
  ),

  // Remote access over the home LAN: the daemon can additionally listen on the
  // machine's RFC1918 private addresses (same token, same daemon port; see
  // lan.ts + tailnet-listener.ts). `url` prefers the `<host>.local` Bonjour name;
  // `numericUrl` is the numeric fallback. Both are non-null only while the LAN
  // listener is actually up; `enabled`/`envForced` (PORCELAIN_LAN_BIND=1) and
  // `error` ('in-use' = the port is squatted) mirror tailnetStatus above.
  lanStatus: adminProcedure.query(
    async (): Promise<{
      enabled: boolean
      url: string | null
      numericUrl: string | null
      error: 'in-use' | null
      envForced: boolean
      port: number
    }> => {
      const config = await loadConfig()
      const envForced = process.env.PORCELAIN_LAN_BIND === '1'
      return {
        enabled: config.lanBind === true || envForced,
        url: lanUrl(),
        numericUrl: lanNumericUrl(),
        error: lanBindError(),
        envForced,
        port: ifaceListenerPort(),
      }
    },
  ),

  setLanBind: adminProcedure.input(z.boolean()).mutation(
    async ({
      input,
    }): Promise<{
      enabled: boolean
      url: string | null
      numericUrl: string | null
      error: 'in-use' | null
      envForced: boolean
      port: number
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
        port: ifaceListenerPort(),
      }
    },
  ),

  funnelStatus: adminProcedure.query(async () => ({
    ...(await funnelStatus()),
    envForced: process.env.PORCELAIN_FUNNEL_BIND === '1',
  })),

  setFunnelBind: adminProcedure.input(z.boolean()).mutation(async ({ input }) => {
    const status = input ? await startFunnel() : await stopFunnel()
    await updateConfig((config) => ({ ...config, funnelBind: input }))
    return { ...status, envForced: process.env.PORCELAIN_FUNNEL_BIND === '1' }
  }),

  gitHead: t.procedure.input(z.string()).query(({ input }) => gitHead(input)),

  gitBranches: t.procedure.input(z.string()).query(({ input }) => gitBranches(input)),

  gitCheckout: t.procedure
    .input(z.object({ repoPath: z.string(), branch: z.string() }))
    .mutation(({ input }) => gitCheckout(input.repoPath, input.branch)),

  gitCreateBranch: t.procedure
    .input(z.object({ repoPath: z.string(), branch: z.string().min(1) }))
    .mutation(({ input }) => gitCreateBranch(input.repoPath, input.branch)),

  gitWorktrees: t.procedure.input(z.string()).query(({ input }) => gitWorktrees(input)),

  // The Review inbox: from this checkout, the OTHER worktrees of the family with agent
  // work awaiting review. A few git spawns per call is fine — worktree counts are small
  // and the renderer polls at 15s.
  worktreeInbox: t.procedure.input(z.string()).query(({ input }) => worktreeInbox(input)),

  gitAddWorktree: t.procedure
    .input(z.object({ repoPath: z.string(), branch: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const worktree = await gitAddWorktree(input.repoPath, input.branch)
      // The new checkout is the same project under a new path key, so seed it from
      // the checkout it was created against rather than opening it blank.
      await seedRepoSettings(input.repoPath, worktree.path)
      return worktree
    }),

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
      const [files, hidden] = await Promise.all([
        gitListSearchFiles(input.repoPath),
        hiddenPathsForRepo(input.repoPath),
      ])
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
})

export type AppRouter = typeof router
