import { procedureCatalog } from '@porcelain/contracts'
import { expectedFailure } from '../../daemon-composition/expected-failure'
import { toTrpcError } from '../../daemon-composition/public-error'
import { publicProcedure, t } from '../../trpc'
import type { ProjectDataOperations } from './project-data-operations'

export function createProjectDataRouter(operations: ProjectDataOperations) {
  return t.router({
    repoLayers: publicProcedure
      .input(procedureCatalog.repoLayers.input)
      .output(procedureCatalog.repoLayers.output)
      .query(({ input }) => operations.repoLayers(input)),

    setRepoLayers: publicProcedure
      .input(procedureCatalog.setRepoLayers.input)
      .output(procedureCatalog.setRepoLayers.output)
      .mutation(({ input }) => operations.setRepoLayers(input)),

    companionDispositions: publicProcedure
      .input(procedureCatalog.companionDispositions.input)
      .output(procedureCatalog.companionDispositions.output)
      .query(({ input }) => operations.companionDispositions(input)),

    companionGitVisibility: publicProcedure
      .input(procedureCatalog.companionGitVisibility.input)
      .output(procedureCatalog.companionGitVisibility.output)
      .query(({ input }) => operations.companionGitVisibility(input)),

    setCompanionGitVisibility: publicProcedure
      .input(procedureCatalog.setCompanionGitVisibility.input)
      .output(procedureCatalog.setCompanionGitVisibility.output)
      .mutation(({ input }) => operations.setCompanionGitVisibility(input)),

    migrateCompanion: publicProcedure
      .input(procedureCatalog.migrateCompanion.input)
      .output(procedureCatalog.migrateCompanion.output)
      .mutation(async ({ input }) => {
        const result = await operations.migrateCompanion(input)
        // An ambiguous or foreign target is refused, never guessed (#18).
        if (!result.ok) throw toTrpcError(expectedFailure('request.invalid'))
        return result.value
      }),

    setCompanionDisposition: publicProcedure
      .input(procedureCatalog.setCompanionDisposition.input)
      .output(procedureCatalog.setCompanionDisposition.output)
      .mutation(({ input }) => operations.setCompanionDisposition(input)),
  })
}
