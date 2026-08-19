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
  prepareActionRun: 'mutation',
} as const

const expectedErrors = {
  actions: ['actions.unavailable'],
  trustActions: ['actions.unavailable'],
  addAction: ['actions.unavailable', 'request.invalid'],
  updateAction: ['actions.unavailable', 'actions.not-found', 'request.invalid'],
  moveAction: ['actions.unavailable', 'actions.not-found'],
  deleteAction: ['actions.unavailable', 'actions.not-found'],
  prepareActionRun: [
    'actions.unavailable',
    'actions.not-found',
    'actions.untrusted',
    'actions.target-invalid',
  ],
} as const

const invalidInputs = {
  actions: 42,
  prepareActionRun: {
    actionId: 'action-build',
    target: { environmentId: 'env-local', projectId: 'proj-alpha', worktreeId: 'wt-alpha-main' },
  },
  trustActions: { projectId: 'proj-alpha', ids: [] },
  addAction: { projectId: 'proj-alpha', title: ' ', command: 'make build' },
  updateAction: { projectId: 'proj-alpha', id: 'action-build', command: '  ' },
  moveAction: { projectId: 'proj-alpha', id: 'action-build', direction: 'sideways' },
  deleteAction: { projectId: 'proj-alpha' },
} as const

const invalidOutputs = {
  actions: [{ ...actionsContractFixtures.actions.output[0], createdAt: '10' }],
  trustActions: null,
  addAction: { ...actionsContractFixtures.addAction.output, where: 'remote' },
  updateAction: null,
  moveAction: null,
  deleteAction: null,
  prepareActionRun: { ...actionsContractFixtures.prepareActionRun.output, where: 'remote' },
} as const

describe('Actions procedure contracts', () => {
  it('declares exactly seven procedures with their router kinds and allowed errors', () => {
    expect(Object.keys(actionsProcedures).sort()).toEqual(Object.keys(expectedKinds).sort())
    for (const [name, kind] of Object.entries(expectedKinds)) {
      const procedure = actionsProcedures[name as keyof typeof actionsProcedures]
      expect(procedure.kind).toBe(kind)
      expect([...procedure.errors]).toEqual([
        ...expectedErrors[name as keyof typeof expectedErrors],
      ])
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
          projectId: 'proj-alpha',
          title: 'An action',
          command: 'make check',
          where,
        }).success,
      ).toBe(true)
      expect(
        actionsProcedures.updateAction.input.safeParse({
          projectId: 'proj-alpha',
          id: 'action-build',
          where,
        }).success,
      ).toBe(true)
    }
    for (const direction of ACTION_MOVE_DIRECTIONS) {
      expect(
        actionsProcedures.moveAction.input.safeParse({
          projectId: 'proj-alpha',
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
          projectId: 'proj-alpha',
          title: value,
          command: 'make check',
        }).success,
      ).toBe(false)
      expect(
        actionsProcedures.addAction.input.safeParse({
          projectId: 'proj-alpha',
          title: 'An action',
          command: value,
        }).success,
      ).toBe(false)
      expect(
        actionsProcedures.updateAction.input.safeParse({
          projectId: 'proj-alpha',
          id: 'action-build',
          title: value,
        }).success,
      ).toBe(false)
      expect(
        actionsProcedures.updateAction.input.safeParse({
          projectId: 'proj-alpha',
          id: 'action-build',
          command: value,
        }).success,
      ).toBe(false)
    }
  })

  it('requires at least one trust id but no other trust field', () => {
    expect(
      actionsProcedures.trustActions.input.safeParse({
        projectId: 'proj-alpha',
        ids: ['action-build', 'action-serve'],
      }).success,
    ).toBe(true)
    expect(
      actionsProcedures.trustActions.input.safeParse({ projectId: 'proj-alpha' }).success,
    ).toBe(false)
    expect(
      actionsProcedures.trustActions.input.safeParse({
        projectId: 'proj-alpha',
        ids: ['action-build'],
        commands: ['make build'],
      }).success,
    ).toBe(false)
  })

  it('separates the stored action from the derived trusted view', () => {
    const stored = { id: 'action-build', title: 'Build', command: 'make build' }
    expect(actionSchema.parse(stored)).toEqual({
      ...stored,
      kind: 'action',
      order: 0,
      createdAt: 0,
    })
    expect(actionViewSchema.parse(stored)).toEqual({
      ...stored,
      kind: 'action',
      order: 0,
      createdAt: 0,
      trusted: false,
    })
    expect(actionSchema.safeParse({ ...stored, trusted: true }).success).toBe(false)
    expect(
      actionsProcedures.addAction.output.safeParse({ ...stored, trusted: false }).success,
    ).toBe(false)
    expect(actionsProcedures.actions.output.parse([stored])).toEqual([
      { ...stored, kind: 'action', order: 0, createdAt: 0, trusted: false },
    ])
  })

  it('reads a row written before kind existed as a plain action, and keeps the two script roles', () => {
    const legacy = { id: 'a', title: 'Build', command: 'make', order: 1, createdAt: 1 }
    expect(actionSchema.parse(legacy).kind).toBe('action')

    for (const kind of ['worktree-setup', 'worktree-dispose'] as const) {
      expect(actionSchema.parse({ ...legacy, kind }).kind).toBe(kind)
      expect(
        actionsProcedures.addAction.input.safeParse({
          projectId: 'proj-alpha',
          title: 'Install',
          command: 'pnpm install',
          kind,
        }).success,
      ).toBe(true)
    }

    expect(actionSchema.safeParse({ ...legacy, kind: 'worktree-teardown' }).success).toBe(false)
    // Never a wire escape hatch: an unknown field is still refused by the strict record.
    expect(actionSchema.safeParse({ ...legacy, role: 'worktree-setup' }).success).toBe(false)
  })

  it('requires a Project id on every procedure and rejects a bare path', () => {
    expect(actionsProcedures.actions.input.safeParse('/synthetic/repo').success).toBe(false)
    expect(actionsProcedures.actions.input.safeParse({ projectId: '' }).success).toBe(false)
    expect(
      actionsProcedures.deleteAction.input.safeParse({ projectId: '', id: 'action-build' }).success,
    ).toBe(false)
    expect(
      actionsProcedures.deleteAction.input.safeParse({ projectId: 'proj-alpha', id: '' }).success,
    ).toBe(true)
    expect(
      actionsProcedures.trustActions.input.safeParse({ projectId: 'proj-alpha', ids: [''] })
        .success,
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
        projectId: 'proj-alpha',
        id: 'action-build',
      }),
    ).toEqual({ projectId: 'proj-alpha', id: 'action-build' })
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

  it('rejects a run whose target is missing a coordinate', () => {
    const { input } = actionsContractFixtures.prepareActionRun
    for (const missing of ['environmentId', 'projectId', 'worktreeId', 'path'] as const) {
      const { [missing]: _dropped, ...partial } = input.target
      expect(
        actionsProcedures.prepareActionRun.input.safeParse({ ...input, target: partial }).success,
      ).toBe(false)
      expect(
        actionsProcedures.prepareActionRun.input.safeParse({
          ...input,
          target: { ...input.target, [missing]: '' },
        }).success,
      ).toBe(false)
    }
    expect(
      actionsProcedures.prepareActionRun.input.safeParse({
        ...input,
        target: { ...input.target, extra: true },
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
