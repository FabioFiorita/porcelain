import { z } from 'zod'

/** Hub inventory changed on this daemon; clients must refetch instead of reconstructing it. */
export const PROJECTS_CHANGE_KINDS = ['projects.inventory-changed'] as const

export const projectsInventoryChangedSchema = z
  .object({ kind: z.literal('projects.inventory-changed') })
  .strict()

export const projectsChangeSchema = z.discriminatedUnion('kind', [projectsInventoryChangedSchema])
export type ProjectsInventoryChanged = z.infer<typeof projectsInventoryChangedSchema>

/** Representative Projects change values used by boundary tests and client mocks. */
export const projectsNotificationFixtures: {
  'projects.inventory-changed': ProjectsInventoryChanged
} = {
  'projects.inventory-changed': { kind: 'projects.inventory-changed' },
}
