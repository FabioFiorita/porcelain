import { devServersQuery } from '@porcelain/client-runtime/terminal'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import {
  devServersQueryKey,
  devServersQueryKeySchema,
  invalidateDevServerQueries,
} from './dev-server-query-key'

const DAEMON = { host: 'beelink', version: '0.52.1' }
const TARGET = { projectId: 'project-1', worktreeId: 'worktree-1' }
const OTHER = { projectId: 'project-1', worktreeId: 'worktree-2' }

describe('development server cache keys', () => {
  it('is an identity + daemon scope tuple, never a procedure name', () => {
    const key = devServersQueryKey(DAEMON, devServersQuery(TARGET))

    expect(devServersQueryKeySchema.safeParse(key).success).toBe(true)
    expect(key[0]).toEqual(devServersQuery(TARGET))
    expect(key[1]).toEqual(DAEMON)
    expect(devServersQueryKeySchema.safeParse(['devServers', DAEMON]).success).toBe(false)
  })

  it('invalidates the named Worktree row and leaves its sibling alone', async () => {
    const client = new QueryClient()
    const mine = devServersQueryKey(DAEMON, devServersQuery(TARGET))
    const theirs = devServersQueryKey(DAEMON, devServersQuery(OTHER))
    client.setQueryData(mine, [])
    client.setQueryData(theirs, [])

    await invalidateDevServerQueries(client, DAEMON, [devServersQuery(TARGET)])

    expect(client.getQueryState(mine)?.isInvalidated).toBe(true)
    expect(client.getQueryState(theirs)?.isInvalidated).toBe(false)
  })

  it('separates the same Worktree across two daemons', () => {
    expect(devServersQueryKey(DAEMON, devServersQuery(TARGET))).not.toEqual(
      devServersQueryKey({ host: 'mac', version: '0.52.1' }, devServersQuery(TARGET)),
    )
  })
})
