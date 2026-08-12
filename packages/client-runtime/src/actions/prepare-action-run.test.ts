import type { ActionView } from '@porcelain/contracts/actions'
import { actionsContractFixtures } from '@porcelain/contracts/actions'
import { describe, expect, it } from 'vitest'
import { ActionsIdentityError } from './actions-queries'
import { prepareActionRun } from './prepare-action-run'

const PROJECT = '/synthetic/repo'
const LOCAL_PATH = '/synthetic/local-device/repo'

const primaryFixture = actionsContractFixtures.actions.output[0]
const localFixture = actionsContractFixtures.actions.output[1]

function view(
  base: (typeof actionsContractFixtures.actions.output)[number],
  overrides: Partial<ActionView> = {},
): ActionView {
  return { ...base, ...overrides }
}

describe('prepareActionRun', () => {
  it('refuses an untrusted action', () => {
    const action = view(localFixture, { trusted: false })
    expect(prepareActionRun(action, { projectPath: PROJECT, localPath: LOCAL_PATH })).toEqual({
      ok: false,
      error: { code: 'actions.untrusted', actionId: action.id },
    })
  })

  it('refuses a trusted local action when localPath is missing or empty', () => {
    const action = view(localFixture, { trusted: true, where: 'local' })
    expect(prepareActionRun(action, { projectPath: PROJECT })).toEqual({
      ok: false,
      error: { code: 'actions.needs-local-path', actionId: action.id },
    })
    expect(prepareActionRun(action, { projectPath: PROJECT, localPath: null })).toEqual({
      ok: false,
      error: { code: 'actions.needs-local-path', actionId: action.id },
    })
    expect(prepareActionRun(action, { projectPath: PROJECT, localPath: '' })).toEqual({
      ok: false,
      error: { code: 'actions.needs-local-path', actionId: action.id },
    })
  })

  it('prepares a trusted local action with cwd = localPath and Terminal create fields', () => {
    const action = view(localFixture, { trusted: true, where: 'local' })
    const result = prepareActionRun(action, { projectPath: PROJECT, localPath: LOCAL_PATH })
    expect(result).toEqual({
      ok: true,
      value: {
        id: action.id,
        title: action.title,
        command: action.command,
        where: 'local',
        projectPath: PROJECT,
        cwd: LOCAL_PATH,
        name: action.title,
        initialInput: action.command,
      },
    })
    if (result.ok) {
      expect(result.value.name).toBe(result.value.title)
      expect(result.value.initialInput).toBe(result.value.command)
    }
  })

  it('prepares a trusted primary action with cwd = projectPath', () => {
    const action = view(primaryFixture, { trusted: true, where: 'primary' })
    const result = prepareActionRun(action, { projectPath: PROJECT })
    expect(result).toEqual({
      ok: true,
      value: {
        id: action.id,
        title: action.title,
        command: action.command,
        where: 'primary',
        projectPath: PROJECT,
        cwd: PROJECT,
        name: action.title,
        initialInput: action.command,
      },
    })
  })

  it('treats omitted where as primary', () => {
    const action = view(primaryFixture, { trusted: true })
    // Fixture has no where; ensure undefined path is primary.
    const withoutWhere: ActionView = {
      id: action.id,
      title: action.title,
      command: action.command,
      order: action.order,
      createdAt: action.createdAt,
      trusted: true,
    }
    const result = prepareActionRun(withoutWhere, { projectPath: PROJECT })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.where).toBe('primary')
      expect(result.value.cwd).toBe(PROJECT)
      expect(result.value.name).toBe(withoutWhere.title)
      expect(result.value.initialInput).toBe(withoutWhere.command)
    }
  })

  it('throws ActionsIdentityError for empty projectPath even on local runs', () => {
    const local = view(localFixture, { trusted: true, where: 'local' })
    expect(() => prepareActionRun(local, { projectPath: '', localPath: LOCAL_PATH })).toThrow(
      ActionsIdentityError,
    )

    const primary = view(primaryFixture, { trusted: true })
    expect(() => prepareActionRun(primary, { projectPath: '' })).toThrow(ActionsIdentityError)
  })

  it('checks untrusted before local-path so untrusted local refuses as untrusted', () => {
    const action = view(localFixture, { trusted: false, where: 'local' })
    expect(prepareActionRun(action, { projectPath: PROJECT })).toEqual({
      ok: false,
      error: { code: 'actions.untrusted', actionId: action.id },
    })
  })
})
