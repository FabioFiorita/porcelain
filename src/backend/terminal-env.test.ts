import { describe, expect, it } from 'vitest'
import { terminalEnv } from './terminal-env'

describe('terminalEnv', () => {
  it('passes the user environment through and drops undefined values', () => {
    const env = terminalEnv({ PATH: '/usr/bin', HOME: '/Users/me', EMPTY: undefined })
    expect(env.PATH).toBe('/usr/bin')
    expect(env.HOME).toBe('/Users/me')
    expect('EMPTY' in env).toBe(false)
  })

  it('strips the daemon-only variables (token, run-as-node, config knobs)', () => {
    const env = terminalEnv({
      PATH: '/usr/bin',
      ELECTRON_RUN_AS_NODE: '1',
      PORCELAIN_DAEMON_TOKEN: 'secret',
      PORCELAIN_DAEMON_PORT: '4242',
      PORCELAIN_USER_DATA: '/tmp/ud',
      PORCELAIN_DEV: '1',
      PORCELAIN_ALLOWED_ORIGIN: 'http://localhost:5173',
      PORCELAIN_TAILNET_BIND: '1',
      PORCELAIN_LAN_BIND: '1',
      PORCELAIN_AGENT_THREADS: '/tmp/threads',
      PORCELAIN_AGENT_FAKE: '1',
      PORCELAIN_E2E: '1',
      PORCELAIN_SHELL: '/bin/bash',
      PORCELAIN_FORCE_LINUX: '1',
      // Volta shim leaves this on a daemon started via ~/.volta/bin/node.
      _VOLTA_TOOL_RECURSION: '1',
    })
    expect(env.PATH).toBe('/usr/bin')
    expect('ELECTRON_RUN_AS_NODE' in env).toBe(false)
    expect('PORCELAIN_DAEMON_TOKEN' in env).toBe(false)
    expect('PORCELAIN_DAEMON_PORT' in env).toBe(false)
    expect('PORCELAIN_USER_DATA' in env).toBe(false)
    expect('PORCELAIN_DEV' in env).toBe(false)
    expect('PORCELAIN_ALLOWED_ORIGIN' in env).toBe(false)
    expect('PORCELAIN_TAILNET_BIND' in env).toBe(false)
    expect('PORCELAIN_LAN_BIND' in env).toBe(false)
    expect('PORCELAIN_AGENT_THREADS' in env).toBe(false)
    expect('PORCELAIN_AGENT_FAKE' in env).toBe(false)
    expect('PORCELAIN_E2E' in env).toBe(false)
    expect('PORCELAIN_SHELL' in env).toBe(false)
    expect('PORCELAIN_FORCE_LINUX' in env).toBe(false)
    expect('_VOLTA_TOOL_RECURSION' in env).toBe(false)
  })

  it('forces the terminal type variables', () => {
    const env = terminalEnv({ TERM: 'dumb', COLORTERM: '' })
    expect(env.TERM).toBe('xterm-256color')
    expect(env.COLORTERM).toBe('truecolor')
  })
})
