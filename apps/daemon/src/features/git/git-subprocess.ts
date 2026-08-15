import { execFile } from 'node:child_process'
import { mkdir, realpath } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { promisify } from 'node:util'
import type { Worktree } from '@porcelain/contracts/git'
import { gitEnv } from '../../git/git-env'
import type { GitWorkspaceError, GitWorkspacePort, GitWorkspaceResult } from './git-ports'

const execFileAsync = promisify(execFile)
const MAX_BUFFER = 64 * 1024 * 1024

export type GitExecuteOptions = Readonly<{
  cwd: string
  env: Record<string, string>
  maxBuffer: number
}>

export type GitExecute = (args: readonly string[], options: GitExecuteOptions) => Promise<string>

export type GitSubprocessHost = Readonly<{
  execute?: GitExecute
  mkdir?: (path: string) => Promise<void>
  realpath?: (path: string) => Promise<string>
  sourceEnv?: NodeJS.ProcessEnv
}>

type GitAction = 'checkout' | 'add-worktree' | 'remove-worktree'

const defaultExecute: GitExecute = async (args, options) => {
  const { stdout } = await execFileAsync('git', [...args], options)
  return stdout
}

async function defaultMkdir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

function nativeOutput(error: unknown): string {
  if (error !== null && typeof error === 'object') {
    const parts: string[] = []
    if ('stderr' in error && typeof error.stderr === 'string') parts.push(error.stderr)
    if ('stdout' in error && typeof error.stdout === 'string') parts.push(error.stdout)
    if (parts.length > 0) return parts.join('\n')
  }
  return String(error)
}

function classifyNativeFailure(action: GitAction, error: unknown): GitWorkspaceError | undefined {
  const output = nativeOutput(error).toLowerCase()

  if (output.includes('not a git repository')) {
    return { code: 'git.not-a-repository' }
  }
  if (action === 'checkout' && output.includes('did not match any file')) {
    return { code: 'git.branch-not-found' }
  }
  if (
    action === 'add-worktree' &&
    output.includes('a branch named') &&
    output.includes('already exists')
  ) {
    return { code: 'git.branch-already-exists' }
  }
  if (
    action === 'add-worktree' &&
    (output.includes('already checked out') || output.includes('already exists'))
  ) {
    return { code: 'git.worktree-conflict' }
  }
  if (action === 'checkout' && output.includes('would be overwritten by checkout')) {
    return { code: 'git.working-tree-conflict' }
  }
  if (
    action === 'remove-worktree' &&
    (output.includes('is not a working tree') || output.includes('is not a worktree'))
  ) {
    return { code: 'git.worktree-conflict' }
  }
  return undefined
}

function failed<T>(action: GitAction, error: unknown): GitWorkspaceResult<T> | undefined {
  const normalized = classifyNativeFailure(action, error)
  return normalized === undefined ? undefined : { ok: false, error: normalized }
}

function commandOptions(repoPath: string, sourceEnv: NodeJS.ProcessEnv): GitExecuteOptions {
  return {
    cwd: repoPath,
    env: gitEnv(sourceEnv, { GIT_OPTIONAL_LOCKS: '0' }),
    maxBuffer: MAX_BUFFER,
  }
}

export function createGitSubprocess(host: GitSubprocessHost = {}): GitWorkspacePort {
  const execute = host.execute ?? defaultExecute
  const makeDirectory = host.mkdir ?? defaultMkdir
  const resolveRealpath = host.realpath ?? realpath
  const sourceEnv = host.sourceEnv ?? process.env

  async function checkout(repoPath: string, branch: string): Promise<GitWorkspaceResult<void>> {
    try {
      await execute(['checkout', branch], commandOptions(repoPath, sourceEnv))
      return { ok: true, value: undefined }
    } catch (error) {
      const result = failed<void>('checkout', error)
      if (result !== undefined) return result
      throw error
    }
  }

  async function addWorktree(
    repoPath: string,
    branch: string,
    baseRef?: string,
  ): Promise<GitWorkspaceResult<Worktree>> {
    const sanitizedBranch = branch.replace(/[/\\:<>"|?*]+/g, '-')
    const parent = join(dirname(repoPath), `${basename(repoPath)}-worktrees`)
    const directory = join(parent, sanitizedBranch)
    await makeDirectory(parent)

    try {
      const args = ['worktree', 'add', '-b', branch, directory]
      if (baseRef !== undefined) args.push(baseRef)
      await execute(args, commandOptions(repoPath, sourceEnv))
    } catch (error) {
      const result = failed<Worktree>('add-worktree', error)
      if (result !== undefined) return result
      throw error
    }

    return {
      ok: true,
      value: {
        path: await resolveRealpath(directory),
        branch,
      },
    }
  }

  async function removeWorktree(
    repoPath: string,
    worktreePath: string,
  ): Promise<GitWorkspaceResult<void>> {
    try {
      await execute(
        ['worktree', 'remove', '--force', worktreePath],
        commandOptions(repoPath, sourceEnv),
      )
      return { ok: true, value: undefined }
    } catch (error) {
      const result = failed<void>('remove-worktree', error)
      if (result !== undefined) return result
      throw error
    }
  }

  return Object.freeze({ checkout, addWorktree, removeWorktree })
}
