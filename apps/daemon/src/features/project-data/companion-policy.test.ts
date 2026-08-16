// @vitest-environment node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import {
  DEFAULT_PROJECT_GITIGNORE,
  PROJECT_FILES,
  parseDispositions,
  projectPorcelainDir,
  projectPorcelainPath,
} from '@shared/project-porcelain'
import { describe, expect, it } from 'vitest'
import { withTemporaryDirectory } from '../../testing/temporary-directory'
import { applyCompanionPolicy } from './companion-policy'

const OLD_DEFAULT_WITHOUT_MANIFEST = `# Porcelain project companion.
# Lines outside the managed block are yours — Porcelain never touches them.

# >>> porcelain:managed — Settings › Data owns these lines
/actions.json
/reviews/*
/active-review.json
/active-review/
/.migrated-from-home
*.tmp
*.corrupt-*
reviews/*/evidence/
# <<< porcelain:managed
`

describe('applyCompanionPolicy', () => {
  it('writes DEFAULT_PROJECT_GITIGNORE when the file is absent', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-policy-absent-', async (repoPath) => {
      await mkdir(projectPorcelainDir(repoPath), { recursive: true })
      await applyCompanionPolicy(repoPath)
      expect(await readFile(gitignorePath(repoPath), 'utf8')).toBe(DEFAULT_PROJECT_GITIGNORE)
    })
  })

  it('keeps actions local and adds /project-manifest.json to the managed block', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-policy-local-', async (repoPath) => {
      await mkdir(projectPorcelainDir(repoPath), { recursive: true })
      await writeFile(gitignorePath(repoPath), OLD_DEFAULT_WITHOUT_MANIFEST, 'utf8')

      await applyCompanionPolicy(repoPath)

      const next = await readFile(gitignorePath(repoPath), 'utf8')
      expect(parseDispositions(next).actions).toBe('local')
      expect(next).toContain('/project-manifest.json')
      expect(next).toContain('/actions.json')
    })
  })

  it('preserves human lines outside the managed block', async () => {
    await withTemporaryDirectory('porcelain-pdt-001-policy-human-', async (repoPath) => {
      await mkdir(projectPorcelainDir(repoPath), { recursive: true })
      const current = `# mine
secrets.json

${OLD_DEFAULT_WITHOUT_MANIFEST}
# trailing note
`
      await writeFile(gitignorePath(repoPath), current, 'utf8')

      await applyCompanionPolicy(repoPath)

      const next = await readFile(gitignorePath(repoPath), 'utf8')
      expect(next).toContain('# mine')
      expect(next).toContain('secrets.json')
      expect(next).toContain('# trailing note')
      expect(next).toContain('/project-manifest.json')
      expect(parseDispositions(next).actions).toBe('local')
    })
  })
})

function gitignorePath(repoPath: string): string {
  return projectPorcelainPath(repoPath, PROJECT_FILES.gitignore)
}
