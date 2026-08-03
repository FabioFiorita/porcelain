import { randomUUID } from 'node:crypto'
import { PROJECT_FILES } from '@shared/project-porcelain'
import { z } from 'zod'
import { createProjectChannel } from '../net/project-channel'
import { ensureProjectCompanion } from '../project/migrate-home'

/**
 * Saved actions for a project — named shell commands the human runs in the
 * embedded terminal. Lives in `<repo>/.porcelain/actions.json` (array, not
 * path-keyed). TWO-WAY: app + porcelain CLI. Git-shareable when tracked.
 *
 * SECURITY: `command` is executed only when the human clicks Run — never by the
 * agent. Full text is shown before run (audit skill).
 */
const actionWhereSchema = z.enum(['primary', 'local'])
export type ActionWhere = z.infer<typeof actionWhereSchema>

export const actionSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    command: z.string(),
    where: actionWhereSchema.optional(),
    order: z.number().default(0),
    createdAt: z.number().default(0),
  })
  .strict()
export type Action = z.infer<typeof actionSchema>

const actionsSchema = z.array(actionSchema)

const channel = createProjectChannel({
  fileName: PROJECT_FILES.actions,
  schema: actionsSchema,
  empty: (): Action[] => [],
})

export function actionsPath(repoPath: string): string {
  return channel.path(repoPath)
}

async function ready(repoPath: string): Promise<void> {
  await ensureProjectCompanion(repoPath)
}

/** The actions for a repo, sorted by creation order (oldest first). */
export async function readActions(repoPath: string): Promise<Action[]> {
  await ready(repoPath)
  const actions = await channel.read(repoPath)
  return [...actions].sort((a, b) => a.order - b.order)
}

export interface NewAction {
  title: string
  command: string
  where?: ActionWhere
}

export async function addAction(repoPath: string, input: NewAction): Promise<Action> {
  await ready(repoPath)
  const now = Date.now()
  const action: Action = {
    id: randomUUID(),
    title: input.title,
    command: input.command,
    order: now,
    createdAt: now,
    ...(input.where !== undefined && input.where !== 'primary' ? { where: input.where } : {}),
  }
  await channel.mutate(repoPath, (all) => [...all, action])
  return action
}

export async function updateAction(
  repoPath: string,
  id: string,
  fields: { title?: string; command?: string; where?: ActionWhere },
): Promise<void> {
  await ready(repoPath)
  await channel.mutate(repoPath, (all) => {
    const action = all.find((a) => a.id === id)
    if (!action) return all
    if (fields.title !== undefined) action.title = fields.title
    if (fields.command !== undefined) action.command = fields.command
    if (fields.where !== undefined) {
      if (fields.where === 'primary') delete action.where
      else action.where = fields.where
    }
    return all
  })
}

export async function moveAction(
  repoPath: string,
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  await ready(repoPath)
  await channel.mutate(repoPath, (all) => {
    const sorted = [...all].sort((a, b) => a.order - b.order)
    const index = sorted.findIndex((a) => a.id === id)
    if (index === -1) return all
    const target = index + (direction === 'up' ? -1 : 1)
    if (target < 0 || target >= sorted.length) return all
    const current = sorted[index]
    const neighbour = sorted[target]
    if (!current || !neighbour) return all
    const tmp = current.order
    current.order = neighbour.order
    neighbour.order = tmp
    return sorted
  })
}

export async function deleteAction(repoPath: string, id: string): Promise<void> {
  await ready(repoPath)
  await channel.mutate(repoPath, (all) => all.filter((a) => a.id !== id))
}

/** Whole-set replace (tests / rare bulk). Empty writes []. */
export async function writeActions(repoPath: string, actions: Action[]): Promise<void> {
  await ready(repoPath)
  await channel.write(repoPath, actions)
}
