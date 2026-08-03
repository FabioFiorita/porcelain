import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROJECT_GITIGNORE,
  PROJECT_FILES,
  PROJECT_PORCELAIN_DIR,
  projectArchivedReviewDir,
  projectEvidenceDir,
  projectPorcelainDir,
  projectPorcelainPath,
  projectReviewsDir,
} from './project-porcelain'

describe('project-porcelain paths', () => {
  it('roots companion data under <repo>/.porcelain', () => {
    expect(projectPorcelainDir('/repo')).toBe(join('/repo', PROJECT_PORCELAIN_DIR))
    expect(projectPorcelainPath('/repo', PROJECT_FILES.board)).toBe(
      join('/repo', PROJECT_PORCELAIN_DIR, 'board.json'),
    )
  })

  it('nests evidence and archived reviews under the project dir', () => {
    expect(projectEvidenceDir('/repo')).toBe(join('/repo', '.porcelain', 'evidence'))
    expect(projectReviewsDir('/repo')).toBe(join('/repo', '.porcelain', 'reviews'))
    expect(projectArchivedReviewDir('/repo', 'abc')).toBe(
      join('/repo', '.porcelain', 'reviews', 'abc'),
    )
  })

  it('ships a default gitignore that ignores evidence trees', () => {
    expect(DEFAULT_PROJECT_GITIGNORE).toContain('evidence/')
    expect(DEFAULT_PROJECT_GITIGNORE).toContain('reviews/*/evidence/')
  })
})
