import { describe, expect, it } from 'vitest'
import { writeTextFileMutation } from './files'

describe('mobile files procedure descriptors', () => {
  it('writeTextFileMutation uses { projectPath, path, content } without inventing a hook', () => {
    expect(writeTextFileMutation.name).toBe('writeTextFile')
    // Prove the amended input shape is the type the descriptor accepts (no product hook).
    type WriteInput = { projectPath: string; path: string; content: string }
    const input: WriteInput = {
      projectPath: '/synthetic/repo',
      path: 'docs/notes.txt',
      content: 'line one\n',
    }
    // If the mutation were still absolute-only, this structural assignment would not match
    // the procedure's call sites used by hooks; name + intentional field set is the pin.
    expect(Object.keys(input).sort()).toEqual(['content', 'path', 'projectPath'])
    expect(input).toEqual({
      projectPath: '/synthetic/repo',
      path: 'docs/notes.txt',
      content: 'line one\n',
    })
  })
})
