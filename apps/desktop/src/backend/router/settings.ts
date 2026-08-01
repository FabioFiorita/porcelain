import { z } from 'zod'
import {
  copyRepoSettings,
  exportRepoSettings,
  type ImportRepoSettingsResult,
  importRepoSettings,
  type RepoSettings,
  repoSettingsSchema,
} from '../repo-settings'
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

  // Explicit seed of per-repo channel settings (actions/notes/board/layers/comments)
  // — used to carry project setup from one environment/path to another. Never
  // silent: the caller supplies source + target; present channels replace on the
  // target.
  exportRepoSettings: publicProcedure
    .input(z.string())
    .query(({ input }): Promise<RepoSettings> => exportRepoSettings(input)),

  importRepoSettings: publicProcedure
    .input(z.object({ repoPath: z.string(), settings: repoSettingsSchema }))
    .mutation(
      ({ input }): Promise<ImportRepoSettingsResult> =>
        importRepoSettings(input.repoPath, input.settings),
    ),

  copyRepoSettings: publicProcedure
    .input(z.object({ fromPath: z.string(), toPath: z.string() }))
    .mutation(
      ({ input }): Promise<ImportRepoSettingsResult> =>
        copyRepoSettings(input.fromPath, input.toPath),
    ),
})
