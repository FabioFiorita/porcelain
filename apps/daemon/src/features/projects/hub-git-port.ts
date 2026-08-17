import { readFile, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { parseWorktrees } from '../../git/diff'
import { runGit } from '../../git/git'
import type { GitWorkspacePort, GitWorkspaceResult } from '../git'
import type { DiscoveredProject, DiscoveredWorktree } from './hub-identity'
import { projectGroupingKey, worktreeDisplayName } from './hub-identity'

export type HubGitError = 'not-a-repository' | 'unavailable'

export type HubGitResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: HubGitError }

export type HubGitPort = Readonly<{
  discoverProject: (path: string) => Promise<HubGitResult<DiscoveredProject>>
  listWorktrees: (commonGitDir: string) => Promise<HubGitResult<readonly DiscoveredWorktree[]>>
  pathExists: (path: string) => Promise<boolean>
  addWorktree: (
    repoPath: string,
    branch: string,
    baseRef?: string,
    existing?: boolean,
  ) => Promise<GitWorkspaceResult<{ path: string; branch: string }>>
  removeWorktree: (repoPath: string, worktreePath: string) => Promise<GitWorkspaceResult<void>>
}>

async function runGitDir(gitDir: string, args: string[]): Promise<string> {
  return runGit(dirname(gitDir), [`--git-dir=${gitDir}`, ...args])
}

async function resolveGitDir(worktreePath: string): Promise<string | null> {
  try {
    const gitPath = join(worktreePath, '.git')
    const info = await stat(gitPath)
    if (info.isDirectory()) return await realpath(gitPath)
    const pointer = (await readFile(gitPath, 'utf8')).trim()
    const gitdir = pointer.replace(/^gitdir:\s*/, '')
    if (gitdir === '' || gitdir === pointer) return null
    const resolved = isAbsolute(gitdir) ? gitdir : resolve(worktreePath, gitdir)
    return await realpath(resolved)
  } catch {
    return null
  }
}

async function resolveCommonGitDir(gitDir: string): Promise<string> {
  try {
    const commondir = (await readFile(join(gitDir, 'commondir'), 'utf8')).trim()
    if (commondir === '') return gitDir
    const common = isAbsolute(commondir) ? commondir : resolve(gitDir, commondir)
    return await realpath(common)
  } catch {
    return gitDir
  }
}

async function originUrl(commonGitDir: string): Promise<string | null> {
  try {
    const url = (await runGitDir(commonGitDir, ['remote', 'get-url', 'origin'])).trim()
    return url === '' ? null : url
  } catch {
    return null
  }
}

async function discoverWorktrees(commonGitDir: string): Promise<DiscoveredWorktree[]> {
  const listed = parseWorktrees(await runGitDir(commonGitDir, ['worktree', 'list', '--porcelain']))
  const worktrees: DiscoveredWorktree[] = []
  for (const entry of listed) {
    const gitDir = await resolveGitDir(entry.path)
    if (gitDir === null) continue
    worktrees.push({
      path: await realpath(entry.path).catch(() => entry.path),
      gitDir,
      branch: entry.branch,
      isPrimary: gitDir === commonGitDir,
    })
  }
  return worktrees
}

export function createHubGitPort(
  workspace: Pick<GitWorkspacePort, 'addWorktree' | 'removeWorktree'>,
): HubGitPort {
  return Object.freeze({
    async discoverProject(path: string): Promise<HubGitResult<DiscoveredProject>> {
      const gitDir = await resolveGitDir(path)
      if (gitDir === null) return { ok: false, error: 'not-a-repository' }
      try {
        const commonGitDir = await resolveCommonGitDir(gitDir)
        const worktrees = await discoverWorktrees(commonGitDir)
        const primary = worktrees.find((worktree) => worktree.isPrimary)
        const name = worktreeDisplayName(primary?.path ?? path)
        return {
          ok: true,
          value: {
            commonGitDir,
            groupingKey: projectGroupingKey({
              originUrl: await originUrl(commonGitDir),
              name,
            }),
            name,
            worktrees,
          },
        }
      } catch {
        return { ok: false, error: 'unavailable' }
      }
    },

    async listWorktrees(
      commonGitDir: string,
    ): Promise<HubGitResult<readonly DiscoveredWorktree[]>> {
      try {
        return { ok: true, value: await discoverWorktrees(commonGitDir) }
      } catch {
        return { ok: false, error: 'unavailable' }
      }
    },

    async pathExists(path: string): Promise<boolean> {
      try {
        await stat(path)
        return true
      } catch {
        return false
      }
    },

    addWorktree(repoPath: string, branch: string, baseRef?: string, existing?: boolean) {
      return workspace.addWorktree(repoPath, branch, baseRef, existing)
    },

    removeWorktree(repoPath: string, worktreePath: string) {
      return workspace.removeWorktree(repoPath, worktreePath)
    },
  })
}
