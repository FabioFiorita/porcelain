import {
  type HubInventory,
  hubInventorySchema,
  projectsContractFixtures,
} from '@porcelain/contracts/projects'
import { describe, expect, it } from 'vitest'
import { groupEquivalentProjects, visibleHubInventories } from './hub-grouping'

const alpha: HubInventory = hubInventorySchema.parse(projectsContractFixtures.hubInventory.output)
const alphaProject = alpha.projects[0]
if (alphaProject === undefined) throw new Error('expected Hub inventory fixture project')
const alphaPrimary = alphaProject.worktrees[0]
if (alphaPrimary === undefined) throw new Error('expected Hub inventory fixture worktree')
const macInventory: HubInventory = {
  environment: {
    id: 'env-mac',
    name: 'mac',
    host: 'mac',
    platform: 'darwin',
    arch: 'arm64',
  },
  projects: [
    {
      ...alphaProject,
      id: 'proj-alpha-mac',
      environmentId: 'env-mac',
      path: '/Users/me/alpha',
      worktrees: [
        {
          ...alphaPrimary,
          id: 'wt-mac-main',
          projectId: 'proj-alpha-mac',
          path: '/Users/me/alpha',
        },
      ],
    },
  ],
}

describe('Hub inventory grouping', () => {
  it('omits offline Environments and their stale children', () => {
    expect(
      visibleHubInventories([
        { online: true, inventory: alpha },
        { online: false, inventory: macInventory },
        { online: true, inventory: null },
      ]),
    ).toEqual([alpha])
  })

  it('groups equivalent Projects without conflating Environment-local records', () => {
    const groups = groupEquivalentProjects([alpha, macInventory])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.groupingKey).toBe(alphaProject.groupingKey)
    expect(groups[0]?.members.map((member) => member.project.id)).toEqual([
      'proj-alpha',
      'proj-alpha-mac',
    ])
    expect(groups[0]?.members.map((member) => member.environment.id)).toEqual([
      'env-synthetic',
      'env-mac',
    ])
    expect(groups[0]?.members[0]?.project).not.toBe(groups[0]?.members[1]?.project)
  })
})
