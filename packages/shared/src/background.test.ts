import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type BackgroundReason,
  runUserAction,
  setBackgroundObserver,
  settleBackground,
  setUserActionReporter,
  type UserActionBoundaryPhase,
} from './background'

async function flushMicrotasks(times = 4): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve()
}

describe('settleBackground', () => {
  afterEach(() => {
    setBackgroundObserver(null)
  })

  it('absorbs rejection without becoming unhandled', async () => {
    // `expect(true).toBe(true)` stood here and could not fail, so nothing proved the catch was
    // ever attached. Listen on `process`, not `window`: jsdom never bridges Node's unhandled
    // rejection detection to the DOM event, so a window listener silently observes nothing.
    // Detection also lands a macrotask later than the rejection, hence the timer flush.
    const escaped: unknown[] = []
    const onUnhandled = (error: unknown): void => {
      escaped.push(error)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      settleBackground(Promise.reject(new Error('boom')), 'invalidation')
      await flushMicrotasks()
      await new Promise((resolve) => setTimeout(resolve, 0))
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
    expect(escaped).toEqual([])
  })

  it('leaves fulfilled promises settled', async () => {
    let done = false
    settleBackground(
      Promise.resolve().then(() => {
        done = true
      }),
      'notification',
    )
    await flushMicrotasks()
    expect(done).toBe(true)
  })

  it('hands the rejection and its reason to the observer', async () => {
    const seen: { reason: BackgroundReason; error: unknown }[] = []
    setBackgroundObserver((reason, error) => {
      seen.push({ reason, error })
    })
    const boom = new Error('stale')
    settleBackground(Promise.reject(boom), 'teardown')
    await flushMicrotasks()
    expect(seen).toEqual([{ reason: 'teardown', error: boom }])
  })

  it('never reports a fulfilled promise', async () => {
    const observer = vi.fn()
    setBackgroundObserver(observer)
    settleBackground(Promise.resolve('fine'), 'watcher')
    await flushMicrotasks()
    expect(observer).not.toHaveBeenCalled()
  })

  it('survives an observer that throws', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    setBackgroundObserver(() => {
      throw new Error('logger down')
    })
    settleBackground(Promise.reject(new Error('boom')), 'lifecycle')
    await flushMicrotasks()
    process.off('unhandledRejection', onUnhandled)
    expect(unhandled).toEqual([])
  })
})

