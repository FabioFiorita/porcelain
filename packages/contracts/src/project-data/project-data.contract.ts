import { z } from 'zod'

export const COMPANION_DISPOSITION_VALUES = ['shared', 'local'] as const
export const companionDispositionSchema = z.enum(COMPANION_DISPOSITION_VALUES)
export type CompanionDispositionValue = z.infer<typeof companionDispositionSchema>

/**
 * Notes are a single repo-scoped document. A repository without notes reads as the empty
 * string rather than null — the store creates the companion file on read, so the wire never
 * carries an absence the renderer would have to special-case.
 */
export const repoNotesInputSchema = z.string()
export const repoNotesOutputSchema = z.string()
export type RepoNotesInput = z.infer<typeof repoNotesInputSchema>
export type RepoNotesOutput = z.infer<typeof repoNotesOutputSchema>

export const setRepoNotesInputSchema = z
  .object({
    repoPath: z.string(),
    notes: z.string(),
  })
  .strict()
export const setRepoNotesOutputSchema = z.void()
export type SetRepoNotesInput = z.infer<typeof setRepoNotesInputSchema>
export type SetRepoNotesOutput = z.infer<typeof setRepoNotesOutputSchema>

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

export { projectDataContractFixtures } from './project-data.fixtures'
