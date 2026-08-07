import { z } from 'zod'
import {
  commitGroupGenerationOutputSchema,
  commitMessageGenerationInputSchema,
  commitMessageGenerationOutputSchema,
  commitModelOptionsSchema,
} from '../commit-model'
import type { ProcedureName } from './names'

export type ProcedureIo = {
  readonly input: z.ZodType
  readonly output: z.ZodType
}

/**
 * Refined procedure I/O — schemas both clients can share. Start from shapes mobile
 * already validated; expand as web/daemon routers adopt the same definitions.
 */

// —— shared leaf shapes ——
export const fileStatusSchema = z.enum(['modified', 'added', 'deleted', 'renamed', 'untracked'])
export const fileSourceSchema = z.enum(['changed', 'context', 'shipped'])

export const flowFileSchema = z.object({
  path: z.string(),
  status: fileStatusSchema,
  staged: z.boolean().optional(),
  unstaged: z.boolean().optional(),
  additions: z.number().optional(),
  deletions: z.number().optional(),
  connects: z.array(z.string()),
})
export const flowGroupSchema = z.object({ layer: z.string(), files: z.array(flowFileSchema) })

export const diffLineSchema = z.object({
  kind: z.enum(['context', 'add', 'del']),
  oldLine: z.number().nullable(),
  newLine: z.number().nullable(),
  text: z.string(),
})
export const diffHunkSchema = z.object({ header: z.string(), lines: z.array(diffLineSchema) })

export const headRefSchema = z.object({
  branch: z.string().nullable(),
  detachedSha: z.string().nullable(),
})

export const repoInfoSchema = z.object({ path: z.string(), name: z.string() })

export const dirEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  kind: z.enum(['file', 'dir']),
  hidden: z.boolean(),
  pinned: z.boolean(),
})

export const fileViewSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), content: z.string() }),
  z.object({ type: z.literal('image'), dataUrl: z.string() }),
  z.object({ type: z.literal('binary'), size: z.number() }),
  z.object({ type: z.literal('too-large'), size: z.number() }),
  z.object({ type: z.literal('not-found') }),
])

export const terminalInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  cwd: z.string(),
  status: z.enum(['running', 'exited']),
  exitCode: z.number().optional(),
  createdAt: z.number().default(0),
})

export const actionSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    command: z.string(),
    where: z.enum(['primary', 'local']).optional(),
    order: z.number().default(0),
    createdAt: z.number().default(0),
    // Whether THIS machine's human has accepted this command text. Daemon-derived (it is not
    // in the stored action), so it belongs to the wire shape and not to the on-disk one in
    // `actions-store.ts`. A parsing client omitting it under `.strict()` rejects every action.
    trusted: z.boolean().default(false),
  })
  .strict()

export const boardCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().optional(),
  status: z.enum(['todo', 'doing', 'done']),
  order: z.number(),
  createdAt: z.number(),
})

export const reviewCommentSchema = z.object({
  id: z.string(),
  path: z.string(),
  startLine: z.number().optional(),
  endLine: z.number().optional(),
  anchorText: z.string().optional(),
  body: z.string(),
  resolved: z.boolean(),
  createdAt: z.number(),
  agentReply: z
    .object({
      body: z.string(),
      createdAt: z.number(),
    })
    .optional(),
})

const readingFileSchema = z.object({
  path: z.string(),
  status: fileStatusSchema.optional(),
  additions: z.number().optional(),
  deletions: z.number().optional(),
  hunks: z.array(diffHunkSchema).optional(),
})

const changesFeatureReadingSchema = z.object({
  name: z.string(),
  groups: z.array(z.object({ layer: z.string(), files: z.array(readingFileSchema) })),
})

const diffFileResultSchema = z.object({
  hunks: z.array(diffHunkSchema),
  status: fileStatusSchema,
  image: z.object({ dataUrl: z.string() }).optional(),
  binary: z.boolean().optional(),
})

const commitConventionsSchema = z.object({
  scopes: z.array(z.string()),
  types: z.array(z.string()),
})

const gitSuggestionSchema = z.object({ command: z.string(), reason: z.string() })

const searchResultSchema = z.object({
  path: z.string(),
  kind: z.enum(['file', 'dir']),
})

const evidenceCheckSchema = z.object({
  label: z.string(),
  status: z.enum(['pass', 'fail', 'skip']),
  detail: z.string().optional(),
})

const evidenceMetaSchema = z.object({
  title: z.string(),
  updatedAt: z.string(),
  checks: z.array(evidenceCheckSchema),
  dir: z.string().optional(),
  /**
   * @deprecated Evidence is three sub-tabs, not one medium. Installed mobile
   * clients require this literal, so the daemon keeps emitting it; drop it one
   * release after mobile ships the widened schema.
   */
  medium: z.literal('html'),
  /** Documents in `evidence/results/`. */
  results: z.number().optional(),
  /** Images in `evidence/assets/`. */
  assets: z.number().optional(),
  /** A legacy `index.html` is present, surfaced as the "Report" document. */
  hasReport: z.boolean().optional(),
})

