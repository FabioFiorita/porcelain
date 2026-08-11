import { z } from 'zod'

/**
 * Git change notifications — the Git half of the current coarse `working-tree` app event
 * (the deleted horizontal session protocol), which today makes both open documents and every Git surface
 * (status, flow, diffs, log, reviewed marks) stale through one undifferentiated signal.
 *
 * One category is deliberate: Git staleness is answered by refetching the Git queries the
 * client actually has open, so splitting status from diff from history would add wire
 * vocabulary without changing what any consumer does. Strict, and scoped by `projectPath`
 * because a Git working tree only means something inside one project.
 */

export const GIT_CHANGE_KINDS = ['git.working-tree-changed'] as const

export const gitWorkingTreeChangedSchema = z
  .object({
    kind: z.literal('git.working-tree-changed'),
    projectPath: z.string().min(1),
  })
  .strict()
export type GitWorkingTreeChanged = z.infer<typeof gitWorkingTreeChangedSchema>

export const gitChangeSchema = z.discriminatedUnion('kind', [gitWorkingTreeChangedSchema])
export type GitChange = z.infer<typeof gitChangeSchema>

/** Representative Git change values used by boundary tests and client mocks. */
export const gitNotificationFixtures = {
  'git.working-tree-changed': {
    kind: 'git.working-tree-changed',
    projectPath: '/synthetic/repo',
  },
} as const
