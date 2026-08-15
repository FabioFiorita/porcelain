import { describe, expect, it } from 'vitest'
import {
  DEV_SERVER_STATUS_VALUES,
  devServerSchema,
  devServerTargetSchema,
  startDevServerInputSchema,
} from './dev-server.contract'
import { terminalContractFixtures } from './terminal.contract'

const TARGET = terminalContractFixtures.startDevServer.input.target
const SERVER = terminalContractFixtures.devServers.output[0]

describe('development server record contract', () => {
  it('accepts every status the daemon can report', () => {
    for (const status of DEV_SERVER_STATUS_VALUES) {
      expect(devServerSchema.safeParse({ ...SERVER, status }).success).toBe(true)
    }
  })

  it('requires the whole target — a Project without a Worktree is not a target', () => {
    expect(devServerTargetSchema.safeParse(TARGET).success).toBe(true)
    for (const missing of ['projectId', 'worktreeId', 'path'] as const) {
      const { [missing]: _dropped, ...partial } = TARGET
      expect(devServerTargetSchema.safeParse(partial).success).toBe(false)
      expect(devServerTargetSchema.safeParse({ ...TARGET, [missing]: '' }).success).toBe(false)
    }
  })

  it('binds every record to an underlying session so its output stays readable', () => {
    const { terminalId: _dropped, ...withoutSession } = SERVER
    expect(devServerSchema.safeParse(withoutSession).success).toBe(false)
    expect(devServerSchema.safeParse({ ...SERVER, terminalId: '' }).success).toBe(false)
  })

  it('keeps the detected URL optional and refuses a non-URL string in it', () => {
    const { detectedUrl: _dropped, ...withoutUrl } = SERVER
    expect(devServerSchema.parse(withoutUrl).detectedUrl).toBeUndefined()
    expect(devServerSchema.safeParse({ ...SERVER, detectedUrl: 'port 5173' }).success).toBe(false)
  })

  it('keeps exit code and end time optional and integral', () => {
    expect(devServerSchema.safeParse({ ...SERVER, exitCode: 0, endedAt: 5 }).success).toBe(true)
    expect(devServerSchema.safeParse({ ...SERVER, exitCode: 1.5 }).success).toBe(false)
    expect(devServerSchema.safeParse({ ...SERVER, exitCode: '1' }).success).toBe(false)
  })

  it('rejects an unknown field on the record and on a start request', () => {
    expect(devServerSchema.safeParse({ ...SERVER, pid: 4321 }).success).toBe(false)
    expect(
      startDevServerInputSchema.safeParse({
        target: TARGET,
        label: 'web',
        command: 'pnpm dev',
        env: { PORT: '3000' },
      }).success,
    ).toBe(false)
  })

  it('refuses a start with a blank label or command', () => {
    expect(
      startDevServerInputSchema.safeParse({ target: TARGET, label: '', command: 'pnpm dev' })
        .success,
    ).toBe(false)
    expect(
      startDevServerInputSchema.safeParse({ target: TARGET, label: 'web', command: '' }).success,
    ).toBe(false)
  })
})
