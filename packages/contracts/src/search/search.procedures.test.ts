import { describe, expect, it } from 'vitest'
import { searchContractFixtures } from './search.contract'
import { searchProcedures } from './search.procedures'

const expectedKinds = {
  searchText: 'query',
  searchCode: 'query',
  searchFiles: 'query',
} as const

const invalidInputs: Record<keyof typeof searchProcedures, unknown> = {
  searchText: { repoPath: '/synthetic/repo', query: '' },
  searchCode: {
    ...searchContractFixtures.searchCode.input,
    regex: 'false',
  },
  searchFiles: { repoPath: '/synthetic/repo', query: 42 },
}

const invalidOutputs: Record<keyof typeof searchProcedures, unknown> = {
  searchText: [{ path: 'src/alpha.ts', line: '3', text: 'const needle = true' }],
  searchCode: {
    files: [
      {
        path: 'src/alpha.ts',
        hunks: [{ lines: [{ line: 2, text: 'const needle = value', match: 'true' }] }],
        matchCount: 1,
      },
    ],
    truncated: false,
  },
  searchFiles: [{ path: 'src', kind: 'folder' }],
}

describe('Search procedure contracts', () => {
  it('declares exactly three procedures, all with query kinds', () => {
    expect(Object.keys(searchProcedures).sort()).toEqual(Object.keys(expectedKinds).sort())
    for (const [name, kind] of Object.entries(expectedKinds)) {
      expect(searchProcedures[name as keyof typeof searchProcedures].kind).toBe(kind)
    }
  })

  for (const name of Object.keys(searchProcedures) as Array<keyof typeof searchProcedures>) {
    it(`accepts valid ${name} input and output fixtures`, () => {
      const fixture = searchContractFixtures[name]
      const procedure = searchProcedures[name]
      expect(procedure.input.safeParse(fixture.input).success).toBe(true)
      expect(procedure.output.safeParse(fixture.output).success).toBe(true)
    })

    it(`rejects invalid ${name} input and output fixtures`, () => {
      const procedure = searchProcedures[name]
      expect(procedure.input.safeParse(invalidInputs[name]).success).toBe(false)
      expect(procedure.output.safeParse(invalidOutputs[name]).success).toBe(false)
    })
  }

  it('preserves empty and nonempty query acceptance and empty-result behavior', () => {
    expect(
      searchProcedures.searchText.input.safeParse({ repoPath: '/synthetic/repo', query: '' })
        .success,
    ).toBe(false)
    expect(
      searchProcedures.searchText.input.safeParse({ repoPath: '/synthetic/repo', query: ' ' })
        .success,
    ).toBe(true)
    expect(
      searchProcedures.searchCode.input.safeParse({
        ...searchContractFixtures.searchCode.input,
        query: '',
      }).success,
    ).toBe(false)
    expect(
      searchProcedures.searchCode.input.safeParse({
        ...searchContractFixtures.searchCode.input,
        query: ' ',
      }).success,
    ).toBe(true)
    expect(
      searchProcedures.searchFiles.input.parse({ repoPath: '/synthetic/repo', query: '' }),
    ).toEqual({ repoPath: '/synthetic/repo', query: '' })
    expect(
      searchProcedures.searchFiles.input.parse({ repoPath: '/synthetic/repo', query: ' ' }),
    ).toEqual({ repoPath: '/synthetic/repo', query: ' ' })
    expect(searchProcedures.searchText.output.parse([])).toEqual([])
    expect(searchProcedures.searchCode.output.parse({ files: [], truncated: false })).toEqual({
      files: [],
      truncated: false,
    })
    expect(searchProcedures.searchFiles.output.parse([])).toEqual([])
  })

  it('preserves regex, case, include, and exclude input values', () => {
    const input = searchProcedures.searchCode.input.parse({
      ...searchContractFixtures.searchCode.input,
      regex: true,
      caseSensitive: true,
      include: '**/*.ts, **/*.tsx',
      exclude: '',
    })
    expect(input).toEqual({
      repoPath: '/synthetic/repo',
      query: 'needle',
      regex: true,
      caseSensitive: true,
      include: '**/*.ts, **/*.tsx',
      exclude: '',
    })
  })

  it('preserves exact serialized result fields and both file/dir kinds', () => {
    expect(
      searchProcedures.searchText.output.parse(searchContractFixtures.searchText.output),
    ).toEqual(searchContractFixtures.searchText.output)
    expect(
      searchProcedures.searchCode.output.parse(searchContractFixtures.searchCode.output),
    ).toEqual(searchContractFixtures.searchCode.output)
    expect(
      searchProcedures.searchFiles.output.parse(searchContractFixtures.searchFiles.output),
    ).toEqual(searchContractFixtures.searchFiles.output)
  })

  it('rejects unknown fields at every strict Search wire boundary', () => {
    expect(
      searchProcedures.searchText.input.safeParse({
        ...searchContractFixtures.searchText.input,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      searchProcedures.searchText.output.safeParse([
        { ...searchContractFixtures.searchText.output[0], extra: true },
      ]).success,
    ).toBe(false)
    expect(
      searchProcedures.searchCode.input.safeParse({
        ...searchContractFixtures.searchCode.input,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      searchProcedures.searchCode.output.safeParse({
        ...searchContractFixtures.searchCode.output,
        files: [
          {
            ...searchContractFixtures.searchCode.output.files[0],
            hunks: [
              {
                ...searchContractFixtures.searchCode.output.files[0].hunks[0],
                lines: [
                  {
                    ...searchContractFixtures.searchCode.output.files[0].hunks[0].lines[0],
                    extra: true,
                  },
                ],
              },
            ],
          },
        ],
      }).success,
    ).toBe(false)
    expect(
      searchProcedures.searchFiles.input.safeParse({
        ...searchContractFixtures.searchFiles.input,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      searchProcedures.searchFiles.output.safeParse([
        { ...searchContractFixtures.searchFiles.output[0], extra: true },
      ]).success,
    ).toBe(false)
  })
})
