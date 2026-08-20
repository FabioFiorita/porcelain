import { taskFixture } from '@porcelain/contracts/tasks'
import { describe, expect, it } from 'vitest'
import { taskMatchesQuery } from './task-match'
import type { TaskRow } from './tasks-rows'

const PROJECT_ID = 'project-synthetic'
const NAMES = { [PROJECT_ID]: 'alpha' }

const row: TaskRow = {
  environmentId: null,
  environmentName: 'local',
  task: taskFixture({
    shortId: 'T-2',
    title: 'Fix the flaky worktree probe',
    notes: 'Look at the trace',
    tags: ['git', 'flaky'],
    references: { projectId: PROJECT_ID },
    pathRefs: [
      {
        projectId: PROJECT_ID,
        worktreeId: 'worktree-synthetic',
        path: 'src/probe.ts',
        kind: 'file',
      },
    ],
    links: [{ url: 'https://example.invalid/run/1', label: 'Failing run' }],
  }),
}

describe('taskMatchesQuery', () => {
  it('matches everything on an empty query', () => {
    expect(taskMatchesQuery(row, '   ', NAMES)).toBe(true)
  })

  it('matches title, tag, path, notes, short id, link, and project name', () => {
    expect(taskMatchesQuery(row, 'flaky', NAMES)).toBe(true)
    expect(taskMatchesQuery(row, 'probe.ts', NAMES)).toBe(true)
    expect(taskMatchesQuery(row, 'T-2', NAMES)).toBe(true)
    expect(taskMatchesQuery(row, 'alpha', NAMES)).toBe(true)
    expect(taskMatchesQuery(row, 'trace', NAMES)).toBe(true)
    expect(taskMatchesQuery(row, 'failing run', NAMES)).toBe(true)
    expect(taskMatchesQuery(row, 'nope', NAMES)).toBe(false)
  })

  it('spells the statuses out, so "in progress" finds a doing Task', () => {
    expect(
      taskMatchesQuery({ ...row, task: taskFixture({ status: 'doing' }) }, 'in progress', {}),
    ).toBe(true)
  })

  it('requires every token, not any of them', () => {
    expect(taskMatchesQuery(row, 'flaky probe.ts', NAMES)).toBe(true)
    expect(taskMatchesQuery(row, 'flaky nowhere', NAMES)).toBe(false)
  })

  it('searches what a caller adds, and only when it adds it', () => {
    // The phone passes its Environment label here; the Viewer passes nothing.
    expect(taskMatchesQuery(row, 'studio', NAMES)).toBe(false)
    expect(taskMatchesQuery(row, 'studio', NAMES, ['studio'])).toBe(true)
    // An added field is one more haystack entry, not an escape from the every-token rule.
    expect(taskMatchesQuery(row, 'studio flaky', NAMES, ['studio'])).toBe(true)
    expect(taskMatchesQuery(row, 'studio nowhere', NAMES, ['studio'])).toBe(false)
  })
})
