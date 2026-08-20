import { createHubWorktreeInputSchema } from '@porcelain/contracts/projects'
import { describe, expect, it } from 'vitest'

import {
  type NewWorktreeDraft,
  newWorktreeRequest,
  newWorktreeTarget,
  showsEnvironmentPicker,
} from './new-worktree-form'

const DRAFT: NewWorktreeDraft = {
  baseRef: '',
  branch: 'work/topic',
  environmentId: 'env-1',
  projectId: 'proj-alpha',
}

describe('showsEnvironmentPicker', () => {
  it('hides the picker until a second Environment is paired', () => {
    expect(showsEnvironmentPicker(0)).toBe(false)
    expect(showsEnvironmentPicker(1)).toBe(false)
    expect(showsEnvironmentPicker(2)).toBe(true)
  })
})

describe('newWorktreeTarget', () => {
  it('targets the sole paired Environment without asking', () => {
    expect(newWorktreeTarget(['env-1'], undefined)).toBe('env-1')
  })

  it('leaves the target unchosen while several are paired', () => {
    expect(newWorktreeTarget(['env-1', 'env-2'], undefined)).toBeUndefined()
    expect(newWorktreeTarget(['env-1', 'env-2'], 'env-2')).toBe('env-2')
  })

  it('has no target when nothing is paired', () => {
    expect(newWorktreeTarget([], undefined)).toBeUndefined()
  })
})

describe('newWorktreeRequest', () => {
  it('refuses a draft with no Environment chosen', () => {
    const result = newWorktreeRequest({ ...DRAFT, environmentId: undefined })
    expect(result).toEqual({
      message: 'Choose the Environment this Worktree belongs to.',
      ok: false,
    })
  })

  it('refuses a draft with no Project chosen', () => {
    const result = newWorktreeRequest({ ...DRAFT, projectId: null })
    expect(result).toEqual({ message: 'Choose the Project this Worktree belongs to.', ok: false })
  })

  it('refuses a blank branch name', () => {
    const result = newWorktreeRequest({ ...DRAFT, branch: '   ' })
    expect(result).toEqual({ message: 'A Worktree needs a branch name.', ok: false })
  })

  it('sends only projectId and the trimmed branch when From is left empty', () => {
    const result = newWorktreeRequest({ ...DRAFT, branch: '  work/topic  ' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.input).sort()).toEqual(['branch', 'projectId'])
    expect(result.input).toEqual({ branch: 'work/topic', projectId: 'proj-alpha' })
    expect(result.environmentId).toBe('env-1')
    // The contract is `.strict()`, so parsing is proof the wire shape is accepted as built.
    expect(createHubWorktreeInputSchema.parse(result.input)).toEqual(result.input)
  })

  it('adds the trimmed baseRef when From is filled in, and never `existing`', () => {
    const result = newWorktreeRequest({ ...DRAFT, baseRef: '  origin/main ' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.input).toEqual({
      baseRef: 'origin/main',
      branch: 'work/topic',
      projectId: 'proj-alpha',
    })
    expect('existing' in result.input).toBe(false)
    expect(createHubWorktreeInputSchema.parse(result.input)).toEqual(result.input)
  })
})
