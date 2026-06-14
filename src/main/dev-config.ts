import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { updateConfig } from './config-store'
import { withRecentRepo } from './repo-config'

const DEV_REPO = join(homedir(), 'Code', 'porcelain-playground')

/**
 * First run of `pnpm dev` starts with an empty dev config; seed it with the
 * playground repo so dev sessions never open the user's real work repos.
 */
export async function seedDevConfig(): Promise<void> {
  try {
    await stat(DEV_REPO)
  } catch {
    return
  }
  await updateConfig((config) =>
    config.recentRepos.length > 0 ? config : withRecentRepo(config, DEV_REPO),
  )
}
