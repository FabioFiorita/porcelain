import { procedureCatalog } from '@porcelain/contracts'
import {
  type ChannelDisposition,
  readChannelDispositions,
  readCompanionGitVisibility,
  type SetDispositionResult,
  setChannelDisposition,
} from '../project/companion-disposition'
import { hideCompanion, unhideCompanion } from '../project/git-exclude'
import { DEFAULT_LAYERS, type Layer } from '../review/flow'
import { readLayers, writeLayers } from '../stores/layers-store'
import { readNotes, writeNotes } from '../stores/notes-store'
import { type RepoScope, readRepoScope } from '../stores/scope-store'
import { publicProcedure, t } from '../trpc'

export function createSettingsRouter() {
  return t.router({
    repoLayers: publicProcedure
      .input(procedureCatalog.repoLayers.input)
      .output(procedureCatalog.repoLayers.output)
      .query(async ({ input }): Promise<{ layers: Layer[]; custom: boolean }> => {
        const stored = await readLayers(input)
        return { layers: stored ?? DEFAULT_LAYERS, custom: stored !== null }
      }),

    // null layers clear the override back to the Docs + Agents starters
    setRepoLayers: publicProcedure
      .input(procedureCatalog.setRepoLayers.input)
      .output(procedureCatalog.setRepoLayers.output)
      .mutation(async ({ input }) => {
        await writeLayers(input.repoPath, input.layers)
      }),

    /** Monorepo hide/pin lists for this repo (empty arrays when never configured). */
    repoScope: publicProcedure
      .input(procedureCatalog.repoScope.input)
      .output(procedureCatalog.repoScope.output)
      .query(async ({ input }): Promise<RepoScope> => {
        return readRepoScope(input)
      }),

    repoNotes: publicProcedure
      .input(procedureCatalog.repoNotes.input)
      .output(procedureCatalog.repoNotes.output)
      .query(({ input }): Promise<string> => readNotes(input)),

    setRepoNotes: publicProcedure
      .input(procedureCatalog.setRepoNotes.input)
      .output(procedureCatalog.setRepoNotes.output)
      .mutation(async ({ input }) => {
        await writeNotes(input.repoPath, input.notes)
      }),

    /**
     * Shared vs Local per companion channel. Not two storage locations — the data
     * lives in `<repo>/.porcelain/` either way, and this only decides whether git
     * carries it. See `project/companion-disposition.ts` for why.
     */
    companionDispositions: publicProcedure
      .input(procedureCatalog.companionDispositions.input)
      .output(procedureCatalog.companionDispositions.output)
      .query(({ input }): Promise<ChannelDisposition[]> => readChannelDispositions(input)),

    /**
     * Is git blind to `.porcelain/` in this clone? Opening a repo must not change
     * its `git status`, so the companion is excluded via `$GIT_COMMON_DIR/info/exclude`
     * until the human shares something. See `project/git-exclude.ts`.
     */
    companionGitVisibility: publicProcedure
      .input(procedureCatalog.companionGitVisibility.input)
      .output(procedureCatalog.companionGitVisibility.output)
      .query(({ input }): Promise<{ hidden: boolean }> => readCompanionGitVisibility(input)),

    setCompanionGitVisibility: publicProcedure
      .input(procedureCatalog.setCompanionGitVisibility.input)
      .output(procedureCatalog.setCompanionGitVisibility.output)
      .mutation(async ({ input }): Promise<{ changed: boolean }> => {
        const changed = input.hidden
          ? await hideCompanion(input.repoPath)
          : await unhideCompanion(input.repoPath)
        return { changed }
      }),

    setCompanionDisposition: publicProcedure
      .input(procedureCatalog.setCompanionDisposition.input)
      .output(procedureCatalog.setCompanionDisposition.output)
      .mutation(
        ({ input }): Promise<SetDispositionResult> =>
          setChannelDisposition(input.repoPath, input.key, input.disposition),
      ),
  })
}
