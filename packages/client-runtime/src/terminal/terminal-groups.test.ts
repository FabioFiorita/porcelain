import type { HubProject } from '@porcelain/contracts/projects'
import type { TerminalInfo } from '@porcelain/contracts/terminal'
import { describe, expect, it } from 'vitest'
import {
  ELSEWHERE_GROUP_KEY,
  ENVIRONMENT_GROUP_KEY,
  groupTerminalSessions,
  locationForCwd,
  terminalLocations,
} from './terminal-groups'

const PROJECTS: HubProject[] = [
  {
    id: 'p-web',
    environmentId: 'env-1',
    name: 'web',
    groupingKey: 'web',
    path: '/code/web',
    worktrees: [
      {
        id: 'w-web-main',
        projectId: 'p-web',
        path: '/code/web',
        name: 'main',
        branch: 'main',
        isPrimary: true,
      },
      // Nested INSIDE the primary checkout — the reason matching is longest-prefix.
      {
        id: 'w-web-fix',
        projectId: 'p-web',
        path: '/code/web/worktrees/fix',
        name: 'fix',
        branch: 'work/fix',
        isPrimary: false,
      },
    ],
  },
  {
    id: 'p-api',
    environmentId: 'env-1',
    name: 'api',
    groupingKey: 'api',
    path: '/code/api',
    worktrees: [
      {
        id: 'w-api-main',
        projectId: 'p-api',
        path: '/code/api',
        name: 'main',
        branch: 'main',
        isPrimary: true,
      },
    ],
  },
]

function session(id: string, cwd: string, createdAt = 0): TerminalInfo {
  return { id, name: id, cwd, status: 'running', createdAt }
}

describe('terminalLocations', () => {
  it('flattens every worktree and sorts by project then worktree', () => {
    expect(terminalLocations(PROJECTS).map((location) => location.key)).toEqual([
      'p-api:w-api-main',
      'p-web:w-web-fix',
      'p-web:w-web-main',
    ])
  })
})

describe('locationForCwd', () => {
  const locations = terminalLocations(PROJECTS)

  it('picks the most specific worktree when checkouts nest', () => {
    expect(locationForCwd('/code/web/worktrees/fix/src', locations)?.key).toBe('p-web:w-web-fix')
    expect(locationForCwd('/code/web/src', locations)?.key).toBe('p-web:w-web-main')
  })

  it('does not claim a sibling directory that merely shares a prefix', () => {
    expect(locationForCwd('/code/web-scratch', locations)).toBeNull()
  })
})

describe('groupTerminalSessions', () => {
  const locations = terminalLocations(PROJECTS)

  it('groups every live session by the worktree it runs in', () => {
    const groups = groupTerminalSessions(
      [
        session('a', '/code/api', 2),
        session('b', '/code/web/src', 1),
        session('c', '/code/web/worktrees/fix', 3),
      ],
      locations,
    )
    expect(groups.map((group) => [group.label, group.worktreeName])).toEqual([
      ['api', 'main'],
      ['web', 'fix'],
      ['web', 'main'],
    ])
    expect(groups.flatMap((group) => group.sessions.map((entry) => entry.id)).sort()).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('keeps unclaimed directories in a trailing Elsewhere group instead of dropping them', () => {
    const groups = groupTerminalSessions(
      [session('home', '/home/fabio', 1), session('api', '/code/api', 2)],
      locations,
    )
    expect(groups.map((group) => group.key)).toEqual(['p-api:w-api-main', ELSEWHERE_GROUP_KEY])
    expect(groups[1]?.path).toBeNull()
  })

  it('leads with the Environment when a shell sits under the daemon host home', () => {
    const groups = groupTerminalSessions(
      [
        session('api', '/code/api', 2),
        session('herd', '/home/fabio', 1),
        session('tmp', '/tmp/scratch', 3),
      ],
      locations,
      '/home/fabio',
    )
    // Environment first, Projects next, and only the truly unclaimed trails.
    expect(groups.map((group) => group.key)).toEqual([
      ENVIRONMENT_GROUP_KEY,
      'p-api:w-api-main',
      ELSEWHERE_GROUP_KEY,
    ])
    expect(groups[0]?.path).toBe('/home/fabio')
  })

  it('lets a Project inside the Environment home stay its own group', () => {
    const groups = groupTerminalSessions([session('api', '/code/api', 1)], locations, '/code')
    expect(groups.map((group) => group.key)).toEqual(['p-api:w-api-main'])
  })

  it('orders sessions oldest first so a roster poll cannot reshuffle the list', () => {
    const groups = groupTerminalSessions(
      [session('late', '/code/api', 9), session('early', '/code/api', 1)],
      locations,
    )
    expect(groups[0]?.sessions.map((entry) => entry.id)).toEqual(['early', 'late'])
  })

  it('omits worktrees with no terminals — the board lists sessions, not the Hub tree', () => {
    expect(groupTerminalSessions([], locations)).toEqual([])
  })
})
