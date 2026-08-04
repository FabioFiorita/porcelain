import { commitModelOptionsSchema } from '@porcelain/contracts'
import { z } from 'zod'

import { defineMutation, defineQuery } from '../procedure'

const layerSchema = z.object({
  label: z.string(),
  pattern: z.string(),
})

const repoLayersSchema = z.object({
  layers: z.array(layerSchema),
  custom: z.boolean(),
})

export type Layer = z.infer<typeof layerSchema>
export type RepoLayers = z.infer<typeof repoLayersSchema>
export type CommitModelOption = z.infer<typeof commitModelOptionsSchema>[number]

/** Providers installed on the host daemon — empty when none are configured. */
export const commitModelsQuery = defineQuery<void, CommitModelOption[]>(
  'commitModels',
  commitModelOptionsSchema,
)

/** Agent-managed path groups for this repository (Docs + Agents starters when unset). */
export const repoLayersQuery = defineQuery<string, RepoLayers>('repoLayers', repoLayersSchema)

/** `null` layers clears the override back to the Docs + Agents starters. */
export const setRepoLayersMutation = defineMutation<
  { repoPath: string; layers: Layer[] | null },
  void
>('setRepoLayers', z.void())
