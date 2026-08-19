import { describe, expect, it } from 'vitest'
import {
  filesContractFixtures,
  fileViewFixtures,
  isFilesProjectPath,
  isFilesProjectRelativePath,
} from './files.contract'
import { filesProcedures } from './files.procedures'

const expectedKinds = {
  readDir: 'query',
  hidePath: 'mutation',
  unhidePath: 'mutation',
  pinPath: 'mutation',
  unpinPath: 'mutation',
  pinnedEntries: 'query',
  readFile: 'query',
  previewHtml: 'query',
  mintFilePreviewToken: 'mutation',
  writeTextFile: 'mutation',
  createFile: 'mutation',
  createFolder: 'mutation',
  renamePath: 'mutation',
  duplicatePath: 'mutation',
  trashPath: 'mutation',
  repoScope: 'query',
  worktreeProfile: 'query',
} as const

const expectedErrors = {
  readDir: [],
  hidePath: [],
  unhidePath: [],
  pinPath: [],
  unpinPath: [],
  pinnedEntries: [],
  readFile: ['files.path-outside-project'],
  previewHtml: ['files.path-outside-project'],
  mintFilePreviewToken: [],
  writeTextFile: ['files.path-outside-project', 'files.not-found'],
  createFile: ['files.path-outside-project', 'files.already-exists', 'files.not-found'],
  createFolder: ['files.path-outside-project', 'files.already-exists', 'files.not-found'],
  renamePath: ['files.path-outside-project', 'state.conflict', 'files.not-found'],
  duplicatePath: ['files.path-outside-project', 'files.not-found'],
  trashPath: ['files.path-outside-project', 'files.not-found'],
  repoScope: [],
  worktreeProfile: [],
} as const

const invalidInputs: Record<keyof typeof filesProcedures, unknown> = {
  readDir: { repoPath: '/synthetic/repo', path: '/synthetic/repo/src', showHidden: 'false' },
  hidePath: { repoPath: '/synthetic/repo' },
  unhidePath: null,
  pinPath: { repoPath: '/synthetic/repo', path: 42 },
  unpinPath: { repoPath: 42, path: '/synthetic/repo/README.md' },
  pinnedEntries: 42,
  readFile: 42,
  previewHtml: null,
  mintFilePreviewToken: { projectPath: '/synthetic/repo' },
  writeTextFile: { projectPath: '/synthetic/repo', path: 'notes.txt', content: 42 },
  createFile: { path: 42 },
  createFolder: null,
  renamePath: { projectPath: '/synthetic/repo', from: 'docs/old.md' },
  duplicatePath: { path: 42 },
  trashPath: null,
  repoScope: 42,
  worktreeProfile: 42,
}

const invalidOutputs: Record<keyof typeof filesProcedures, unknown> = {
  readDir: [
    {
      name: 'README.md',
      path: '/synthetic/repo/README.md',
      kind: 'file',
      hidden: false,
      pinned: 'true',
    },
  ],
  hidePath: null,
  unhidePath: null,
  pinPath: null,
  unpinPath: null,
  pinnedEntries: [{ name: 'README.md' }],
  readFile: { type: 'text', content: 42 },
  previewHtml: 42,
  mintFilePreviewToken: { token: '' },
  writeTextFile: null,
  createFile: null,
  createFolder: null,
  renamePath: null,
  duplicatePath: 42,
  trashPath: null,
  repoScope: { hiddenPaths: [42], pinnedPaths: [] },
  // A layer with no pattern is the shape an agent is most likely to hand us.
  worktreeProfile: {
    worktreeId: 'wt-synthetic',
    base: { hiddenPaths: [], pinnedPaths: [], layers: [{ label: 'View' }] },
    override: null,
    resolved: { hiddenPaths: [], pinnedPaths: [], layers: [] },
  },
}

