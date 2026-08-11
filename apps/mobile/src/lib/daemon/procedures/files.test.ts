import { describe, expect, expectTypeOf, it } from 'vitest'
import type { DaemonMutation } from '../procedure'
import { writeTextFileMutation } from './files'

describe('mobile files procedure descriptors', () => {
  it('writeTextFileMutation uses { projectPath, path, content } without inventing a hook', () => {
    expect(writeTextFileMutation.name).toBe('writeTextFile')

    // Extract the phantom input generic from the real descriptor — not a local WriteInput that
    // would stay green if the descriptor regressed to an unrelated shape.
    type WriteInput =
      typeof writeTextFileMutation extends DaemonMutation<infer I, unknown> ? I : never
    expectTypeOf<WriteInput>().toEqualTypeOf<{
      projectPath: string
      path: string
      content: string
    }>()

    const input = {
      projectPath: '/synthetic/repo',
      path: 'docs/notes.txt',
      content: 'line one\n',
    } satisfies WriteInput
    expect(Object.keys(input).sort()).toEqual(['content', 'path', 'projectPath'])
    expect(input).toEqual({
      projectPath: '/synthetic/repo',
      path: 'docs/notes.txt',
      content: 'line one\n',
    })
  })
})
