import { actionsContractFixtures } from '@porcelain/contracts/actions'
import type { hubInventoryQuery } from '@porcelain/client-runtime/projects'
import type { HubInventory } from '@porcelain/contracts/projects'

import { hubInventoryKey as sharedHubInventoryKey } from '@/features/projects/hub-target'

/**
 * Mobile Actions test support.
 *
 * Actions are keyed by the stable Project id, and the phone only knows a checkout path,
 * so every Actions hook first reads the Hub inventory to resolve the active path into an
 * Environment + Project + Worktree target. These are the synthetic inventory rows the
 * feature tests resolve against — one Project with two checkouts, plus a second Project
 * whose worktree must never be picked.
 */

export const ENV_ID = 'env-actions-test'
export const PROJECT_ID = actionsContractFixtures.actions.input.projectId
const WORKTREE_ID = 'wt-alpha-main'
export const REPO_PATH = '/synthetic/projects/alpha'
export const SECOND_WORKTREE_ID = 'wt-alpha-review'
export const SECOND_REPO_PATH = '/synthetic/projects/alpha-review'
export const OTHER_PROJECT_ID = 'proj-beta'
export const UNKNOWN_PATH = '/synthetic/not-in-the-hub'

const HUB_INVENTORY: HubInventory = {
  environment: {
    id: ENV_ID,
    name: 'synthetic',
    host: 'synthetic-host',
    platform: 'linux',
    arch: 'x64',
  },
  projects: [
    {
      id: OTHER_PROJECT_ID,
      environmentId: ENV_ID,
      name: 'beta',
      groupingKey: 'beta',
      path: '/synthetic/projects/beta',
      worktrees: [
        {
          id: 'wt-beta-main',
          projectId: OTHER_PROJECT_ID,
          path: '/synthetic/projects/beta',
          name: 'beta',
          branch: 'main',
          isPrimary: true,
        },
      ],
    },
    {
      id: PROJECT_ID,
      environmentId: ENV_ID,
      name: 'alpha',
      groupingKey: 'alpha',
      path: REPO_PATH,
      worktrees: [
        {
          id: WORKTREE_ID,
          projectId: PROJECT_ID,
          path: REPO_PATH,
          name: 'alpha',
          branch: 'main',
          isPrimary: true,
        },
        {
          id: SECOND_WORKTREE_ID,
          projectId: PROJECT_ID,
          path: SECOND_REPO_PATH,
          name: 'alpha-review',
          branch: 'work/review',
          isPrimary: false,
        },
      ],
    },
  ],
}

/** The cache key `useActionsTarget` reads the Hub inventory under. */
export function hubInventoryKey(
  environmentId: string,
): readonly ['daemon', string, ReturnType<typeof hubInventoryQuery>] {
  return sharedHubInventoryKey(environmentId)
}

/**
 * Route a mocked `callDaemon` by procedure name: the Hub inventory always answers, and
 * the rest of the table is whatever the test under proof configured.
 */
export function daemonDispatch(
  handlers: Readonly<Record<string, (input: unknown) => unknown>>,
): (client: unknown, procedure: { readonly name: string }, input: unknown) => Promise<unknown> {
  return (_client, procedure, input) => {
    if (procedure.name === 'hubInventory') return Promise.resolve(HUB_INVENTORY)
    const handler = handlers[procedure.name]
    if (handler === undefined) {
      return Promise.reject(new Error(`unexpected procedure ${procedure.name}`))
    }
    return Promise.resolve(handler(input))
  }
}
