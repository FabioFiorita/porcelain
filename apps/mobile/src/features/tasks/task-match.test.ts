import type { TaskRow } from '@porcelain/client-runtime/tasks'
import { taskFixture } from '@porcelain/contracts/tasks'
import { describe, expect, it } from 'vitest'

import { formatWhen, projectNamesFrom, taskMatchesQuery } from './task-match'

const PROJECT_ID = 'project-synthetic'

const row: TaskRow = {
  task: taskFixture({
    title: 'Rehearse the release',
    tags: ['release'],
    references: { projectId: PROJECT_ID },
    links: [{ url: 'https://example.invalid/run/1', label: 'Failing run' }],
  }),
  environmentId: 'env-studio',
  environmentName: 'Studio',
}

const NAMES = { [PROJECT_ID]: 'porcelain' }

describe('mobile Tasks matching', () => {
  it('matches everything on an empty query', () => {
    expect(taskMatchesQuery(row, '   ', NAMES)).toBe(true)
  })

  it('reaches the fields a person is thinking of, including the Environment label', () => {
    expect(taskMatchesQuery(row, 'rehearse', NAMES)).toBe(true)
    expect(taskMatchesQuery(row, 'T-1', NAMES)).toBe(true)
    expect(taskMatchesQuery(row, 'release', NAMES)).toBe(true)
    expect(taskMatchesQuery(row, 'porcelain', NAMES)).toBe(true)
    expect(taskMatchesQuery(row, 'studio', NAMES)).toBe(true)
    expect(taskMatchesQuery(row, 'failing run', NAMES)).toBe(true)
    // Web spells the statuses out so "in progress" finds a doing Task.
    expect(
      taskMatchesQuery({ ...row, task: taskFixture({ status: 'doing' }) }, 'in progress', {}),
    ).toBe(true)
    expect(taskMatchesQuery(row, 'nowhere', NAMES)).toBe(false)
  })

  it('requires every token, not any of them', () => {
    expect(taskMatchesQuery(row, 'rehearse release', NAMES)).toBe(true)
    expect(taskMatchesQuery(row, 'rehearse nowhere', NAMES)).toBe(false)
  })

  it('names Projects from the reachable inventories only', () => {
    expect(
      projectNamesFrom([
        {
          environment: { id: 'env-studio' } as never,
          inventory: {
            environment: { id: 'env-studio' },
            projects: [{ id: PROJECT_ID, name: 'porcelain' }],
          } as never,
        },
      ]),
    ).toEqual({ [PROJECT_ID]: 'porcelain' })
    expect(projectNamesFrom([])).toEqual({})
  })

  it('prints an unparseable timestamp rather than Invalid Date', () => {
    expect(formatWhen('not-a-date')).toBe('not-a-date')
    expect(formatWhen('2026-01-02T00:00:00.000Z')).not.toBe('2026-01-02T00:00:00.000Z')
  })
})
