import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import {
  COMPANION_CHANNELS,
  type CompanionDisposition,
  DEFAULT_PROJECT_GITIGNORE,
  PROJECT_FILES,
  PROJECT_PORCELAIN_DIR,
  parseDispositions,
  projectPorcelainDir,
  projectPorcelainPath,
  renderGitignore,
} from '@shared/project-porcelain'
import { gitTrackedUnder, gitUntrackKeepingFile } from '../git/git'

/**
 * Shared vs Local per companion channel, expressed as `.porcelain/.gitignore`
 * lines rather than a second storage location.
 *
 * The alternative — companion data in `~/.porcelain` shadowed or overridden by
 * an in-repo copy — was rejected on purpose. Two homes means a read path, a
 * write path, and a "which copy wins" branch per channel, and it re-grows the
 * absolute-path keying that broke on every rename, clone, and second machine.
 * One location with two git dispositions has none of that, and it puts the
 * decision somewhere the whole team can already read, edit, and commit.
 */

export interface ChannelDisposition {
  key: string
  label: string
  hint: string
  disposition: CompanionDisposition
  /** Repo-relative paths git tracks for this channel right now. */
  trackedPaths: string[]
}

async function readGitignore(repoPath: string): Promise<string> {
  try {
    return await readFile(projectPorcelainPath(repoPath, PROJECT_FILES.gitignore), 'utf8')
  } catch {
    return DEFAULT_PROJECT_GITIGNORE
  }
}

async function writeGitignore(repoPath: string, text: string): Promise<void> {
  const path = projectPorcelainPath(repoPath, PROJECT_FILES.gitignore)
  await mkdir(projectPorcelainDir(repoPath), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, text)
  await rename(tmp, path)
}

/** Where a channel's patterns live relative to the REPO (git wants those, not companion-relative). */
function repoRelativePaths(channelKey: string): string[] {
  const channel = COMPANION_CHANNELS.find((c) => c.key === channelKey)
  if (!channel) return []
  return channel.patterns.map(
    (p) => `${PROJECT_PORCELAIN_DIR}/${p.replace(/^\//, '').replace(/\/$/, '')}`,
  )
}

export async function readChannelDispositions(repoPath: string): Promise<ChannelDisposition[]> {
  const parsed = parseDispositions(await readGitignore(repoPath))
  return Promise.all(
    COMPANION_CHANNELS.map(async (channel) => {
      const tracked = await Promise.all(
        repoRelativePaths(channel.key).map((p) => gitTrackedUnder(repoPath, p)),
      )
      return {
        key: channel.key,
        label: channel.label,
        hint: channel.hint,
        disposition: parsed[channel.key] ?? channel.defaultDisposition,
        trackedPaths: tracked.flat(),
      }
    }),
  )
}

export interface SetDispositionResult {
  /** Paths git stopped tracking (a staged deletion the human still has to commit). */
  untracked: string[]
}

/**
 * Flip one channel. Going Local also untracks, because `.gitignore` does nothing
 * to an already-tracked file and a toggle that silently changed nothing would be
 * worse than no toggle. Going Shared only removes the ignore line: staging is the
 * human's act (`gitCommit` never auto-stages either).
 */
export async function setChannelDisposition(
  repoPath: string,
  key: string,
  disposition: CompanionDisposition,
): Promise<SetDispositionResult> {
  const current = await readGitignore(repoPath)
  const next = { ...parseDispositions(current), [key]: disposition }
  await writeGitignore(repoPath, renderGitignore(current, next))

  if (disposition !== 'local') return { untracked: [] }
  const untracked: string[] = []
  for (const path of repoRelativePaths(key)) {
    untracked.push(...(await gitUntrackKeepingFile(repoPath, path)))
  }
  return { untracked }
}
