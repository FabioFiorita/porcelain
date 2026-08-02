import { describe, expect, it } from 'vitest'

import {
  gitBranchesQuery,
  gitCheckoutMutation,
  gitWorktreesQuery,
  WORKSPACE_CHECKOUT_INVALIDATIONS,
} from './workspace'

describe('workspace context procedures', () => {
  it('parses local and remote branch references', () => {
    expect(
      gitBranchesQuery.output.parse([
        { name: 'main', remote: null },
        { name: 'feature/mobile', remote: 'origin' },
      ]),
    ).toEqual([
      { name: 'main', remote: null },
      { name: 'feature/mobile', remote: 'origin' },
    ])
  })

  it('parses worktree identity and the checkout mutation seam', () => {
    expect(gitWorktreesQuery.output.parse([{ branch: 'main', path: '/code/porcelain' }])).toEqual([
      { branch: 'main', path: '/code/porcelain' },
    ])
    expect(gitCheckoutMutation.name).toBe('gitCheckout')
    expect(WORKSPACE_CHECKOUT_INVALIDATIONS).toContain('gitFlow')
    expect(WORKSPACE_CHECKOUT_INVALIDATIONS).toContain('gitWorktrees')
  })
})