/**
 * One document of a set — Intent, or the Results sub-tab of Evidence. Two media
 * and no third: markdown renders escaped, HTML renders only inside
 * `<iframe sandbox="" srcdoc>` with its assets already inlined by the daemon.
 */
export const reviewDocSchema = z.discriminatedUnion('medium', [
  z.object({
    file: z.string(),
    label: z.string(),
    medium: z.literal('markdown'),
    body: z.string(),
  }),
  z.object({
    file: z.string(),
    label: z.string(),
    medium: z.literal('html'),
    body: z.string(),
  }),
])

/** A gallery tile: what the Assets sub-tab lists, without the bytes. */
export const evidenceAssetSchema = z.object({
  file: z.string(),
  label: z.string(),
  kind: z.literal('image'),
  mime: z.string(),
  bytes: z.number(),
})

/**
 * One gallery image, fetched on demand. A data URL rather than a URL to a
 * static route: the daemon serves no user files over HTTP, so the bytes ride
 * the authenticated tRPC channel like every other read.
 */
export const evidenceAssetBodySchema = z.object({
  file: z.string(),
  mime: z.string(),
  bytes: z.number(),
  dataUrl: z.string(),
})

const evidenceSchema = evidenceMetaSchema.extend({
  html: z.string().optional(),
  htmlUnavailable: z
    .object({
      reason: z.literal('too-large'),
      bytes: z.number(),
      maxBytes: z.number(),
    })
    .optional(),
})

const featureViewObjectSchema = z.object({
  name: z.string(),
  fromAgent: z.boolean(),
  thesis: z.string().optional(),
  sections: z.array(z.object({ title: z.string(), anchorCount: z.number() })),
  groups: z.array(
    z.object({
      layer: z.string(),
      files: z.array(
        z.object({
          path: z.string(),
          source: fileSourceSchema,
          status: fileStatusSchema.optional(),
          note: z.string().optional(),
          layer: z.string().optional(),
          additions: z.number().optional(),
          deletions: z.number().optional(),
          connects: z.array(z.string()),
        }),
      ),
    }),
  ),
})

const branchRefSchema = z.object({ name: z.string(), remote: z.string().nullable() })
const worktreeSchema = z.object({ path: z.string(), branch: z.string() })

function io(input: z.ZodType, output: z.ZodType): ProcedureIo {
  return { input, output }
}

const repoPath = z.string()
const repoPathObj = z.object({ repoPath: z.string() })
const repoPathAndPath = z.object({ repoPath: z.string(), path: z.string() })

/** Named schemas so clients keep z.infer precision (procedureIo erases to ZodType). */
export const daemonInfoOutputSchema = z.object({
  version: z.string(),
  host: z.string(),
  platform: z.string(),
  arch: z.string(),
})
export const browseDirsOutputSchema = z.object({
  path: z.string(),
  parent: z.string().nullable(),
  entries: z.array(z.object({ name: z.string(), path: z.string(), isRepo: z.boolean() })),
})

/**
 * Partial map — only procedures with refined schemas. `procedureIo` fills the rest
 * with unknown. Keys must be subset of ProcedureName (lint-procedure-contracts).
 */
