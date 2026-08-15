import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HIDDEN_TASK_COLUMN_IDS,
  resolveHiddenTaskColumns,
  resolveTaskColumnOrder,
  TASK_COLUMN_IDS,
  TASK_COLUMN_LABELS,
  TASK_REQUIRED_COLUMN_IDS,
} from './tasks-columns'

describe('the Tasks column vocabulary', () => {
  it('labels every id and requires the Title column', () => {
    expect(Object.keys(TASK_COLUMN_LABELS).sort()).toEqual([...TASK_COLUMN_IDS].sort())
    expect(TASK_REQUIRED_COLUMN_IDS).toEqual(['title'])
  })

  it('keeps both defaults inside the vocabulary', () => {
    expect(TASK_COLUMN_IDS.every((id) => TASK_COLUMN_IDS.includes(id))).toBe(true)
    expect([...TASK_COLUMN_IDS].sort()).toEqual([...TASK_COLUMN_IDS].sort())
    expect(DEFAULT_HIDDEN_TASK_COLUMN_IDS.every((id) => TASK_COLUMN_IDS.includes(id))).toBe(true)
    expect(DEFAULT_HIDDEN_TASK_COLUMN_IDS.some((id) => TASK_REQUIRED_COLUMN_IDS.includes(id))).toBe(
      false,
    )
  })
})

describe('resolveTaskColumnOrder', () => {
  it('keeps a persisted order the current build still recognises', () => {
    expect(
      resolveTaskColumnOrder([
        'title',
        'status',
        'tags',
        'project',
        'environment',
        'worktree',
        'updated',
      ]),
    ).toEqual(['title', 'status', 'tags', 'project', 'environment', 'worktree', 'updated'])
  })

  it('drops ids this build no longer has', () => {
    const resolved = resolveTaskColumnOrder(['title', 'assignee', 'status', ''])
    expect(resolved).not.toContain('assignee')
    expect(resolved.every((id) => TASK_COLUMN_IDS.includes(id))).toBe(true)
    expect(resolved.slice(0, 2)).toEqual(['title', 'status'])
  })

  it('appends a newly added column instead of hiding it after an upgrade', () => {
    // A preference persisted before `worktree` and `updated` existed.
    const resolved = resolveTaskColumnOrder(['title', 'status', 'tags', 'project', 'environment'])
    expect(resolved).toEqual([
      'title',
      'status',
      'tags',
      'project',
      'environment',
      'worktree',
      'updated',
    ])
    expect([...resolved].sort()).toEqual([...TASK_COLUMN_IDS].sort())
  })

  it('never loses or duplicates a column, whatever was persisted', () => {
    for (const persisted of [[], ['worktree'], ['gone', 'title', 'title'], [...TASK_COLUMN_IDS]]) {
      const resolved = resolveTaskColumnOrder(persisted)
      expect(new Set(resolved).size).toBe(resolved.length)
      expect([...new Set(resolved)].sort()).toEqual([...TASK_COLUMN_IDS].sort())
    }
  })
})

describe('resolveHiddenTaskColumns', () => {
  it('can never hide a required column', () => {
    expect(resolveHiddenTaskColumns(['title'])).toEqual([])
    expect(resolveHiddenTaskColumns([...TASK_COLUMN_IDS])).not.toContain('title')
    expect(resolveHiddenTaskColumns(['title', 'tags'])).toEqual(['tags'])
  })

  it('drops unknown ids and duplicates', () => {
    expect(resolveHiddenTaskColumns(['assignee', 'tags', 'tags', ''])).toEqual(['tags'])
  })

  it('resolves to a subset of the optional vocabulary', () => {
    const resolved = resolveHiddenTaskColumns([...TASK_COLUMN_IDS, 'assignee'])
    expect(resolved.every((id) => TASK_COLUMN_IDS.includes(id))).toBe(true)
    expect([...resolved].sort()).toEqual(
      TASK_COLUMN_IDS.filter((id) => !TASK_REQUIRED_COLUMN_IDS.includes(id))
        .slice()
        .sort(),
    )
  })
})
