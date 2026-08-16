// @vitest-environment node
import { ACTIVE_FILES, PROJECT_FILES, projectPorcelainPath } from '@shared/project-porcelain'
import { describe, expect, it } from 'vitest'
import {
  PROJECT_DATA_DOMAIN_FILES,
  PROJECT_DATA_DOMAIN_KEYS,
  projectDataFilesForDomain,
} from './project-data-ports'

const REPO = '/repo'

describe('project data companion ownership', () => {
  it('lists the ten canonical domain keys in order', () => {
    expect([...PROJECT_DATA_DOMAIN_KEYS]).toEqual([
      'projects',
      'files',
      'git',
      'search',
      'review',
      'actions',
      'terminal',
      'project-data',
      'remote',
    ])
  })

  it('maps exactly one entry per domain key and no extra key', () => {
    expect(Object.keys(PROJECT_DATA_DOMAIN_FILES).sort()).toEqual(
      [...PROJECT_DATA_DOMAIN_KEYS].sort(),
    )
  })

  it('claims each companion file in exactly one domain', () => {
    const claimed = PROJECT_DATA_DOMAIN_KEYS.flatMap((key) => [...PROJECT_DATA_DOMAIN_FILES[key]])
    expect(claimed).toHaveLength(new Set(claimed).size)
  })

  it('claims exactly the known companion file set', () => {
    const claimed = new Set(
      PROJECT_DATA_DOMAIN_KEYS.flatMap((key) => [...PROJECT_DATA_DOMAIN_FILES[key]]),
    )
    expect(claimed).toEqual(
      new Set([
        'actions.json',
        'active-review/comments.json',
        'active-review/reviewed.json',
        'layers.json',
        '.gitignore',
        'project-manifest.json',
      ]),
    )
  })

  it('gives project-data the durable files and no Review, Actions, or Files payload', () => {
    const claimed = PROJECT_DATA_DOMAIN_FILES['project-data']
    expect([...claimed]).toEqual([
      PROJECT_FILES.layers,
      PROJECT_FILES.gitignore,
      PROJECT_FILES.manifest,
    ])
    for (const foreign of [ACTIVE_FILES.comments, ACTIVE_FILES.reviewed, PROJECT_FILES.actions]) {
      expect(claimed).not.toContain(foreign)
    }
  })

  it('claims nothing for projects, git, search, terminal, and remote', () => {
    for (const key of ['projects', 'git', 'search', 'terminal', 'remote'] as const) {
      expect([...PROJECT_DATA_DOMAIN_FILES[key]]).toEqual([])
    }
  })

  it('resolves every claimed file under the repository companion directory', () => {
    for (const key of PROJECT_DATA_DOMAIN_KEYS) {
      const domain = projectDataFilesForDomain(key)
      for (const file of domain.files) {
        const resolved = domain.path(REPO, file)
        expect(resolved).toBe(projectPorcelainPath(REPO, file))
        expect(resolved.startsWith('/repo/.porcelain/')).toBe(true)
      }
    }
  })

  it('refuses a file the named domain does not claim', () => {
    expect(() => projectDataFilesForDomain('review').path(REPO, PROJECT_FILES.layers)).toThrow(
      'project-data: layers.json is not a review companion file',
    )
  })
})
