import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { updateConfig } from './config-store'
import { withRecentRepo } from './repo-config'

export function devRepoPath(source: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  return source.PORCELAIN_DEV_PLAYGROUND ?? join(home, 'code', 'porcelain-playground')
}

/**
 * First run of `pnpm dev` starts with an empty dev config; seed it with the
 * playground repo so dev sessions never open the user's real work repos.
 */
export async function seedDevConfig(): Promise<void> {
  const devRepo = devRepoPath()
  try {
    await stat(devRepo)
  } catch {
    return
  }
  await updateConfig((config) =>
    config.recentRepos.length > 0 ? config : withRecentRepo(config, devRepo),
  )
}