export const refinedProcedureIo: Partial<Record<ProcedureName, ProcedureIo>> = {
  daemonInfo: io(z.void(), daemonInfoOutputSchema),
  recentRepos: io(z.object({ includeWorktrees: z.boolean() }).optional(), z.array(repoInfoSchema)),
  openRepoPath: io(z.string(), repoInfoSchema),
  browseDirs: io(z.string().nullable(), browseDirsOutputSchema),
  removeRecentRepo: io(z.string(), z.void()),
  revokeCurrentClient: io(z.void(), z.void()),

  gitFlow: io(repoPath, z.array(flowGroupSchema)),
  reviewedPaths: io(repoPath, z.array(z.string())),
  gitHead: io(repoPath, headRefSchema),
  gitLog: io(
    z.object({ repoPath: z.string(), limit: z.number() }),
    z.array(
      z.object({
        hash: z.string(),
        author: z.string(),
        date: z.string(),
        subject: z.string(),
      }),
    ),
  ),
  gitCommitMessage: io(z.object({ repoPath: z.string(), hash: z.string() }), z.string()),
  gitCommitFlow: io(z.object({ repoPath: z.string(), hash: z.string() }), z.array(flowGroupSchema)),
  commitModels: io(z.void(), commitModelOptionsSchema),
  gitDiffFile: io(z.object({ repoPath: z.string(), filePath: z.string() }), diffFileResultSchema),
  gitCommitDiff: io(
    z.object({ repoPath: z.string(), hash: z.string(), filePath: z.string() }),
    z.array(diffHunkSchema),
  ),
  diffReading: io(
    z.object({
      repoPath: z.string(),
      scope: z.union([
        z.object({ type: z.literal('working') }),
        z.object({ type: z.literal('branch') }),
        z.object({ type: z.literal('commit'), hash: z.string() }),
      ]),
    }),
    changesFeatureReadingSchema,
  ),
  gitCommitConventions: io(repoPath, commitConventionsSchema),
  gitGenerateCommitMessage: io(
    commitMessageGenerationInputSchema,
    commitMessageGenerationOutputSchema,
  ),
  gitGenerateCommitGroups: io(
    commitMessageGenerationInputSchema,
    commitGroupGenerationOutputSchema,
  ),
  gitSuggestions: io(repoPath, z.array(gitSuggestionSchema)),
  gitStageAll: io(repoPathObj, z.void()),
  gitUnstageAll: io(repoPathObj, z.void()),
  gitStageFile: io(repoPathAndPath, z.void()),
  gitUnstageFile: io(repoPathAndPath, z.void()),
  gitDiscardFile: io(repoPathAndPath, z.void()),
  gitCommit: io(z.object({ repoPath: z.string(), message: z.string() }), z.void()),
  gitPush: io(repoPathObj, z.string()),
  gitQuickCommand: io(
    z.object({
      repoPath: z.string(),
      command: z.string(),
      pullMode: z.enum(['merge', 'rebase']).optional(),
    }),
    z.string(),
  ),
  markReviewed: io(repoPathAndPath, z.void()),
  unmarkReviewed: io(repoPathAndPath, z.void()),
  setReviewed: io(z.object({ repoPath: z.string(), paths: z.array(z.string()) }), z.void()),

  readDir: io(
    z.object({ repoPath: z.string(), path: z.string(), showHidden: z.boolean() }),
    z.array(dirEntrySchema),
  ),
  pinnedEntries: io(repoPath, z.array(dirEntrySchema)),
  searchFiles: io(
    z.object({ repoPath: z.string(), query: z.string() }),
    z.array(searchResultSchema),
  ),
  readFile: io(z.string(), fileViewSchema),
  hidePath: io(repoPathAndPath, z.void()),
  unhidePath: io(repoPathAndPath, z.void()),
  pinPath: io(repoPathAndPath, z.void()),
  unpinPath: io(repoPathAndPath, z.void()),

  featureView: io(repoPath, featureViewObjectSchema.nullable()),
  featureReading: io(repoPath, z.unknown()), // full Review document; refined further later
  loopEvidence: io(repoPath, evidenceMetaSchema.nullable()),
  loopEvidenceHtml: io(repoPath, evidenceSchema.nullable()),
  reviewIntent: io(repoPath, z.array(reviewDocSchema)),
  // Wire history: the name predates the sub-tabs and now means "the Results
  // document set". Renaming it would break every installed client for nothing.
  reviewEvidenceDocs: io(repoPath, z.array(reviewDocSchema)),
  reviewEvidenceAssets: io(repoPath, z.array(evidenceAssetSchema)),
  reviewEvidenceAsset: io(
    z.object({ repoPath: z.string(), file: z.string() }),
    evidenceAssetBodySchema.nullable(),
  ),
  reviewComments: io(repoPath, z.array(reviewCommentSchema)),
  addReviewComment: io(
    z.object({
      repoPath: z.string(),
      path: z.string(),
      body: z.string(),
      startLine: z.number().optional(),
      endLine: z.number().optional(),
      anchorText: z.string().optional(),
    }),
    reviewCommentSchema,
  ),
  editReviewComment: io(
    z.object({ repoPath: z.string(), id: z.string(), body: z.string() }),
    z.void(),
  ),
  deleteReviewComment: io(z.object({ repoPath: z.string(), id: z.string() }), z.void()),
  boardCards: io(repoPath, z.array(boardCardSchema)),
  addBoardCard: io(
    z.object({
      repoPath: z.string(),
      title: z.string(),
      body: z.string().optional(),
      status: z.enum(['todo', 'doing', 'done']).optional(),
    }),
    boardCardSchema,
  ),
  updateBoardCard: io(
    z.object({
      repoPath: z.string(),
      id: z.string(),
      title: z.string().optional(),
      body: z.string().optional(),
    }),
    z.void(),
  ),
  moveBoardCard: io(
    z.object({
      repoPath: z.string(),
      id: z.string(),
      status: z.enum(['todo', 'doing', 'done']),
    }),
    z.void(),
  ),
  deleteBoardCard: io(z.object({ repoPath: z.string(), id: z.string() }), z.void()),
  clearBoardCards: io(
    z.object({ repoPath: z.string(), status: z.enum(['todo', 'doing', 'done']) }),
    z.void(),
  ),

  terminalSessions: io(z.void(), z.array(terminalInfoSchema)),
  renameTerminal: io(z.object({ id: z.string(), name: z.string() }), z.void()),
  actions: io(repoPath, z.array(actionSchema)),

  gitBranches: io(repoPath, z.array(branchRefSchema)),
  gitWorktrees: io(repoPath, z.array(worktreeSchema)),
  gitCheckout: io(z.object({ repoPath: z.string(), branch: z.string() }), z.void()),
}
