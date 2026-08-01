import { describe, expect, it } from 'vitest'
import { gitEnv } from './git-env'

describe('gitEnv', () => {
  it('drops every repository-local variable git exports to hooks', () => {
    const env = gitEnv({
      GIT_DIR: '/repo/.git',
      GIT_INDEX_FILE: '/repo/.git/index',
      GIT_WORK_TREE: '/repo',
      GIT_COMMON_DIR: '/repo/.git',
      GIT_OBJECT_DIRECTORY: '/repo/.git/objects',
      GIT_CONFIG: '/repo/.git/config',
      GIT_CONFIG_PARAMETERS: "'core.bare=true'",
      GIT_PREFIX: 'sub/',
    })
    expect(env).toEqual({})
  })

  it('passes the user’s real configuration through untouched', () => {
    // These say HOW git works, not WHICH repo — stripping them breaks push auth.
    const env = gitEnv({
      PATH: '/usr/bin',
      HOME: '/home/dev',
      GIT_SSH_COMMAND: 'ssh -i /home/dev/.ssh/id_ed25519',
      GIT_ASKPASS: '/usr/bin/askpass',
      GIT_TERMINAL_PROMPT: '0',
      GIT_DIR: '/repo/.git',
    })
    expect(env).toEqual({
      PATH: '/usr/bin',
      HOME: '/home/dev',
      GIT_SSH_COMMAND: 'ssh -i /home/dev/.ssh/id_ed25519',
      GIT_ASKPASS: '/usr/bin/askpass',
      GIT_TERMINAL_PROMPT: '0',
    })
  })

  it('applies overrides and skips undefined values', () => {
    const env = gitEnv({ PATH: '/usr/bin', EMPTY: undefined }, { GIT_OPTIONAL_LOCKS: '0' })
    expect(env).toEqual({ PATH: '/usr/bin', GIT_OPTIONAL_LOCKS: '0' })
  })

  it('lets an override win over an inherited value of the same name', () => {
    const env = gitEnv({ GIT_OPTIONAL_LOCKS: '1' }, { GIT_OPTIONAL_LOCKS: '0' })
    expect(env.GIT_OPTIONAL_LOCKS).toBe('0')
  })
})