describe('Files procedure contracts', () => {
  it('declares exactly seventeen procedures with their router kinds and allowed errors', () => {
    expect(Object.keys(filesProcedures).sort()).toEqual(Object.keys(expectedKinds).sort())
    for (const [name, kind] of Object.entries(expectedKinds)) {
      const procedure = filesProcedures[name as keyof typeof filesProcedures]
      expect(procedure.kind).toBe(kind)
      expect([...procedure.errors]).toEqual([
        ...expectedErrors[name as keyof typeof expectedErrors],
      ])
    }
  })

  for (const name of Object.keys(filesProcedures) as Array<keyof typeof filesProcedures>) {
    it(`accepts valid ${name} input and output fixtures`, () => {
      const fixture = filesContractFixtures[name]
      const procedure = filesProcedures[name]
      expect(procedure.input.safeParse(fixture.input).success).toBe(true)
      expect(procedure.output.safeParse(fixture.output).success).toBe(true)
    })

    it(`rejects invalid ${name} input and output fixtures`, () => {
      const procedure = filesProcedures[name]
      expect(procedure.input.safeParse(invalidInputs[name]).success).toBe(false)
      expect(procedure.output.safeParse(invalidOutputs[name]).success).toBe(false)
    })
  }

  it('accepts every FileView discriminator branch', () => {
    for (const fixture of Object.values(fileViewFixtures)) {
      expect(filesProcedures.readFile.output.safeParse(fixture).success).toBe(true)
    }
  })

  it('rejects non-integer or negative FileView sizes and empty image dataUrls', () => {
    const output = filesProcedures.readFile.output
    expect(output.safeParse({ type: 'binary', size: 1.5 }).success).toBe(false)
    expect(output.safeParse({ type: 'binary', size: -1 }).success).toBe(false)
    expect(output.safeParse({ type: 'too-large', size: 1.5 }).success).toBe(false)
    expect(output.safeParse({ type: 'too-large', size: -1 }).success).toBe(false)
    expect(output.safeParse({ type: 'image', dataUrl: '' }).success).toBe(false)
    expect(output.safeParse({ type: 'binary', size: 0 }).success).toBe(true)
    expect(output.safeParse({ type: 'too-large', size: 0 }).success).toBe(true)
  })

  it('accepts both populated and nullable HTML previews', () => {
    expect(
      filesProcedures.previewHtml.output.safeParse(filesContractFixtures.previewHtml.output)
        .success,
    ).toBe(true)
    expect(filesProcedures.previewHtml.output.safeParse(null).success).toBe(true)
  })

  it('preserves RepoScope defaults and absolute serialized paths', () => {
    const output = filesProcedures.repoScope.output
    expect(output.parse(filesContractFixtures.repoScope.output)).toEqual(
      filesContractFixtures.repoScope.output,
    )
    expect(output.parse({})).toEqual({ hiddenPaths: [], pinnedPaths: [] })
    expect(output.parse({ hiddenPaths: ['/synthetic/repo/src/generated'] })).toEqual({
      hiddenPaths: ['/synthetic/repo/src/generated'],
      pinnedPaths: [],
    })
  })

  it('accepts POSIX-absolute projectPath including / and rejects relative projectPath', () => {
    for (const value of ['/', '/repo', '/repo/', '/var/tmp/playground', '/synthetic/repo']) {
      expect(isFilesProjectPath(value)).toBe(true)
      expect(
        filesProcedures.readFile.input.safeParse({ projectPath: value, path: 'a.txt' }).success,
      ).toBe(true)
    }
    for (const value of ['', 'repo', './repo', '~/repo', 'C:/repo', '\\\\server\\share', 'a\0b']) {
      expect(isFilesProjectPath(value)).toBe(false)
    }
    expect(
      filesProcedures.readFile.input.safeParse({ projectPath: 'relative/repo', path: 'a.txt' })
        .success,
    ).toBe(false)
  })

  it('accepts project-relative targets including ..foo and rejects traversal forms', () => {
    const accepted = [
      'README.md',
      'src/main.ts',
      'docs/a b.md',
      '.gitignore',
      '.porcelain/board.json',
      '..foo',
      '..config',
      'dir/..foo/bar',
    ]
    for (const path of accepted) {
      expect(isFilesProjectRelativePath(path)).toBe(true)
      expect(
        filesProcedures.readFile.input.safeParse({ projectPath: '/synthetic/repo', path }).success,
      ).toBe(true)
    }

    const rejected = [
      '',
      '.',
      '..',
      'foo/../bar',
      'foo/./bar',
      '/etc/passwd',
      'foo//bar',
      'foo/',
      'foo\\bar',
      'C:/foo',
      'a\0b',
    ]
    for (const path of rejected) {
      expect(isFilesProjectRelativePath(path)).toBe(false)
    }
  })

  it('rejects bare host paths and absolute-only legacy wire for the eight host-fs procedures', () => {
    expect(filesProcedures.readFile.input.safeParse('/synthetic/repo/README.md').success).toBe(
      false,
    )
    expect(
      filesProcedures.previewHtml.input.safeParse('/synthetic/repo/docs/index.html').success,
    ).toBe(false)
    expect(filesProcedures.trashPath.input.safeParse('/synthetic/repo/docs/old.md').success).toBe(
      false,
    )
    expect(
      filesProcedures.writeTextFile.input.safeParse({
        path: 'docs/notes.txt',
        content: 'x',
      }).success,
    ).toBe(false)
    expect(
      filesProcedures.createFile.input.safeParse({ path: '/synthetic/repo/docs/empty.txt' })
        .success,
    ).toBe(false)
  })

  it('preserves relative hide/pin paths and empty/multiline write content under projectPath', () => {
    expect(
      filesProcedures.hidePath.input.safeParse({
        repoPath: '/synthetic/repo',
        path: 'src/generated',
      }).success,
    ).toBe(true)
    expect(
      filesProcedures.hidePath.input.safeParse({
        repoPath: '/synthetic/repo',
        path: '/synthetic/repo/src/generated',
      }).success,
    ).toBe(true)
    expect(
      filesProcedures.writeTextFile.input.parse({
        projectPath: '/synthetic/repo',
        path: 'notes.txt',
        content: '',
      }),
    ).toEqual({ projectPath: '/synthetic/repo', path: 'notes.txt', content: '' })
    expect(
      filesProcedures.writeTextFile.input.parse({
        projectPath: '/synthetic/repo',
        path: 'docs/notes.txt',
        content: 'line one\nline two\n',
      }),
    ).toEqual({
      projectPath: '/synthetic/repo',
      path: 'docs/notes.txt',
      content: 'line one\nline two\n',
    })
  })

  it('rejects unknown fields at the strict Files wire boundary', () => {
    expect(
      filesProcedures.readDir.input.safeParse({
        ...filesContractFixtures.readDir.input,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      filesProcedures.readDir.output.safeParse([
        {
          ...filesContractFixtures.readDir.output[0],
          extra: true,
        },
      ]).success,
    ).toBe(false)
    expect(
      filesProcedures.readFile.output.safeParse({
        ...fileViewFixtures.text,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      filesProcedures.writeTextFile.input.safeParse({
        ...filesContractFixtures.writeTextFile.input,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      filesProcedures.repoScope.output.safeParse({
        ...filesContractFixtures.repoScope.output,
        extra: true,
      }).success,
    ).toBe(false)
  })
})
