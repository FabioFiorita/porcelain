import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { branchNeedsPublish } from '@porcelain/contracts/git'
import type { GitSuggestion } from './suggestions'
import { parseSuggestions } from './suggestions'
import { gitEnv } from './git-env'
import { gitErrorOutput, runGit } from './git-exec'
import { gitHead } from './git-refs'

const execFileAsync = promisify(execFile)

/** Contextual quick-command suggestions derived from branch sync + stash state. */
export async function gitSuggestions(repoPath: string): Promise<GitSuggestion[]> {
  const [statusBranch, stashList] = await Promise.all([
    runGit(repoPath, ['status', '--porcelain=v2', '--branch']),
    runGit(repoPath, ['stash', 'list']),
  ])
  return parseSuggestions(statusBranch, stashList)
}

/** The only commands the quick-command buttons may run, keyed by id. */
export const QUICK_COMMANDS: Record<string, { label: string; args: string[] }> = {
  status: { label: 'git status', args: ['status'] },
  pull: { label: 'git pull', args: ['pull'] },
  push: { label: 'git push', args: ['push'] },
  fetch: { label: 'git fetch', args: ['fetch'] },
  stash: { label: 'git stash', args: ['stash'] },
  'stash-pop': { label: 'git stash pop', args: ['stash', 'pop'] },
}

/** How `git pull` reconciles divergent branches (the user's General preference). */
export type PullMode = 'merge' | 'rebase'

/** Resolve a whitelisted quick command's git args, or null for an unknown id.
 *  `pull` is the one parameterized entry: it appends `--rebase`/`--no-rebase`
 *  per `pullMode` so the user's choice wins over their `pull.rebase` gitconfig.
 */
export function quickCommandArgs(id: string, pullMode: PullMode = 'merge'): string[] | null {
  const command = QUICK_COMMANDS[id]
  if (!command) return null
  if (id === 'pull') {
    return [...command.args, pullMode === 'rebase' ? '--rebase' : '--no-rebase']
  }
  return command.args
}

/** Run a whitelisted quick command; returns combined output (git logs progress
 *  to stderr — e.g. push — so both streams matter). Throws output on failure.
 *  `push` routes through `gitPush` so a branch with no same-named upstream
 *  still publishes and wires tracking on first push (the Commands/Suggested
 *  chip is the only push UI). */
export async function gitQuickCommand(
  repoPath: string,
  id: string,
  pullMode?: PullMode,
): Promise<string> {
  if (id === 'push') return gitPush(repoPath)
  const args = quickCommandArgs(id, pullMode)
  if (!args) throw new Error(`unknown quick command: ${id}`)
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd: repoPath,
      maxBuffer: 64 * 1024 * 1024,
      env: gitEnv(process.env),
    })
    return [stderr, stdout]
      .filter((s) => s.trim() !== '')
      .join('\n')
      .trim()
  } catch (error) {
    throw new Error(gitErrorOutput(error))
  }
}

/**
 * Push the current branch. A branch with no same-named upstream (fresh worktree,
 * or a topic branch still tracking `origin/main`) pushes with `-u origin HEAD`
 * so the first push creates the remote and wires tracking; after that a plain
 * `push`. Output merges stderr+stdout like gitQuickCommand — git logs push
 * progress to stderr.
 */
export async function gitPush(repoPath: string): Promise<string> {
  const args = branchNeedsPublish(await gitHead(repoPath))
    ? ['push', '-u', 'origin', 'HEAD']
    : ['push']
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd: repoPath,
      maxBuffer: 64 * 1024 * 1024,
      env: gitEnv(process.env),
    })
    return [stderr, stdout]
      .filter((s) => s.trim() !== '')
      .join('\n')
      .trim()
  } catch (error) {
    throw new Error(gitErrorOutput(error))
  }
}
