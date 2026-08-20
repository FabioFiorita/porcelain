import type { ActionView } from '@porcelain/contracts/actions'
import type { Commit } from '@porcelain/contracts/git'
import { describe, expect, it } from 'vitest'

import { gotoRows, groupsLabelled, matchCommands, matchCommits } from './quick-open-matching'

const action = (overrides: Partial<ActionView> = {}): ActionView => ({
  command: 'pnpm verify',
  createdAt: 0,
  id: 'verify',
  kind: 'action',
  order: 0,
  title: 'Verify',
  trusted: true,
  where: 'primary',
  ...overrides,
})

const commit = (hash: string, subject = 'A commit'): Commit => ({
  author: 'Fabio',
  date: 'today',
  hash,
  subject,
})

describe('quick-open matching', () => {
  it('only matches commit hashes at the seven-character SHA floor', () => {
    const commits = [commit('abcdef0123456789')]

    expect(matchCommits('abcdef', commits)).toEqual([])
    expect(matchCommits('ABCDEF0', commits)).toEqual(commits)
  })

  it('matches commands by title or command text and caps them at five', () => {
    const actions = [
      action({ command: 'pnpm test', id: 'text', title: 'Run checks' }),
      ...Array.from({ length: 6 }, (_, index) =>
        action({ id: `verify-${index}`, title: `Verify ${index}` }),
      ),
    ]

    expect(matchCommands('pnpm test', actions)).toHaveLength(1)
    expect(matchCommands('verify', actions)).toHaveLength(5)
  })

  it('never returns local-only actions on mobile', () => {
    expect(matchCommands('pnpm', [action({ where: 'local' })])).toEqual([])
  })

  it('caps commit matches and labels groups only when needed', () => {
    const commits = Array.from({ length: 7 }, (_, index) => commit(`abcdef0${index}123456`))

    expect(matchCommits('abcdef', commits)).toEqual([])
    expect(matchCommits('abcdef0', commits)).toHaveLength(5)
    expect(groupsLabelled(1)).toBe(false)
    expect(groupsLabelled(2)).toBe(true)
  })

  it('matches navigation destinations and settings sections by their visible names', () => {
    expect(gotoRows('terminal')).toEqual([
      { detail: 'Surface', id: 'terminal', kind: 'surface', label: 'Terminal' },
    ])
    expect(gotoRows('remote')).toEqual([
      {
        detail: 'Settings',
        id: 'settings:remotes',
        kind: 'settings',
        label: 'Remotes',
        section: 'remotes',
      },
    ])
  })
})
