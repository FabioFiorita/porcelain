import type { HubProject } from '@porcelain/contracts/projects'
import { describe, expect, it } from 'vitest'
import { findHubProjectForPath, suggestLocalTerminalPath } from './local-path-suggestion'

function project(
  overrides: Partial<HubProject> & Pick<HubProject, 'name' | 'path' | 'groupingKey'>,
): HubProject {
  return {
    id: `id-${overrides.path}`,
    environmentId: 'env-1',
    worktrees: [],
    ...overrides,
  }
}

function worktree(path: string, name: string): HubProject['worktrees'][number] {
  return {
    id: `wt-${path}`,
    projectId: 'p',
    path,
    name,
    branch: name,
    isPrimary: false,
  }
}

const remoteProjects = [
  project({
    name: 'soaphealth-mobile',
    path: '/home/you/code/soaphealth-mobile',
    groupingKey: 'github.com/soap/mobile',
    worktrees: [worktree('/home/you/worktrees/push-notifications', 'push-notifications')],
  }),
]

describe('suggestLocalTerminalPath', () => {
  it('offers the local clone ROOT of the same repo, not the remote worktree path', () => {
    const suggestion = suggestLocalTerminalPath({
      repoPath: '/home/you/worktrees/push-notifications',
      remoteProjects,
      localProjects: [
        project({
          name: 'mobile',
          path: '/Users/you/code/mobile',
          groupingKey: 'github.com/soap/mobile',
        }),
      ],
      localHome: '/Users/you',
    })
    expect(suggestion).toBe('/Users/you/code/mobile')
  })

  it('matches a Project root on the remote side too', () => {
    expect(
      suggestLocalTerminalPath({
        repoPath: '/home/you/code/soaphealth-mobile',
        remoteProjects,
        localProjects: [
          project({
            name: 'mobile',
            path: '/Users/you/code/mobile',
            groupingKey: 'github.com/soap/mobile',
          }),
        ],
        localHome: '/Users/you',
      }),
    ).toBe('/Users/you/code/mobile')
  })

  it('falls back to a same-named local Project when no origin is shared', () => {
    expect(
      suggestLocalTerminalPath({
        repoPath: '/home/you/worktrees/push-notifications',
        remoteProjects,
        localProjects: [
          project({ name: 'other', path: '/Users/you/code/other', groupingKey: 'other' }),
          project({
            name: 'SoapHealth-Mobile',
            path: '/Users/you/code/soaphealth-mobile',
            groupingKey: 'fork/mobile',
          }),
        ],
        localHome: '/Users/you',
      }),
    ).toBe('/Users/you/code/soaphealth-mobile')
  })

  it('falls back to this device home when nothing local looks like the repo', () => {
    expect(
      suggestLocalTerminalPath({
        repoPath: '/home/you/worktrees/push-notifications',
        remoteProjects,
        localProjects: [
          project({ name: 'other', path: '/Users/you/code/other', groupingKey: 'other' }),
        ],
        localHome: '/Users/you',
      }),
    ).toBe('/Users/you')
  })

  it('never suggests the remote path — the whole point of the fix', () => {
    for (const localHome of ['/Users/you', null]) {
      expect(
        suggestLocalTerminalPath({
          repoPath: '/home/you/worktrees/push-notifications',
          remoteProjects,
          localProjects: [],
          localHome,
        }),
      ).not.toBe('/home/you/worktrees/push-notifications')
    }
  })

  it('leaves the field empty rather than guessing when even home is unknown', () => {
    expect(
      suggestLocalTerminalPath({
        repoPath: '/home/you/worktrees/push-notifications',
        remoteProjects: [],
        localProjects: [],
        localHome: null,
      }),
    ).toBe('')
  })

  it('still offers home when the remote inventory has not loaded', () => {
    expect(
      suggestLocalTerminalPath({
        repoPath: '/home/you/worktrees/push-notifications',
        remoteProjects: [],
        localProjects: [
          project({
            name: 'mobile',
            path: '/Users/you/code/mobile',
            groupingKey: 'github.com/soap/mobile',
          }),
        ],
        localHome: '/Users/you',
      }),
    ).toBe('/Users/you')
  })
})

describe('findHubProjectForPath', () => {
  it('finds a Project by its root or by any live worktree', () => {
    expect(findHubProjectForPath(remoteProjects, '/home/you/code/soaphealth-mobile')?.name).toBe(
      'soaphealth-mobile',
    )
    expect(
      findHubProjectForPath(remoteProjects, '/home/you/worktrees/push-notifications')?.name,
    ).toBe('soaphealth-mobile')
  })

  it('returns null for an unknown path instead of a near match', () => {
    expect(findHubProjectForPath(remoteProjects, '/home/you/code/soaphealth')).toBeNull()
  })
})
