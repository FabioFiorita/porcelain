import { readFile, writeFile } from 'node:fs/promises'
import {
  DEFAULT_PROJECT_GITIGNORE,
  PROJECT_FILES,
  parseDispositions,
  projectPorcelainPath,
  renderGitignore,
} from '@shared/project-porcelain'

const MANIFEST_IGNORE_LINE = '/project-manifest.json'

function hasManifestIgnoreLine(text: string): boolean {
  return text.split('\n').some((line) => line.trim() === MANIFEST_IGNORE_LINE)
}

export async function applyCompanionPolicy(repoPath: string): Promise<void> {
  const gitignorePath = projectPorcelainPath(repoPath, PROJECT_FILES.gitignore)
  let current: string
  try {
    current = await readFile(gitignorePath, 'utf8')
  } catch {
    await writeFile(gitignorePath, DEFAULT_PROJECT_GITIGNORE)
    return
  }
  if (hasManifestIgnoreLine(current)) return
  await writeFile(gitignorePath, renderGitignore(current, parseDispositions(current)))
}
