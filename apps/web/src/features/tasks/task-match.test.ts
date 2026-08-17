import { taskFixture } from '@porcelain/contracts/tasks'
import { describe, expect, it } from 'vitest'
import { taskMatchesQuery } from './task-match'

const row = {
  environmentId: null,
  environmentName: 'local',
  task: taskFixture({
    shortId: 'T-2',
    title: 'Fix the flaky worktree probe',
    notes: 'Look at the trace',
    tags: ['git', 'flaky'],
    references: { projectId: 'project-synthetic' },
    pathRefs: [
      {
        projectId: 'project-synthetic',
        worktreeId: 'worktree-synthetic',
        path: 'src/probe.ts',
        kind: 'file',
      },
    ],
  }),
}

describe('taskMatchesQuery', () => {
  it('matches title, tag, path, notes, short id, and project name', () => {
    expect(taskMatchesQuery(row, 'flaky', { 'project-synthetic': 'alpha' })).toBe(true)
    expect(taskMatchesQuery(row, 'probe.ts', { 'project-synthetic': 'alpha' })).toBe(true)
    expect(taskMatchesQuery(row, 'T-2', { 'project-synthetic': 'alpha' })).toBe(true)
    expect(taskMatchesQuery(row, 'alpha', { 'project-synthetic': 'alpha' })).toBe(true)
    expect(taskMatchesQuery(row, 'trace', { 'project-synthetic': 'alpha' })).toBe(true)
    expect(taskMatchesQuery(row, 'nope', { 'project-synthetic': 'alpha' })).toBe(false)
  })
})
