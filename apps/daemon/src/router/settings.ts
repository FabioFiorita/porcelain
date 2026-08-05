import { z } from 'zod'
import { listCommitModels } from '../git/commit-generation'
import {
  type ChannelDisposition,
  readChannelDispositions,
  type SetDispositionResult,
  setChannelDisposition,
} from '../project/companion-disposition'
import { DEFAULT_LAYERS, type Layer } from '../review/flow'
import { readLayers, writeLayers } from '../stores/layers-store'
import { readNotes, writeNotes } from '../stores/notes-store'
import { type RepoScope, readRepoScope } from '../stores/scope-store'
import { publicProcedure, t } from '../trpc'

function isValidPattern(pattern: string): boolean {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

export const settingsRouter = t.router({
  commitModels: publicProcedure.query(() => listCommitModels()),

  repoLayers: publicProcedure
    .input(z.string())
    .query(async ({ input }): Promise<{ layers: Layer[]; custom: boolean }> => {
      const stored = await readLayers(input)
      return { layers: stored ?? DEFAULT_LAYERS, custom: stored !== null }
    }),

  setRepoLayers: publicProcedure
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
  repoScope: publicProcedure.input(z.string()).query(async ({ input }): Promise<RepoScope> => {
    return readRepoScope(input)
  }),

  repoNotes: publicProcedure
    .input(z.string())
    .query(({ input }): Promise<string> => readNotes(input)),

  setRepoNotes: publicProcedure
    .input(z.object({ repoPath: z.string(), notes: z.string() }))
    .mutation(async ({ input }) => {
      await writeNotes(input.repoPath, input.notes)
    }),

  /**
   * Shared vs Local per companion channel. Not two storage locations — the data
   * lives in `<repo>/.porcelain/` either way, and this only decides whether git
   * carries it. See `project/companion-disposition.ts` for why.
   */
  companionDispositions: publicProcedure
    .input(z.string())
    .query(({ input }): Promise<ChannelDisposition[]> => readChannelDispositions(input)),

  setCompanionDisposition: publicProcedure
    .input(
      z.object({
        repoPath: z.string(),
        key: z.string().min(1),
        disposition: z.enum(['shared', 'local']),
      }),
    )
    .mutation(
      ({ input }): Promise<SetDispositionResult> =>
        setChannelDisposition(input.repoPath, input.key, input.disposition),
    ),
})
