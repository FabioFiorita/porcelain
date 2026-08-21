import { describe, expect, it } from 'vitest'

import { formatWhen, projectNamesFrom } from './task-match'

const PROJECT_ID = 'project-synthetic'

describe('mobile Task row labels', () => {
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
