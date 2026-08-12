import { procedureCatalog } from '@porcelain/contracts'
import { type RepoScope, readRepoScope } from '../stores/scope-store'
import { publicProcedure, t } from '../trpc'

export function createSettingsRouter() {
  return t.router({
    /** Monorepo hide/pin lists for this repo (empty arrays when never configured). */
    repoScope: publicProcedure
      .input(procedureCatalog.repoScope.input)
      .output(procedureCatalog.repoScope.output)
      .query(async ({ input }): Promise<RepoScope> => {
        return readRepoScope(input)
      }),
  })
}
