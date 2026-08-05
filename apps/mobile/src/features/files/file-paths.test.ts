import { describe, expect, it } from 'vitest'

import {
  absolutePath,
  breadcrumbs,
  parentPath,
  pathFromSegments,
  pathSegments,
  pathTestId,
  REPO_ROOT,
  relativePath,
} from './file-paths'

const REPO = '/home/dev/porcelain'

describe('absolutePath', () => {
  it('joins a repo-relative path onto the repo', () => {
    expect(absolutePath(REPO, 'apps/mobile/src')).toBe('/home/dev/porcelain/apps/mobile/src')
  })

  it('maps the root to the repo itself, without a trailing slash', () => {
    expect(absolutePath(REPO, REPO_ROOT)).toBe(REPO)
  })
})

describe('relativePath', () => {
  it('strips the repo prefix', () => {
    expect(relativePath(REPO, '/home/dev/porcelain/apps/web')).toBe('apps/web')
  })

  it('maps the repo itself to the root', () => {
    expect(relativePath(REPO, REPO)).toBe(REPO_ROOT)
  })

  it('refuses a path outside the repo rather than inventing one inside it', () => {
    expect(relativePath(REPO, '/etc/passwd')).toBeNull()
  })

  it('refuses a sibling directory that merely shares the prefix', () => {
    // Without the separator check, `…/porcelain-dev` would read as `-dev` inside the repo.
    expect(relativePath(REPO, '/home/dev/porcelain-dev/config.json')).toBeNull()
  })
})

describe('parentPath', () => {
  it('drops the last segment', () => {
    expect(parentPath('apps/mobile/src')).toBe('apps/mobile')
  })

  it('returns the root for a top-level entry', () => {
    expect(parentPath('apps')).toBe(REPO_ROOT)
  })

  it('leaves the root at the root', () => {
    expect(parentPath(REPO_ROOT)).toBe(REPO_ROOT)
  })
})

describe('breadcrumbs', () => {
  it('starts at the repo and names every level', () => {
    expect(breadcrumbs('porcelain', 'apps/mobile/src')).toEqual([
      { label: 'porcelain', path: '' },
      { label: 'apps', path: 'apps' },
      { label: 'mobile', path: 'apps/mobile' },
      { label: 'src', path: 'apps/mobile/src' },
    ])
  })

  it('is just the repo at the root', () => {
    expect(breadcrumbs('porcelain', REPO_ROOT)).toEqual([{ label: 'porcelain', path: '' }])
  })
})

describe('route segments', () => {
  it('round-trips a nested path', () => {
    const path = 'apps/mobile/src/features/files/file-paths.ts'
    expect(pathFromSegments(pathSegments(path))).toBe(path)
  })

  it('gives the root no segments at all, so it pushes no route', () => {
    expect(pathSegments(REPO_ROOT)).toEqual([])
  })

  it('reads a missing param as the root', () => {
    expect(pathFromSegments(undefined)).toBe(REPO_ROOT)
  })

  it('accepts the single-segment form the router hands back for a one-level path', () => {
    expect(pathFromSegments('README.md')).toBe('README.md')
  })
})

describe('pathTestId', () => {
  it('slugs separators and dots so the id survives the Android view tree', () => {
    expect(pathTestId('porcelain-files-entry', 'apps/mobile/src/app.tsx')).toBe(
      'porcelain-files-entry-apps-mobile-src-app-tsx',
    )
  })

  it('is stable and distinct per path', () => {
    expect(pathTestId('p', 'a/b.ts')).not.toBe(pathTestId('p', 'a/c.ts'))
  })

  it('names the root rather than emitting a dangling prefix', () => {
    expect(pathTestId('porcelain-files-rows', REPO_ROOT)).toBe('porcelain-files-rows-root')
  })
})
