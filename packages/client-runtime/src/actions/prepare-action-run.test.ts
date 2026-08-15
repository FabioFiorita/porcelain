import type { PrepareActionRunOutput } from '@porcelain/contracts/actions'
import { actionsContractFixtures, prepareActionRunOutputSchema } from '@porcelain/contracts/actions'
import { describe, expect, it } from 'vitest'
import { prepareActionRun } from './prepare-action-run'

/**
 * Authorization moved to the daemon (#24): this function is only handed a
 * contract-valid `prepareActionRun` output and answers one question — which cwd
 * does THIS client spawn in. Every input below is parsed by the wire schema so a
 * shape the daemon could never send cannot silently pass here.
 */

const DAEMON_CWD = '/synthetic/projects/alpha'
const LOCAL_PATH = '/synthetic/local-device/alpha'

function authorized(overrides: Partial<PrepareActionRunOutput> = {}): PrepareActionRunOutput {
  return prepareActionRunOutputSchema.parse({
    ...actionsContractFixtures.prepareActionRun.output,
    ...overrides,
  })
}

describe('prepareActionRun', () => {
  it('binds a primary run to the cwd the daemon verified', () => {
    const run = authorized({ where: 'primary', cwd: DAEMON_CWD })
    expect(prepareActionRun(run)).toEqual({
      ok: true,
      value: {
        id: run.id,
        title: run.title,
        command: run.command,
        where: 'primary',
        cwd: DAEMON_CWD,
        name: run.title,
        initialInput: run.command,
      },
    })
  })

  it('ignores a localPath for a primary run — the daemon owns that cwd', () => {
    const run = authorized({ where: 'primary', cwd: DAEMON_CWD })
    const result = prepareActionRun(run, { localPath: LOCAL_PATH })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.cwd).toBe(DAEMON_CWD)
  })

  it('binds a local run to this device folder map, never the daemon cwd', () => {
    const run = authorized({ where: 'local', cwd: DAEMON_CWD })
    const result = prepareActionRun(run, { localPath: LOCAL_PATH })
    expect(result).toEqual({
      ok: true,
      value: {
        id: run.id,
        title: run.title,
        command: run.command,
        where: 'local',
        cwd: LOCAL_PATH,
        name: run.title,
        initialInput: run.command,
      },
    })
    if (result.ok) expect(result.value.cwd).not.toBe(DAEMON_CWD)
  })

  it('refuses a local run when this device has no folder mapping', () => {
    const run = authorized({ where: 'local', cwd: DAEMON_CWD })
    const refusal = { ok: false, error: { code: 'actions.needs-local-path', actionId: run.id } }
    expect(prepareActionRun(run)).toEqual(refusal)
    expect(prepareActionRun(run, {})).toEqual(refusal)
    expect(prepareActionRun(run, { localPath: null })).toEqual(refusal)
    expect(prepareActionRun(run, { localPath: '' })).toEqual(refusal)
  })

  it('always carries the title as the session name and the command as initial input', () => {
    const run = authorized({
      where: 'primary',
      cwd: DAEMON_CWD,
      title: 'Watch tests',
      command: 'pnpm test --watch',
    })
    const result = prepareActionRun(run)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.name).toBe('Watch tests')
      expect(result.value.initialInput).toBe('pnpm test --watch')
    }
  })
})
