import { describe, expect, it } from 'vitest'
import {
  TERMINAL_STATUS_VALUES,
  terminalContractFixtures,
  terminalInfoSchema,
} from './terminal.contract'
import { terminalProcedures } from './terminal.procedures'

const expectedKinds = {
  terminalSessions: 'query',
  renameTerminal: 'mutation',
} as const

const invalidInputs = {
  terminalSessions: 'every-session',
  renameTerminal: { id: 'terminal-1' },
} as const

const invalidOutputs = {
  terminalSessions: [{ ...terminalContractFixtures.terminalSessions.output[0], status: 'paused' }],
  renameTerminal: null,
} as const

describe('Terminal procedure contracts', () => {
  it('declares exactly two procedures with their router kinds', () => {
    expect(Object.keys(terminalProcedures).sort()).toEqual(Object.keys(expectedKinds).sort())
    for (const [name, kind] of Object.entries(expectedKinds)) {
      expect(terminalProcedures[name as keyof typeof terminalProcedures].kind).toBe(kind)
    }
  })

  for (const name of Object.keys(terminalProcedures) as Array<keyof typeof terminalProcedures>) {
    it(`accepts valid ${name} input and output fixtures`, () => {
      const fixture = terminalContractFixtures[name]
      const procedure = terminalProcedures[name]
      expect(procedure.input.safeParse(fixture.input).success).toBe(true)
      expect(procedure.output.safeParse(fixture.output).success).toBe(true)
    })

    it(`rejects invalid ${name} input and output fixtures`, () => {
      const procedure = terminalProcedures[name]
      expect(procedure.input.safeParse(invalidInputs[name]).success).toBe(false)
      expect(procedure.output.safeParse(invalidOutputs[name]).success).toBe(false)
    })
  }

  it('accepts every roster status the terminal manager reports', () => {
    for (const status of TERMINAL_STATUS_VALUES) {
      expect(
        terminalInfoSchema.safeParse({
          id: 'terminal-1',
          name: 'dev server',
          cwd: '/synthetic/repo',
          status,
          createdAt: 10,
        }).success,
      ).toBe(true)
    }
  })

  it('keeps the exit code optional and numeric', () => {
    const base = { id: 'terminal-2', name: 'checks', cwd: '/synthetic/repo', status: 'exited' }
    expect(terminalInfoSchema.parse(base).exitCode).toBeUndefined()
    expect(terminalInfoSchema.parse({ ...base, exitCode: 0 }).exitCode).toBe(0)
    expect(terminalInfoSchema.safeParse({ ...base, exitCode: '1' }).success).toBe(false)
  })

  it('defaults createdAt to zero and preserves unbounded id, name, and cwd strings', () => {
    expect(terminalInfoSchema.parse({ id: '', name: '', cwd: '', status: 'running' })).toEqual({
      id: '',
      name: '',
      cwd: '',
      status: 'running',
      createdAt: 0,
    })
  })

  it('accepts empty and whitespace-only rename names because the manager trims them', () => {
    for (const name of ['', '   ', '\t\n']) {
      expect(
        terminalProcedures.renameTerminal.input.safeParse({ id: 'terminal-1', name }).success,
      ).toBe(true)
    }
    expect(terminalProcedures.renameTerminal.input.safeParse({ id: '', name: '' }).success).toBe(
      true,
    )
  })

  it('rejects unknown fields at the roster and rename boundaries', () => {
    expect(
      terminalProcedures.terminalSessions.output.safeParse([
        { ...terminalContractFixtures.terminalSessions.output[0], pid: 4321 },
      ]).success,
    ).toBe(false)
    expect(
      terminalProcedures.renameTerminal.input.safeParse({
        ...terminalContractFixtures.renameTerminal.input,
        cwd: '/synthetic/repo',
      }).success,
    ).toBe(false)
  })

  it('keeps the roster query input and the rename result void', () => {
    expect(terminalProcedures.terminalSessions.input.safeParse(undefined).success).toBe(true)
    expect(terminalProcedures.renameTerminal.output.safeParse(undefined).success).toBe(true)
    expect(terminalProcedures.terminalSessions.output.safeParse(undefined).success).toBe(false)
  })
})
