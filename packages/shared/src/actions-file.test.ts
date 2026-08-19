import { describe, expect, it } from 'vitest'
import {
  ACTION_COMMAND_MAX_LENGTH,
  actionKindOf,
  ACTION_TITLE_MAX_LENGTH,
  ACTIONS_FILE_VERSION,
  ActionsFileParseError,
  emptyActionsFileV1,
  parseActionsFileV1,
  planCreateAction,
  planDeleteAction,
  planMoveAction,
  planUpdateAction,
  serializeActionsFileV1,
  sortActions,
} from './actions-file'

const ID_A = 'action-a'
const ID_B = 'action-b'
const ID_C = 'action-c'

function action(
  overrides: Partial<{
    id: string
    title: string
    command: string
    where: 'primary' | 'local'
    order: number
    createdAt: number
  }> = {},
) {
  return {
    id: overrides.id ?? ID_A,
    title: overrides.title ?? 'Build',
    command: overrides.command ?? 'make build',
    order: overrides.order ?? 10,
    createdAt: overrides.createdAt ?? 10,
    ...(overrides.where === 'local' ? { where: 'local' as const } : {}),
  }
}

describe('parseActionsFileV1 / serializeActionsFileV1', () => {
  it('accepts empty v1 and round-trips', () => {
    const empty = emptyActionsFileV1()
    expect(empty).toEqual({ version: 1, actions: [] })
    expect(parseActionsFileV1(empty)).toEqual(empty)
    expect(serializeActionsFileV1(empty)).toBe(`${JSON.stringify(empty, null, 2)}\n`)
  })

  it('accepts historical non-UUID ids and local where, rejects unknown fields', () => {
    const file = {
      version: ACTIONS_FILE_VERSION,
      actions: [action({ id: 'legacy-id', where: 'local' }), action({ id: ID_B, order: 20 })],
    }
    expect(parseActionsFileV1(file).actions).toHaveLength(2)
    expect(parseActionsFileV1(file).actions[0]?.where).toBe('local')
    expect(() => parseActionsFileV1({ ...file, extra: true })).toThrow(ActionsFileParseError)
    expect(() =>
      parseActionsFileV1({
        version: 1,
        actions: [{ ...action(), extra: true }],
      }),
    ).toThrow(/unknown field/)
  })

  it('omits primary where on parse', () => {
    const parsed = parseActionsFileV1({
      version: 1,
      actions: [{ ...action(), where: 'primary' }],
    })
    expect(parsed.actions[0]?.where).toBeUndefined()
  })

  it('rejects incompatible version, top-level arrays, and malformed shapes', () => {
    expect(() => parseActionsFileV1([])).toThrow(/top-level arrays/)
    expect(() => parseActionsFileV1({ version: 2, actions: [] })).toThrow(
      /unsupported Actions file version/,
    )
    expect(() => parseActionsFileV1({ version: 1 })).toThrow(/actions must be an array/)
    expect(() => parseActionsFileV1({ actions: [] })).toThrow(/version is required/)
  })

  it('rejects duplicate IDs, blank ids, invalid where, and bad numbers', () => {
    expect(() =>
      parseActionsFileV1({
        version: 1,
        actions: [action(), action({ id: ID_A, title: 'dup' })],
      }),
    ).toThrow(/duplicate/)
    expect(() => parseActionsFileV1({ version: 1, actions: [action({ id: '' })] })).toThrow(
      /id is invalid/,
    )
    expect(() =>
      parseActionsFileV1({
        version: 1,
        actions: [{ ...action(), where: 'remote' }],
      }),
    ).toThrow(/where/)
    expect(() =>
      parseActionsFileV1({
        version: 1,
        actions: [{ ...action(), order: -1 }],
      }),
    ).toThrow(/order/)
    expect(() =>
      parseActionsFileV1({
        version: 1,
        actions: [{ ...action(), createdAt: 1.5 }],
      }),
    ).toThrow(/createdAt/)
    expect(() =>
      parseActionsFileV1({
        version: 1,
        actions: [{ ...action(), title: '   ' }],
      }),
    ).toThrow(/title/)
    expect(() =>
      parseActionsFileV1({
        version: 1,
        actions: [{ ...action(), command: 'x'.repeat(ACTION_COMMAND_MAX_LENGTH + 1) }],
      }),
    ).toThrow(/command/)
  })
})

