import { z } from 'zod'

export const COMPANION_DISPOSITION_VALUES = ['shared', 'local'] as const
export const companionDispositionSchema = z.enum(COMPANION_DISPOSITION_VALUES)
export type CompanionDispositionValue = z.infer<typeof companionDispositionSchema>

/**
 * One companion channel as the daemon reports it. `key` is open: the channel catalog grows,
 * and a closed enum here would reject a newer daemon's channel instead of rendering it.
 * `trackedPaths` is what git tracks for the channel right now, empty when git carries nothing.
 */
export const channelDispositionSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    hint: z.string(),
    disposition: companionDispositionSchema,
    trackedPaths: z.array(z.string()),
  })
  .strict()
export type ChannelDispositionValue = z.infer<typeof channelDispositionSchema>

export const companionDispositionsInputSchema = z.string()
export const companionDispositionsOutputSchema = z.array(channelDispositionSchema)
export type CompanionDispositionsInput = z.infer<typeof companionDispositionsInputSchema>
export type CompanionDispositionsOutput = z.infer<typeof companionDispositionsOutputSchema>

export const companionGitVisibilityInputSchema = z.string()
export const companionGitVisibilityOutputSchema = z.object({ hidden: z.boolean() }).strict()
export type CompanionGitVisibilityInput = z.infer<typeof companionGitVisibilityInputSchema>
export type CompanionGitVisibilityOutput = z.infer<typeof companionGitVisibilityOutputSchema>

export const setCompanionGitVisibilityInputSchema = z
  .object({
    repoPath: z.string(),
    hidden: z.boolean(),
  })
  .strict()
/** `changed` is false when the exclude file already said what the caller asked for. */
export const setCompanionGitVisibilityOutputSchema = z.object({ changed: z.boolean() }).strict()
export type SetCompanionGitVisibilityInput = z.infer<typeof setCompanionGitVisibilityInputSchema>
export type SetCompanionGitVisibilityOutput = z.infer<typeof setCompanionGitVisibilityOutputSchema>

export const setCompanionDispositionInputSchema = z
  .object({
    repoPath: z.string(),
    key: z.string().min(1),
    disposition: companionDispositionSchema,
  })
  .strict()
/**
 * Going Local untracks paths git already carried; going Shared can instead lift the blanket
 * exclude. Both results are reported so the renderer can tell the human what git will show.
 */
export const setCompanionDispositionOutputSchema = z
  .object({
    untracked: z.array(z.string()),
    revealed: z.boolean(),
  })
  .strict()
export type SetCompanionDispositionInput = z.infer<typeof setCompanionDispositionInputSchema>
export type SetCompanionDispositionOutput = z.infer<typeof setCompanionDispositionOutputSchema>

/**
 * The one-time companion migration (#27). One report shape for both entry points —
 * `porcelain migrate apply` and this procedure — so a human reading the CLI output
 * and a client rendering the wire value are looking at the same record.
 */
export const migrationOutcomeSchema = z.enum([
  'converted',
  'already-migrated',
  'unsupported',
  'failed',
])
export type MigrationOutcomeValue = z.infer<typeof migrationOutcomeSchema>

export const migrationItemKindSchema = z.enum(['review', 'task', 'action', 'overrides', 'retired'])

export const migrationItemSchema = z
  .object({
    kind: migrationItemKindSchema,
    /** The legacy source, repo-relative — `.porcelain/board.json#<cardId>`. */
    source: z.string().min(1),
    outcome: migrationOutcomeSchema,
    /** Why it was skipped, retired, or failed. Present whenever there is a reason. */
    detail: z.string().optional(),
    /** The id minted in the new owner (Canvas id, Task id, Action id). */
    createdId: z.string().optional(),
  })
  .strict()
export type MigrationItemValue = z.infer<typeof migrationItemSchema>

export const migrateCompanionOutputSchema = z
  .object({
    projectId: z.string().min(1),
    repoPath: z.string().min(1),
    /** True when nothing was written — the plan, produced by the same code path. */
    dryRun: z.boolean(),
    ranAt: z.string().min(1),
    items: z.array(migrationItemSchema),
    counts: z
      .object({
        converted: z.int().nonnegative(),
        alreadyMigrated: z.int().nonnegative(),
        unsupported: z.int().nonnegative(),
        failed: z.int().nonnegative(),
      })
      .strict(),
  })
  .strict()
export type MigrationReportValue = z.infer<typeof migrateCompanionOutputSchema>

/**
 * Migration takes an EXPLICIT Project id and checkout path. There is no "the
 * current repo" default: the daemon serves several Projects at once and a
 * migration that guessed its target could write one repository's Board into
 * another Project's Tasks table.
 */
export const migrateCompanionInputSchema = z
  .object({
    projectId: z.string().min(1),
    path: z.string().min(1),
    dryRun: z.boolean().optional(),
  })
  .strict()
export type MigrateCompanionInput = z.infer<typeof migrateCompanionInputSchema>
export type MigrateCompanionOutput = z.infer<typeof migrateCompanionOutputSchema>

export { projectDataContractFixtures } from './project-data.fixtures'
