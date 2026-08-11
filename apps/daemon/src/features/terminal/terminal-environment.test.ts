import { describe, expect, it } from 'vitest'
import { createTerminalEnvironment } from './terminal-environment'

describe('createTerminalEnvironment', () => {
  it('selects the first non-blank shell override and keeps ordinary variables', () => {
    const environment = createTerminalEnvironment({
      PORCELAIN_SHELL: '  /bin/fish  ',
      SHELL: '/bin/bash',
      HOME: '/home/tester',
      PATH: '/usr/bin',
      EMPTY: undefined,
    })

    expect(environment.shell).toBe('  /bin/fish  ')
    expect(environment.environment).toMatchObject({
      HOME: '/home/tester',
      PATH: '/usr/bin',
    })
    expect(environment.environment).not.toHaveProperty('EMPTY')
  })

  it('falls back from a blank override to SHELL and then zsh', () => {
    expect(createTerminalEnvironment({ PORCELAIN_SHELL: '  ', SHELL: '/bin/bash' }).shell).toBe(
      '/bin/bash',
    )
    expect(createTerminalEnvironment({ PORCELAIN_SHELL: '', SHELL: ' ' }).shell).toBe('/bin/zsh')
  })

  it('removes daemon-only values and forces terminal variables', () => {
    const environment = createTerminalEnvironment({
      PATH: '/usr/bin',
      TERM: 'dumb',
      COLORTERM: '',
      ELECTRON_RUN_AS_NODE: '1',
      PORCELAIN_ADMIN_TOKEN: 'secret',
      PORCELAIN_USER_DATA: '/daemon/data',
      PORCELAIN_SHELL: '/bin/bash',
      _VOLTA_TOOL_RECURSION: '1',
    })

    expect(environment.environment).toMatchObject({
      PATH: '/usr/bin',
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    })
    for (const key of [
      'ELECTRON_RUN_AS_NODE',
      'PORCELAIN_ADMIN_TOKEN',
      'PORCELAIN_USER_DATA',
      'PORCELAIN_SHELL',
      '_VOLTA_TOOL_RECURSION',
    ]) {
      expect(environment.environment).not.toHaveProperty(key)
    }
  })
})
