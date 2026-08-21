import {
  ELSEWHERE_GROUP_KEY,
  ENVIRONMENT_GROUP_KEY,
  groupTerminalSessions,
  terminalLocations,
} from '@porcelain/client-runtime/terminal'
import type { HubProject } from '@porcelain/contracts/projects'
import type { TerminalInfo } from '@porcelain/contracts/terminal'
import { describe, expect, it } from 'vitest'

import { TERMINAL_ROSTER_POLL_MS } from './terminal-roster-policy'
import {
  ENVIRONMENT_SHELLS,
  newTerminalOptions,
  rosterSummary,
  runningShellNamed,
} from './terminals-board-model'

const HOME = '/home/dev'

function session(overrides: Partial<TerminalInfo> & { id: string }): TerminalInfo {
  return {
    createdAt: 1,
    cwd: HOME,
    name: overrides.id,
    status: 'running',
    ...overrides,
  }
}

const projects: HubProject[] = [
  {
    environmentId: 'env-1',
    groupingKey: 'porcelain',
    id: 'p1',
    name: 'Porcelain',
    path: `${HOME}/code/porcelain`,
    worktrees: [
      {
        branch: 'main',
        id: 'w1',
        isPrimary: true,
        name: 'main',
        path: `${HOME}/code/porcelain`,
        projectId: 'p1',
      },
      {
        branch: 'work/shell',
        id: 'w2',
        isPrimary: false,
        name: 'shell',
        path: `${HOME}/code/porcelain/.worktrees/shell`,
        projectId: 'p1',
      },
    ],
  },
]

describe('mobile Terminals grouping', () => {
  const locations = terminalLocations(projects)

  it('leads with the Environment, then Projects, then Elsewhere', () => {
    const groups = groupTerminalSessions(
      [
        session({ cwd: '/var/tmp', id: 'stray' }),
        session({ cwd: `${HOME}/code/porcelain/apps/mobile`, id: 'main' }),
        session({ cwd: HOME, id: 'herdr', name: 'herdr' }),
      ],
      locations,
      HOME,
    )

    expect(groups.map((group) => group.key)).toEqual([
      ENVIRONMENT_GROUP_KEY,
      'p1:w1',
      ELSEWHERE_GROUP_KEY,
    ])
  })

  it('gives a nested worktree its own group instead of its parent checkout', () => {
    const groups = groupTerminalSessions(
      [session({ cwd: `${HOME}/code/porcelain/.worktrees/shell/apps/mobile`, id: 'nested' })],
      locations,
      HOME,
    )

    expect(groups.map((group) => [group.key, group.worktreeName])).toEqual([['p1:w2', 'shell']])
  })
})

describe('Environment shell shortcuts', () => {
  it('offers herdr and tmux, each as a create-time input rather than a write', () => {
    expect(ENVIRONMENT_SHELLS.map((shell) => shell.name)).toEqual(['herdr', 'tmux'])
    for (const shell of ENVIRONMENT_SHELLS) expect(shell.initialInput.endsWith('\n')).toBe(true)
  })

  it('finds a running shell by its literal name so the shortcut never starts a second one', () => {
    const running = session({ cwd: HOME, id: 'a', name: 'herdr' })

    expect(runningShellNamed([running], 'herdr')).toBe(running)
    expect(runningShellNamed([running], 'tmux')).toBeNull()
  })

  it('refuses an exited shell of the same name: the shortcut is for a live multiplexer', () => {
    const exited = session({ cwd: HOME, exitCode: 0, id: 'a', name: 'herdr', status: 'exited' })

    expect(runningShellNamed([exited], 'herdr')).toBeNull()
  })

  it('never matches a same-named shell running somewhere else', () => {
    // The caller passes the Environment group only, which is what makes this hold — a `herdr`
    // inside a worktree belongs to that worktree's group and is not the Environment's.
    const groups = groupTerminalSessions(
      [session({ cwd: `${HOME}/code/porcelain`, id: 'a', name: 'herdr' })],
      terminalLocations(projects),
      HOME,
    )
    const environment = groups.find((group) => group.key === ENVIRONMENT_GROUP_KEY)

    expect(environment).toBeUndefined()
  })
})

describe('New terminal options', () => {
  it('puts the Environment root first, then every worktree the Hub can name', () => {
    expect(
      newTerminalOptions({
        environmentLabel: 'Beelink',
        environmentRoot: HOME,
        locations: terminalLocations(projects),
      }),
    ).toEqual([
      { detail: null, key: 'environment', label: 'Beelink', path: HOME },
      { detail: 'main', key: 'p1:w1', label: 'Porcelain', path: `${HOME}/code/porcelain` },
      {
        detail: 'shell',
        key: 'p1:w2',
        label: 'Porcelain',
        path: `${HOME}/code/porcelain/.worktrees/shell`,
      },
    ])
  })

  it('omits the Environment before its home directory is known — cwd is required', () => {
    expect(
      newTerminalOptions({ environmentLabel: 'Beelink', environmentRoot: null, locations: [] }),
    ).toEqual([])
  })
})

describe('roster summary', () => {
  it('separates "nothing paired" from "nothing read yet" from "nothing running"', () => {
    expect(rosterSummary([], { isLoading: false, paired: false })).toBe('No environment paired')
    expect(rosterSummary([], { isLoading: true, paired: true })).toBe('Loading terminals…')
    expect(rosterSummary([], { isLoading: false, paired: true })).toBe('No terminals')
  })

  it('counts running and exited shells apart', () => {
    const rows = [
      session({ id: 'a' }),
      session({ exitCode: 1, id: 'b', status: 'exited' }),
      session({ id: 'c' }),
    ]

    expect(rosterSummary(rows, { isLoading: false, paired: true })).toBe('2 running · 1 exited')
  })

  it('keeps the five-second poll as the external-kill recovery backstop', () => {
    expect(TERMINAL_ROSTER_POLL_MS).toBe(5_000)
  })
})
