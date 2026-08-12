import { procedureCatalog } from '@porcelain/contracts'
import { publicProcedure, t } from '../../trpc'
import type { ProjectDataOperations } from './project-data-operations'

export function createProjectDataRouter(operations: ProjectDataOperations) {
  return t.router({
    repoNotes: publicProcedure
      .input(procedureCatalog.repoNotes.input)
      .output(procedureCatalog.repoNotes.output)
      .query(({ input }) => operations.repoNotes(input)),

    setRepoNotes: publicProcedure
      .input(procedureCatalog.setRepoNotes.input)
      .output(procedureCatalog.setRepoNotes.output)
      .mutation(({ input }) => operations.setRepoNotes(input)),

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

    setCompanionDisposition: publicProcedure
      .input(procedureCatalog.setCompanionDisposition.input)
      .output(procedureCatalog.setCompanionDisposition.output)
      .mutation(({ input }) => operations.setCompanionDisposition(input)),
  })
}
