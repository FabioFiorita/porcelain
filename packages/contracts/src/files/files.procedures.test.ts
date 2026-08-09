import { describe, expect, it } from 'vitest'
import { filesContractFixtures, fileViewFixtures } from './files.contract'
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
  writeTextFile: 'mutation',
  createFile: 'mutation',
  createFolder: 'mutation',
  renamePath: 'mutation',
  duplicatePath: 'mutation',
  trashPath: 'mutation',
  repoScope: 'query',
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
  writeTextFile: { path: '/synthetic/repo/notes.txt', content: 42 },
  createFile: { path: 42 },
  createFolder: null,
  renamePath: { from: '/synthetic/repo/old.md' },
  duplicatePath: { path: 42 },
  trashPath: null,
  repoScope: 42,
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
  writeTextFile: null,
  createFile: null,
  createFolder: null,
  renamePath: null,
  duplicatePath: 42,
  trashPath: null,
  repoScope: { hiddenPaths: [42], pinnedPaths: [] },
}

describe('Files procedure contracts', () => {
  it('declares exactly fifteen procedures with their router kinds', () => {
    expect(Object.keys(filesProcedures).sort()).toEqual(Object.keys(expectedKinds).sort())
    for (const [name, kind] of Object.entries(expectedKinds)) {
      expect(filesProcedures[name as keyof typeof filesProcedures].kind).toBe(kind)
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

  it('preserves relative and absolute paths plus empty and multiline text content', () => {
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
    expect(filesProcedures.readFile.input.safeParse('~/synthetic/repo/README.md').success).toBe(
      true,
    )
    expect(filesProcedures.writeTextFile.input.parse({ path: 'notes.txt', content: '' })).toEqual({
      path: 'notes.txt',
      content: '',
    })
    expect(
      filesProcedures.writeTextFile.input.parse({
        path: '/synthetic/repo/notes.txt',
        content: 'line one\nline two\n',
      }),
    ).toEqual({ path: '/synthetic/repo/notes.txt', content: 'line one\nline two\n' })
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
