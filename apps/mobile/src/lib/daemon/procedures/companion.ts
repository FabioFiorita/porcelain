import { z } from 'zod'

import { defineMutation, defineQuery } from '../procedure'

/**
 * Settings › Data — what git carries for this repo. Same four procedures the web
 * client calls; the disposition is derived daemon-side from `.porcelain/.gitignore`,
 * so there is no mobile-only state to keep in sync.
 */
const channelDispositionSchema = z.object({
  key: z.string(),
  label: z.string(),
  hint: z.string(),
  disposition: z.union([z.literal('shared'), z.literal('local')]),
  /** Repo-relative paths git tracks for this channel right now. */
  trackedPaths: z.array(z.string()),
})

export type ChannelDisposition = z.infer<typeof channelDispositionSchema>

export const companionDispositionsQuery = defineQuery<string, ChannelDisposition[]>(
  'companionDispositions',
  z.array(channelDispositionSchema),
)

/** Whether git can see `.porcelain/` in this clone at all. */
export const companionGitVisibilityQuery = defineQuery<string, { hidden: boolean }>(
  'companionGitVisibility',
  z.object({ hidden: z.boolean() }),
)

export const setCompanionGitVisibilityMutation = defineMutation<
  { repoPath: string; hidden: boolean },
  { changed: boolean }
>('setCompanionGitVisibility', z.object({ changed: z.boolean() }))

/**
 * Going Local also untracks — `untracked` is the staged deletion the human still
 * has to commit. Going Shared can lift the clone-wide exclude (`revealed`).
 */
export const setCompanionDispositionMutation = defineMutation<
  { repoPath: string; key: string; disposition: 'shared' | 'local' },
  { untracked: string[]; revealed: boolean }
>('setCompanionDisposition', z.object({ untracked: z.array(z.string()), revealed: z.boolean() }))
