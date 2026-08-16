import { procedureCatalog } from '@porcelain/contracts'
import { publicProcedure, t } from '../../trpc'
import type { ProjectDataOperations } from './project-data-operations'

export function createProjectDataRouter(operations: ProjectDataOperations) {
  return t.router({
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
