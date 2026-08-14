import { describe, expect, it } from 'vitest'
import {
  type DiscoveredProject,
  normalizeOriginUrl,
  projectGroupingKey,
  rematchProject,
  rematchWorktrees,
  type StoredHubProject,
  worktreeDisplayName,
} from './hub-identity'

function ids(): () => string {
  let next = 0
  return () => `id-${++next}`
}

describe('Hub identity rules', () => {
  it('groups equivalent remotes without treating the path as the identity', () => {
    expect(projectGroupingKey({ originUrl: 'git@github.com:acme/alpha.git', name: 'alpha' })).toBe(
      'ssh://git@github.com/acme/alpha',
    )
    expect(
      projectGroupingKey({
        originUrl: 'https://user:token@github.com/acme/alpha.git/',
        name: 'other',
      }),
    ).toBe('https://github.com/acme/alpha')
    expect(projectGroupingKey({ originUrl: null, name: 'alpha' })).toBe('name:alpha')
    expect(normalizeOriginUrl('   ')).toBeNull()
  })

  it('keeps a Worktree id when only its checkout path changes', () => {
    const stored = [{ id: 'wt-main', gitDir: '/repos/alpha/.git/worktrees/topic' }]
    const rematched = rematchWorktrees(
      stored,
      [
        {
          path: '/moved/alpha-worktrees/topic',
          gitDir: '/repos/alpha/.git/worktrees/topic',
          branch: 'topic',
          isPrimary: false,
        },
      ],
      ids(),
    )
    expect(rematched).toEqual([{ id: 'wt-main', gitDir: '/repos/alpha/.git/worktrees/topic' }])
  })

  it('assigns a new Worktree id when the git dir is new', () => {
    const rematched = rematchWorktrees(
      [{ id: 'wt-old', gitDir: '/repos/alpha/.git/worktrees/old' }],
      [
        {
          path: '/repos/alpha-worktrees/new',
          gitDir: '/repos/alpha/.git/worktrees/new',
          branch: 'new',
          isPrimary: false,
        },
      ],
      ids(),
    )
    expect(rematched).toEqual([{ id: 'id-1', gitDir: '/repos/alpha/.git/worktrees/new' }])
  })

  it('keeps a Project id when the common git dir is unchanged', () => {
    const stored: StoredHubProject[] = [
      {
        id: 'proj-alpha',
        commonGitDir: '/repos/alpha/.git',
        groupingKey: 'name:alpha',
        name: 'alpha',
        worktrees: [{ id: 'wt-main', gitDir: '/repos/alpha/.git' }],
      },
    ]
    const discovered: DiscoveredProject = {
      commonGitDir: '/repos/alpha/.git',
      groupingKey: 'ssh://git@example/acme/alpha',
      name: 'alpha',
      worktrees: [
        { path: '/repos/alpha', gitDir: '/repos/alpha/.git', branch: 'main', isPrimary: true },
      ],
    }
    expect(rematchProject(stored, discovered, () => true, ids()).id).toBe('proj-alpha')
  })

  it('reuses an orphaned Project when the repository moved but the grouping key matches', () => {
    const stored: StoredHubProject[] = [
      {
        id: 'proj-alpha',
        commonGitDir: '/old/alpha/.git',
        groupingKey: 'ssh://git@example/acme/alpha',
        name: 'alpha',
        worktrees: [{ id: 'wt-main', gitDir: '/old/alpha/.git' }],
      },
    ]
    const discovered: DiscoveredProject = {
      commonGitDir: '/new/alpha/.git',
      groupingKey: 'ssh://git@example/acme/alpha',
      name: 'alpha',
      worktrees: [
        { path: '/new/alpha', gitDir: '/new/alpha/.git', branch: 'main', isPrimary: true },
      ],
    }
    const rematched = rematchProject(
      stored,
      discovered,
      (commonGitDir) => commonGitDir === '/new/alpha/.git',
      ids(),
    )
    expect(rematched.id).toBe('proj-alpha')
    expect(rematched.commonGitDir).toBe('/new/alpha/.git')
    expect(rematched.worktrees[0]?.id).toBe('id-1')
  })

  it('does not collapse two live Environment-local records that share a grouping key', () => {
    const stored: StoredHubProject[] = [
      {
        id: 'proj-a',
        commonGitDir: '/a/.git',
        groupingKey: 'name:alpha',
        name: 'alpha',
        worktrees: [],
      },
      {
        id: 'proj-b',
        commonGitDir: '/b/.git',
        groupingKey: 'name:alpha',
        name: 'alpha',
        worktrees: [],
      },
    ]
    const discovered: DiscoveredProject = {
      commonGitDir: '/b/.git',
      groupingKey: 'name:alpha',
      name: 'alpha',
      worktrees: [],
    }
    expect(rematchProject(stored, discovered, () => true, ids()).id).toBe('proj-b')
  })

  it('names a Worktree from its checkout basename', () => {
    expect(worktreeDisplayName('/repos/alpha-worktrees/topic')).toBe('topic')
  })
})