describe('runUserAction', () => {
  afterEach(() => {
    setUserActionReporter(null)
  })

  it('routes rejection to onError exactly once (never unhandled)', async () => {
    const onError = vi.fn()
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      runUserAction(() => Promise.reject(new Error('user fail')), onError)
      await flushMicrotasks()
      expect(onError).toHaveBeenCalledOnce()
      expect(onError.mock.calls[0]?.[0]).toMatchObject({ message: 'user fail' })
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('routes Promise.reject(undefined) to onError exactly once then onSettled', async () => {
    const order: string[] = []
    const onError = vi.fn((error: unknown) => {
      order.push('error')
      expect(error).toBeUndefined()
    })
    const onSettled = vi.fn(() => {
      order.push('settled')
    })
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      runUserAction(() => Promise.reject(undefined), onError, onSettled)
      await flushMicrotasks(8)
      expect(onError).toHaveBeenCalledOnce()
      expect(onSettled).toHaveBeenCalledOnce()
      expect(order).toEqual(['error', 'settled'])
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('routes sync work throw to onError and still runs onSettled', async () => {
    const order: string[] = []
    runUserAction(
      () => {
        throw new Error('sync boom')
      },
      () => {
        order.push('error')
      },
      () => {
        order.push('settled')
      },
    )
    await flushMicrotasks()
    expect(order).toEqual(['error', 'settled'])
  })

  it('runs onSettled after success and after failure, exactly once each path', async () => {
    const settled = vi.fn()
    runUserAction(
      () => Promise.resolve('ok'),
      (error) => {
        throw new Error(`unexpected error path: ${String(error)}`)
      },
      settled,
    )
    await flushMicrotasks()
    expect(settled).toHaveBeenCalledOnce()

    settled.mockClear()
    runUserAction(
      () => Promise.reject(new Error('x')),
      () => undefined,
      settled,
    )
    await flushMicrotasks()
    expect(settled).toHaveBeenCalledOnce()
  })

  it('orders onError before onSettled on rejection', async () => {
    const order: string[] = []
    runUserAction(
      () => Promise.reject(new Error('x')),
      () => {
        order.push('error')
      },
      () => {
        order.push('settled')
      },
    )
    await flushMicrotasks()
    expect(order).toEqual(['error', 'settled'])
  })

  it('awaits async onError completion before starting onSettled', async () => {
    const order: string[] = []
    let releaseError!: () => void
    const errorGate = new Promise<void>((resolve) => {
      releaseError = resolve
    })

    runUserAction(
      () => Promise.reject(new Error('work')),
      async () => {
        order.push('error-start')
        await errorGate
        order.push('error-end')
      },
      () => {
        order.push('settled')
      },
    )

    await flushMicrotasks(8)
    expect(order).toEqual(['error-start'])
    releaseError()
    await flushMicrotasks(8)
    expect(order).toEqual(['error-start', 'error-end', 'settled'])
  })

  it('reports throwing onError without unhandledRejection and still settles', async () => {
    const reports: Array<{ phase: UserActionBoundaryPhase; message: string }> = []
    setUserActionReporter((error, phase) => {
      reports.push({
        phase,
        message: error instanceof Error ? error.message : String(error),
      })
    })
    const settled = vi.fn()
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      runUserAction(
        () => Promise.reject(new Error('work')),
        () => {
          throw new Error('handler boom')
        },
        settled,
      )
      await flushMicrotasks()
      expect(reports).toEqual([{ phase: 'onError', message: 'handler boom' }])
      expect(settled).toHaveBeenCalledOnce()
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('reports rejecting async onError without unhandledRejection', async () => {
    const reports: Array<{ phase: UserActionBoundaryPhase; message: string }> = []
    setUserActionReporter((error, phase) => {
      reports.push({
        phase,
        message: error instanceof Error ? error.message : String(error),
      })
    })
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      runUserAction(
        () => Promise.reject(new Error('work')),
        async () => {
          throw new Error('async handler boom')
        },
      )
      await flushMicrotasks(8)
      expect(reports).toEqual([{ phase: 'onError', message: 'async handler boom' }])
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('reports throwing onSettled without unhandledRejection', async () => {
    const reports: Array<{ phase: UserActionBoundaryPhase; message: string }> = []
    setUserActionReporter((error, phase) => {
      reports.push({
        phase,
        message: error instanceof Error ? error.message : String(error),
      })
    })
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      runUserAction(
        () => Promise.resolve('ok'),
        () => undefined,
        () => {
          throw new Error('settled boom')
        },
      )
      await flushMicrotasks()
      expect(reports).toEqual([{ phase: 'onSettled', message: 'settled boom' }])
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('reports rejecting async onSettled without unhandledRejection', async () => {
    const reports: Array<{ phase: UserActionBoundaryPhase; message: string }> = []
    setUserActionReporter((error, phase) => {
      reports.push({
        phase,
        message: error instanceof Error ? error.message : String(error),
      })
    })
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      runUserAction(
        () => Promise.resolve('ok'),
        () => undefined,
        async () => {
          await Promise.reject(new Error('async settled boom'))
        },
      )
      await flushMicrotasks(8)
      expect(reports).toEqual([{ phase: 'onSettled', message: 'async settled boom' }])
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('guards a throwing userActionReporter via last-resort console (no unhandledRejection)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    setUserActionReporter(() => {
      throw new Error('reporter boom')
    })
    const settled = vi.fn()
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      runUserAction(
        () => Promise.reject(new Error('work')),
        () => {
          throw new Error('handler boom')
        },
        settled,
      )
      await flushMicrotasks(8)
      expect(settled).toHaveBeenCalledOnce()
      expect(unhandled).toEqual([])
      expect(
        consoleError.mock.calls.some(
          (call) =>
            typeof call[0] === 'string' &&
            call[0].includes('[runUserAction]') &&
            call[0].includes('reporter failed'),
        ),
      ).toBe(true)
    } finally {
      process.off('unhandledRejection', onUnhandled)
      consoleError.mockRestore()
    }
  })

  it('guards a rejecting userActionReporter via last-resort console (no unhandledRejection)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    setUserActionReporter(async () => {
      throw new Error('async reporter boom')
    })
    const settled = vi.fn()
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      runUserAction(
        () => Promise.reject(new Error('work')),
        async () => {
          throw new Error('handler boom')
        },
        settled,
      )
      await flushMicrotasks(12)
      expect(settled).toHaveBeenCalledOnce()
      expect(unhandled).toEqual([])
      expect(
        consoleError.mock.calls.some(
          (call) =>
            typeof call[0] === 'string' &&
            call[0].includes('[runUserAction]') &&
            call[0].includes('reporter failed'),
        ),
      ).toBe(true)
    } finally {
      process.off('unhandledRejection', onUnhandled)
      consoleError.mockRestore()
    }
  })

  it('returns void from the UI edge (never a Promise)', () => {
    const result = runUserAction(
      () => Promise.resolve(),
      () => undefined,
    )
    expect(result).toBeUndefined()
  })
})
