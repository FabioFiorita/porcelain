import { describe, expect, it } from 'vitest'

import {
  absoluteRepoPath,
  basename,
  entryHref,
  fileSize,
  hrefForAbsolutePath,
  parentRelativePath,
  repoRelativePath,
  routeSegments,
} from './file-paths'

describe('file paths', () => {
  const repo = '/home/you/code/project'

  it('converts daemon paths to and from repo-relative paths', () => {
    expect(repoRelativePath(repo, '/home/you/code/project/src/app.ts')).toBe('src/app.ts')
    expect(repoRelativePath(repo, '/home/you/code/project')).toBe('')
    expect(repoRelativePath(repo, '/home/you/code/other.ts')).toBeNull()
    expect(absoluteRepoPath(repo, ['src', 'app.ts'])).toBe('/home/you/code/project/src/app.ts')
    expect(absoluteRepoPath(repo, ['..', 'secret.txt'])).toBe(repo)
  })

  it('builds encoded catch-all routes', () => {
    expect(entryHref('file', 'src/My file.ts')).toBe('/(tabs)/(files)/file/src/My%20file.ts')
    expect(hrefForAbsolutePath(repo, '/home/you/code/project/docs/read me.md', 'file')).toBe(
      '/(tabs)/(files)/file/docs/read%20me.md',
    )
    expect(routeSegments(['docs', 'read%20me.md'])).toEqual(['docs', 'read me.md'])
  })

  it('formats path labels and file sizes', () => {
    expect(basename('/home/you/code/project/src/app.ts')).toBe('app.ts')
    expect(parentRelativePath('src/app.ts')).toBe('src')
    expect(parentRelativePath('README.md')).toBe('')
    expect(fileSize(900)).toBe('900 B')
    expect(fileSize(1024 * 1024)).toBe('1.0 MB')
  })
})