describe('sortActions', () => {
  it('orders by order, then createdAt, then id', () => {
    const sorted = sortActions([
      action({ id: ID_C, order: 1, createdAt: 2 }),
      action({ id: ID_A, order: 1, createdAt: 1 }),
      action({ id: ID_B, order: 0, createdAt: 9 }),
    ])
    expect(sorted.map((a) => a.id)).toEqual([ID_B, ID_A, ID_C])
  })
})

describe('pure action transitions', () => {
  it('creates, updates, moves, and deletes without mutating the input file', () => {
    const base = emptyActionsFileV1()
    const created = planCreateAction(base, {
      id: ID_A,
      title: '  Ship  ',
      command: '  make check  ',
      order: 5,
      createdAt: 5,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(base.actions).toEqual([])
    expect(created.action.title).toBe('Ship')
    expect(created.action.command).toBe('make check')

    const withLocal = planCreateAction(created.file, {
      id: ID_B,
      title: 'Local',
      command: 'echo local',
      where: 'local',
      order: 6,
      createdAt: 6,
    })
    expect(withLocal.ok).toBe(true)
    if (!withLocal.ok) return
    expect(withLocal.action.where).toBe('local')

    const updated = planUpdateAction(withLocal.file, {
      actionId: ID_A,
      title: 'Ship it',
      where: 'local',
    })
    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    expect(updated.action).toMatchObject({ title: 'Ship it', where: 'local' })

    const clearedWhere = planUpdateAction(updated.file, {
      actionId: ID_A,
      where: 'primary',
    })
    expect(clearedWhere.ok).toBe(true)
    if (!clearedWhere.ok) return
    expect(clearedWhere.action.where).toBeUndefined()

    const moved = planMoveAction(clearedWhere.file, { actionId: ID_A, direction: 'down' })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.kind).toBe('move')

    const deleted = planDeleteAction(moved.file, { actionId: ID_B })
    expect(deleted.ok).toBe(true)
    if (!deleted.ok) return
    expect(deleted.file.actions.map((a) => a.id)).toEqual([ID_A])
  })

  it('returns not-found for missing ids and request.invalid for over-length fields', () => {
    const base = emptyActionsFileV1()
    expect(planUpdateAction(base, { actionId: ID_A, title: 'x' })).toEqual({
      ok: false,
      error: { code: 'actions.not-found', actionId: ID_A },
    })
    expect(planDeleteAction(base, { actionId: ID_A })).toEqual({
      ok: false,
      error: { code: 'actions.not-found', actionId: ID_A },
    })
    expect(planMoveAction(base, { actionId: ID_A, direction: 'up' })).toEqual({
      ok: false,
      error: { code: 'actions.not-found', actionId: ID_A },
    })

    expect(
      planCreateAction(base, {
        id: ID_A,
        title: 'x'.repeat(ACTION_TITLE_MAX_LENGTH + 1),
        command: 'make',
        order: 1,
        createdAt: 1,
      }),
    ).toEqual({ ok: false, error: { code: 'request.invalid' } })

    const created = planCreateAction(base, {
      id: ID_A,
      title: 'ok',
      command: 'make',
      order: 1,
      createdAt: 1,
    })
    if (!created.ok) return
    expect(
      planUpdateAction(created.file, {
        actionId: ID_A,
        command: 'x'.repeat(ACTION_COMMAND_MAX_LENGTH + 1),
      }),
    ).toEqual({ ok: false, error: { code: 'request.invalid' } })
  })

  it('treats move at list ends as a no-op result', () => {
    const file = {
      version: 1 as const,
      actions: [action({ id: ID_A, order: 1 }), action({ id: ID_B, order: 2 })],
    }
    const up = planMoveAction(file, { actionId: ID_A, direction: 'up' })
    expect(up.ok).toBe(true)
    if (!up.ok) return
    expect(up.kind).toBe('noop')

    const down = planMoveAction(file, { actionId: ID_B, direction: 'down' })
    expect(down.ok).toBe(true)
    if (!down.ok) return
    expect(down.kind).toBe('noop')
  })

  it('reads a pre-kind document unchanged and never writes the default role back', () => {
    const legacy = {
      version: 1 as const,
      actions: [
        { id: ID_A, title: 'Build', command: 'make build', order: 10, createdAt: 10 },
        {
          id: ID_B,
          title: 'Serve',
          command: 'make serve',
          order: 20,
          createdAt: 20,
          where: 'local',
        },
      ],
    }
    const parsed = parseActionsFileV1(legacy)
    expect(parsed.actions.every((entry) => entry.kind === undefined)).toBe(true)
    expect(parsed.actions.map(actionKindOf)).toEqual(['action', 'action'])
    // Byte-identical round trip: a daemon that only reads must not rewrite older files.
    expect(serializeActionsFileV1(parsed)).toBe(`${JSON.stringify(legacy, null, 2)}\n`)

    const created = planCreateAction(emptyActionsFileV1(), {
      id: ID_C,
      title: 'Install',
      command: 'pnpm install',
      kind: 'action',
      order: 1,
      createdAt: 1,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.action.kind).toBeUndefined()
  })

  it('keeps a worktree role through create, parse, and clone', () => {
    const created = planCreateAction(emptyActionsFileV1(), {
      id: ID_A,
      title: 'Install',
      command: 'pnpm install',
      kind: 'worktree-setup',
      order: 1,
      createdAt: 1,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.action.kind).toBe('worktree-setup')
    expect(parseActionsFileV1(created.file).actions[0]?.kind).toBe('worktree-setup')

    const renamed = planUpdateAction(created.file, { actionId: ID_A, title: 'Bootstrap' })
    expect(renamed.ok).toBe(true)
    if (!renamed.ok) return
    expect(renamed.action.kind).toBe('worktree-setup')

    expect(() =>
      parseActionsFileV1({
        version: 1,
        actions: [
          { id: ID_A, title: 'x', command: 'y', kind: 'worktree-teardown', order: 1, createdAt: 1 },
        ],
      }),
    ).toThrow(ActionsFileParseError)
  })

  it('moves a row among its own kind only', () => {
    // Interleaved on purpose: order alone would make the setup row's neighbour an action.
    const file = {
      version: 1 as const,
      actions: [
        action({ id: ID_A, order: 1 }),
        { ...action({ id: ID_B, order: 2 }), kind: 'worktree-setup' as const },
        action({ id: ID_C, order: 3 }),
        { ...action({ id: 'action-d', order: 4 }), kind: 'worktree-setup' as const },
      ],
    }
    const moved = planMoveAction(file, { actionId: 'action-d', direction: 'up' })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.kind).toBe('move')
    const byId = new Map(moved.file.actions.map((entry) => [entry.id, entry.order]))
    // Swapped with the other setup row; both plain actions keep the order they had.
    expect(byId.get('action-d')).toBe(2)
    expect(byId.get(ID_B)).toBe(4)
    expect(byId.get(ID_A)).toBe(1)
    expect(byId.get(ID_C)).toBe(3)

    // First of its own kind: a no-op that keeps every other row in the document.
    const noop = planMoveAction(file, { actionId: ID_B, direction: 'up' })
    expect(noop.ok).toBe(true)
    if (!noop.ok) return
    expect(noop.kind).toBe('noop')
    expect(noop.file.actions.map((entry) => entry.id).sort()).toEqual(
      [ID_A, ID_B, ID_C, 'action-d'].sort(),
    )
  })
})
