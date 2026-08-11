import { describe, expect, it } from 'vitest'
import {
  FILES_CHANGE_KINDS,
  filesChangeSchema,
  filesNotificationFixtures,
  isFilesNotificationPath,
} from './files.notifications'

describe('Files change notifications', () => {
  it('covers exactly the declared change categories', () => {
    expect(filesChangeSchema.options.map((option) => option.shape.kind.value).sort()).toEqual(
      [...FILES_CHANGE_KINDS].sort(),
    )
    expect(Object.keys(filesNotificationFixtures).sort()).toEqual([...FILES_CHANGE_KINDS].sort())
  })

  for (const kind of FILES_CHANGE_KINDS) {
    it(`accepts the ${kind} fixture`, () => {
      expect(filesChangeSchema.parse(filesNotificationFixtures[kind])).toEqual(
        filesNotificationFixtures[kind],
      )
    })

    it(`rejects ${kind} without projectPath`, () => {
      const { projectPath: _dropped, ...withoutProject } = filesNotificationFixtures[kind]
      expect(filesChangeSchema.safeParse(withoutProject).success).toBe(false)
    })

    it(`rejects ${kind} with an empty projectPath`, () => {
      expect(
        filesChangeSchema.safeParse({ ...filesNotificationFixtures[kind], projectPath: '' })
          .success,
      ).toBe(false)
    })

    it(`rejects ${kind} carrying an unknown field`, () => {
      expect(
        filesChangeSchema.safeParse({ ...filesNotificationFixtures[kind], payload: 'entity' })
          .success,
      ).toBe(false)
    })
  }

  it('rejects an unknown change kind', () => {
    expect(
      filesChangeSchema.safeParse({ kind: 'files.changed', projectPath: '/synthetic/repo' })
        .success,
    ).toBe(false)
  })

  for (const kind of ['files.tree-changed', 'files.content-changed'] as const) {
    it(`requires at least one path on ${kind}`, () => {
      const { paths: _dropped, ...withoutPaths } = filesNotificationFixtures[kind]
      expect(filesChangeSchema.safeParse(withoutPaths).success).toBe(false)
      expect(
        filesChangeSchema.safeParse({ ...filesNotificationFixtures[kind], paths: [] }).success,
      ).toBe(false)
      expect(
        filesChangeSchema.safeParse({ ...filesNotificationFixtures[kind], paths: [''] }).success,
      ).toBe(false)
    })

    it(`preserves every path it was given on ${kind}`, () => {
      const paths = ['a.ts', 'nested/b.ts']
      const parsed = filesChangeSchema.parse({ ...filesNotificationFixtures[kind], paths })
      expect(parsed).toHaveProperty('paths', paths)
    })

    it(`accepts '.' as the project-root marker on ${kind}`, () => {
      expect(
        filesChangeSchema.safeParse({ ...filesNotificationFixtures[kind], paths: ['.'] }).success,
      ).toBe(true)
    })

    it(`rejects absolute host paths on ${kind}`, () => {
      expect(
        filesChangeSchema.safeParse({
          ...filesNotificationFixtures[kind],
          paths: ['/synthetic/repo/src'],
        }).success,
      ).toBe(false)
    })

    it(`rejects parent-segment and empty-segment paths on ${kind}`, () => {
      for (const path of ['foo/../bar', 'foo//bar', '..', 'foo/./bar']) {
        expect(
          filesChangeSchema.safeParse({ ...filesNotificationFixtures[kind], paths: [path] })
            .success,
        ).toBe(false)
      }
    })
  }

  it('keeps the scope category free of path detail', () => {
    expect(
      filesChangeSchema.safeParse({
        ...filesNotificationFixtures['files.scope-changed'],
        paths: ['.'],
      }).success,
    ).toBe(false)
  })

  it('accepts project-relative notification paths and the root marker', () => {
    for (const path of ['README.md', 'src/main.ts', '.gitignore', '..foo', '.']) {
      expect(isFilesNotificationPath(path)).toBe(true)
    }
  })

  it('rejects absolute, empty, and traversal notification paths', () => {
    for (const path of ['', '/', '/synthetic/repo/src', 'foo/../bar', 'foo//bar']) {
      expect(isFilesNotificationPath(path)).toBe(false)
    }
  })
})
