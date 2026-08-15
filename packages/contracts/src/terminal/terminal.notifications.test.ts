import { describe, expect, it } from 'vitest'
import { sessionChangeSchema } from '../session/session.contract'
import {
  TERMINAL_CHANGE_KINDS,
  terminalChangeSchema,
  terminalNotificationFixtures,
} from './terminal.notifications'

const CHANGED = terminalNotificationFixtures['terminal.dev-servers-changed']

describe('Terminal change notifications', () => {
  it('covers exactly the declared change categories', () => {
    expect(terminalChangeSchema.options.map((option) => option.shape.kind.value)).toEqual([
      ...TERMINAL_CHANGE_KINDS,
    ])
    expect(Object.keys(terminalNotificationFixtures)).toEqual([...TERMINAL_CHANGE_KINDS])
  })

  it('is carried by the cross-domain session envelope', () => {
    expect(sessionChangeSchema.parse(CHANGED)).toEqual(CHANGED)
  })

  it('requires the routing path and the Worktree identity together', () => {
    for (const field of ['projectPath', 'projectId', 'worktreeId'] as const) {
      const { [field]: _dropped, ...partial } = CHANGED
      expect(terminalChangeSchema.safeParse(partial).success).toBe(false)
      expect(terminalChangeSchema.safeParse({ ...CHANGED, [field]: '' }).success).toBe(false)
    }
  })

  it('carries no entity payload — the roster query is the source of truth', () => {
    expect(terminalChangeSchema.safeParse({ ...CHANGED, servers: [] }).success).toBe(false)
  })

  it('rejects a generic terminal changed kind', () => {
    expect(terminalChangeSchema.safeParse({ ...CHANGED, kind: 'terminal.changed' }).success).toBe(
      false,
    )
  })
})
