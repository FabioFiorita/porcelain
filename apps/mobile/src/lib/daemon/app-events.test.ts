import { appEventSchema, serverMessageSchema } from '@porcelain/contracts'
import { describe, expect, it } from 'vitest'

import { APP_EVENT_INVALIDATIONS } from './app-events'

describe('APP_EVENT_INVALIDATIONS', () => {
  it('maps every daemon app-event to at least one procedure name', () => {
    for (const event of appEventSchema.options) {
      expect(APP_EVENT_INVALIDATIONS[event].length).toBeGreaterThan(0)
    }
  })

  it('maps nothing the daemon never sends', () => {
    expect(Object.keys(APP_EVENT_INVALIDATIONS).sort()).toEqual([...appEventSchema.options].sort())
  })
})

describe('serverMessageSchema', () => {
  // One frame of each `t`: the socket is an external seam, and a shape this app cannot parse
  // must fail here rather than three renders later.
  const frames: readonly unknown[] = [
    { t: 'app-event', event: 'working-tree' },
    { t: 'terminal:data', id: 'a', data: 'hello' },
    { t: 'terminal:exit', id: 'a', exitCode: 0 },
    { t: 'terminal:created', reqId: 'r1', id: 'a' },
    {
      t: 'terminal:attached',
      reqId: 'r1',
      id: 'a',
      scrollback: '',
      status: 'running',
      found: true,
    },
  ]

  it.each(frames)('parses %j', (frame) => {
    expect(serverMessageSchema.safeParse(frame).success).toBe(true)
  })

  it('rejects an unknown frame kind', () => {
    expect(serverMessageSchema.safeParse({ t: 'terminal:teleport' }).success).toBe(false)
  })
})
