import { describe, expect, it } from 'vitest'
import {
  ACTION_MOVE_DIRECTIONS,
  ACTION_WHERE_VALUES,
  actionSchema,
  actionsContractFixtures,
  actionViewSchema,
} from './actions.contract'
import { actionsProcedures } from './actions.procedures'

const expectedKinds = {
  actions: 'query',
  trustActions: 'mutation',
  addAction: 'mutation',
  updateAction: 'mutation',
  moveAction: 'mutation',
  deleteAction: 'mutation',
} as const

const invalidInputs = {
  actions: 42,
  trustActions: { repoPath: '/synthetic/repo', ids: [] },
  addAction: { repoPath: '/synthetic/repo', title: ' ', command: 'make build' },
  updateAction: { repoPath: '/synthetic/repo', id: 'action-build', command: '  ' },
  moveAction: { repoPath: '/synthetic/repo', id: 'action-build', direction: 'sideways' },
  deleteAction: { repoPath: '/synthetic/repo' },
} as const

const invalidOutputs = {
  actions: [{ ...actionsContractFixtures.actions.output[0], createdAt: '10' }],
  trustActions: null,
  addAction: { ...actionsContractFixtures.addAction.output, where: 'remote' },
  updateAction: null,
  moveAction: null,
  deleteAction: null,
} as const

describe('Actions procedure contracts', () => {
  it('declares exactly six procedures with their router kinds', () => {
    expect(Object.keys(actionsProcedures).sort()).toEqual(Object.keys(expectedKinds).sort())
    for (const [name, kind] of Object.entries(expectedKinds)) {
      expect(actionsProcedures[name as keyof typeof actionsProcedures].kind).toBe(kind)
    }
  })

  for (const name of Object.keys(actionsProcedures) as Array<keyof typeof actionsProcedures>) {
    it(`accepts valid ${name} input and output fixtures`, () => {
      const fixture = actionsContractFixtures[name]
      const procedure = actionsProcedures[name]
      expect(procedure.input.safeParse(fixture.input).success).toBe(true)
      expect(procedure.output.safeParse(fixture.output).success).toBe(true)
    })

    it(`rejects invalid ${name} input and output fixtures`, () => {
      const procedure = actionsProcedures[name]
      expect(procedure.input.safeParse(invalidInputs[name]).success).toBe(false)
      expect(procedure.output.safeParse(invalidOutputs[name]).success).toBe(false)
    })
  }

  it('accepts every placement and move direction the current router accepts', () => {
    for (const where of ACTION_WHERE_VALUES) {
      expect(
        actionsProcedures.addAction.input.safeParse({
          repoPath: '/synthetic/repo',
          title: 'An action',
          command: 'make check',
          where,
        }).success,
      ).toBe(true)
      expect(
        actionsProcedures.updateAction.input.safeParse({
          repoPath: '/synthetic/repo',
          id: 'action-build',
          where,
        }).success,
      ).toBe(true)
    }
    for (const direction of ACTION_MOVE_DIRECTIONS) {
      expect(
        actionsProcedures.moveAction.input.safeParse({
          repoPath: '/synthetic/repo',
          id: 'action-build',
          direction,
        }).success,
      ).toBe(true)
    }
  })

  it('rejects blank and whitespace-only titles and commands', () => {
    for (const value of ['', '   ']) {
      expect(
        actionsProcedures.addAction.input.safeParse({
          repoPath: '/synthetic/repo',
          title: value,
          command: 'make check',
        }).success,
      ).toBe(false)
      expect(
        actionsProcedures.addAction.input.safeParse({
          repoPath: '/synthetic/repo',
          title: 'An action',
          command: value,
        }).success,
      ).toBe(false)
      expect(
        actionsProcedures.updateAction.input.safeParse({
          repoPath: '/synthetic/repo',
          id: 'action-build',
          title: value,
        }).success,
      ).toBe(false)
      expect(
        actionsProcedures.updateAction.input.safeParse({
          repoPath: '/synthetic/repo',
          id: 'action-build',
          command: value,
        }).success,
      ).toBe(false)
    }
  })

  it('requires at least one trust id but no other trust field', () => {
    expect(
      actionsProcedures.trustActions.input.safeParse({
        repoPath: '/synthetic/repo',
        ids: ['action-build', 'action-serve'],
      }).success,
    ).toBe(true)
    expect(
      actionsProcedures.trustActions.input.safeParse({ repoPath: '/synthetic/repo' }).success,
    ).toBe(false)
    expect(
      actionsProcedures.trustActions.input.safeParse({
        repoPath: '/synthetic/repo',
        ids: ['action-build'],
        commands: ['make build'],
      }).success,
    ).toBe(false)
  })

  it('separates the stored action from the derived trusted view', () => {
    const stored = { id: 'action-build', title: 'Build', command: 'make build' }
    expect(actionSchema.parse(stored)).toEqual({ ...stored, order: 0, createdAt: 0 })
    expect(actionViewSchema.parse(stored)).toEqual({
      ...stored,
      order: 0,
      createdAt: 0,
      trusted: false,
    })
    expect(actionSchema.safeParse({ ...stored, trusted: true }).success).toBe(false)
    expect(
      actionsProcedures.addAction.output.safeParse({ ...stored, trusted: false }).success,
    ).toBe(false)
    expect(actionsProcedures.actions.output.parse([stored])).toEqual([
      { ...stored, order: 0, createdAt: 0, trusted: false },
    ])
  })

  it('preserves the current unbounded path, id, order, and time shapes', () => {
    expect(actionsProcedures.actions.input.safeParse('').success).toBe(true)
    expect(actionsProcedures.deleteAction.input.safeParse({ repoPath: '', id: '' }).success).toBe(
      true,
    )
    expect(
      actionsProcedures.trustActions.input.safeParse({ repoPath: '', ids: [''] }).success,
    ).toBe(true)
    expect(
      actionSchema.safeParse({
        id: '',
        title: '',
        command: '',
        order: -1.5,
        createdAt: 0.5,
      }).success,
    ).toBe(true)
    expect(
      actionsProcedures.updateAction.input.parse({
        repoPath: '/synthetic/repo',
        id: 'action-build',
      }),
    ).toEqual({ repoPath: '/synthetic/repo', id: 'action-build' })
  })

  it('rejects unknown fields at strict input and nested action boundaries', () => {
    expect(
      actionsProcedures.addAction.input.safeParse({
        ...actionsContractFixtures.addAction.input,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      actionsProcedures.updateAction.input.safeParse({
        ...actionsContractFixtures.updateAction.input,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      actionsProcedures.moveAction.input.safeParse({
        ...actionsContractFixtures.moveAction.input,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      actionsProcedures.deleteAction.input.safeParse({
        ...actionsContractFixtures.deleteAction.input,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      actionsProcedures.actions.output.safeParse([
        { ...actionsContractFixtures.actions.output[0], extra: true },
      ]).success,
    ).toBe(false)
    expect(
      actionsProcedures.addAction.output.safeParse({
        ...actionsContractFixtures.addAction.output,
        extra: true,
      }).success,
    ).toBe(false)
  })

  it('keeps void mutation results distinct from action results', () => {
    expect(actionsProcedures.addAction.output.safeParse(undefined).success).toBe(false)
    for (const name of ['trustActions', 'updateAction', 'moveAction', 'deleteAction'] as const) {
      expect(actionsProcedures[name].output.safeParse(undefined).success).toBe(true)
      expect(actionsProcedures[name].output.safeParse(null).success).toBe(false)
    }
  })
})
