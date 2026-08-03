import { z } from 'zod'

/** The curated built-in model set exposed by the commit-message settings picker. */
export const COMMIT_MODEL_IDS = [
  'luna',
  'terra',
  'sonnet',
  'opus',
  'haiku',
  'sol',
  'grok-4.5',
] as const

/**
 * OpenCode model ids are discovered from the user's configured providers, so this
 * wire value cannot be a closed enum. The daemon still validates it against the
 * available model inventory before spawning a provider.
 */
export const commitModelSchema = z.string().trim().min(1)
export type CommitModel = z.infer<typeof commitModelSchema>

export const COMMIT_MODEL_OPTIONS = [
  { id: 'luna', label: 'Luna' },
  { id: 'terra', label: 'Terra' },
  { id: 'sonnet', label: 'Sonnet' },
  { id: 'opus', label: 'Opus' },
  { id: 'haiku', label: 'Haiku' },
  { id: 'sol', label: 'Sol' },
  { id: 'grok-4.5', label: 'Grok 4.5' },
] as const satisfies ReadonlyArray<{ id: CommitModel; label: string }>

export const commitModelProviderSchema = z.enum(['claude', 'codex', 'grok', 'opencode'])

export const commitModelOptionSchema = z.object({
  id: commitModelSchema,
  label: z.string().trim().min(1),
  provider: commitModelProviderSchema,
})

export const commitModelOptionsSchema = z.array(commitModelOptionSchema)
export type CommitModelOption = z.infer<typeof commitModelOptionSchema>

export const commitMessageGenerationInputSchema = z.object({
  repoPath: z.string(),
  model: commitModelSchema,
})

export const commitMessageGenerationOutputSchema = z.object({
  message: z.string(),
})

export const commitGroupGenerationGroupSchema = z.object({
  files: z.array(z.string()),
  message: z.string(),
})

export const commitGroupGenerationOutputSchema = z.object({
  groups: z.array(commitGroupGenerationGroupSchema),
})

export type CommitGroupGenerationGroup = z.infer<typeof commitGroupGenerationGroupSchema>
