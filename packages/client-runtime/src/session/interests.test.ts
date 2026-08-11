import {
  SESSION_WATCH_INTEREST_LIMIT,
  sessionWatchesFrameSchema,
} from '@porcelain/contracts/session'
import { describe, expect, it } from 'vitest'
import { boundWatchInterests, createWatchInterestRegistry, watchesFrameFor } from './interests'

const PROJECT = '/synthetic/repo'

describe('Watch interest registry', () => {
  it('merges every holder into one desired set', () => {
    const registry = createWatchInterestRegistry()
    registry.register({ files: [`${PROJECT}/src/a.ts`], dirs: [`${PROJECT}/src`] })
    registry.register({ files: [`${PROJECT}/src/b.ts`], dirs: [`${PROJECT}/docs`] })

    expect(registry.desired()).toEqual({
      files: [`${PROJECT}/src/a.ts`, `${PROJECT}/src/b.ts`],
      dirs: [`${PROJECT}/src`, `${PROJECT}/docs`],
      droppedOverLimit: 0,
    })
    expect(registry.registrationCount()).toBe(2)
  })

  it('deduplicates a path two holders declare, in first-declared order', () => {
    const registry = createWatchInterestRegistry()
    registry.register({ files: [`${PROJECT}/src/a.ts`], dirs: [] })
    registry.register({ files: [`${PROJECT}/src/a.ts`, `${PROJECT}/src/b.ts`], dirs: [] })

    expect(registry.desired().files).toEqual([`${PROJECT}/src/a.ts`, `${PROJECT}/src/b.ts`])
  })

  it('keeps an interest another holder still wants when one holder releases', () => {
    const registry = createWatchInterestRegistry()
    const first = registry.register({ files: [`${PROJECT}/src/a.ts`], dirs: [] })
    registry.register({ files: [`${PROJECT}/src/a.ts`], dirs: [] })

    first.release()

    expect(registry.registrationCount()).toBe(1)
    expect(registry.desired().files).toEqual([`${PROJECT}/src/a.ts`])
  })

  it('drops an interest once its last holder releases, and release is idempotent', () => {
    const registry = createWatchInterestRegistry()
    const only = registry.register({ files: [`${PROJECT}/src/a.ts`], dirs: [`${PROJECT}/src`] })

    only.release()
    only.release()

    expect(registry.registrationCount()).toBe(0)
    expect(registry.desired()).toEqual({ files: [], dirs: [], droppedOverLimit: 0 })
  })

  it('ignores a holder mutating the array it registered', () => {
    const registry = createWatchInterestRegistry()
    const files = [`${PROJECT}/src/a.ts`]
    registry.register({ files, dirs: [] })

    files.push(`${PROJECT}/src/sneaked.ts`)

    expect(registry.desired().files).toEqual([`${PROJECT}/src/a.ts`])
  })
})

describe('Watch interest bounding', () => {
  it('keeps the first interests up to the contract ceiling and reports the rest as dropped', () => {
    const files = Array.from(
      { length: SESSION_WATCH_INTEREST_LIMIT + 10 },
      (_, index) => `${PROJECT}/file-${index}.ts`,
    )

    const bounded = boundWatchInterests([{ files, dirs: [`${PROJECT}/src`] }])

    expect(bounded.files).toEqual(files.slice(0, SESSION_WATCH_INTEREST_LIMIT))
    expect(bounded.dirs).toEqual([])
    expect(bounded.droppedOverLimit).toBe(11)
    expect(bounded.files.length + bounded.dirs.length).toBe(SESSION_WATCH_INTEREST_LIMIT)
  })

  it('spends the remaining budget on directories after files', () => {
    const files = Array.from({ length: 100 }, (_, index) => `${PROJECT}/file-${index}.ts`)
    const dirs = Array.from({ length: 100 }, (_, index) => `${PROJECT}/dir-${index}`)

    const bounded = boundWatchInterests([{ files, dirs }])

    expect(bounded.files).toHaveLength(100)
    expect(bounded.dirs).toEqual(dirs.slice(0, SESSION_WATCH_INTEREST_LIMIT - 100))
    expect(bounded.droppedOverLimit).toBe(200 - SESSION_WATCH_INTEREST_LIMIT)
  })

  it('bounds the combined set across separate holders', () => {
    const registry = createWatchInterestRegistry()
    for (let holder = 0; holder < 4; holder += 1) {
      registry.register({
        files: Array.from({ length: 40 }, (_, index) => `${PROJECT}/h${holder}-file-${index}.ts`),
        dirs: [],
      })
    }

    const desired = registry.desired()

    expect(desired.files).toHaveLength(SESSION_WATCH_INTEREST_LIMIT)
    expect(desired.droppedOverLimit).toBe(160 - SESSION_WATCH_INTEREST_LIMIT)
  })
})

describe('Watch registration frame', () => {
  it('builds a frame the session contract accepts', () => {
    const frame = watchesFrameFor({
      projectPath: PROJECT,
      interests: { files: [`${PROJECT}/src/a.ts`], dirs: [`${PROJECT}/src`], droppedOverLimit: 0 },
    })

    expect(sessionWatchesFrameSchema.parse(frame)).toEqual({
      t: 'session:watches',
      projectPath: PROJECT,
      files: [`${PROJECT}/src/a.ts`],
      dirs: [`${PROJECT}/src`],
    })
  })

  it('builds an empty frame, which is how a session clears its interests', () => {
    expect(
      watchesFrameFor({
        projectPath: PROJECT,
        interests: { files: [], dirs: [], droppedOverLimit: 0 },
      }),
    ).toEqual({ t: 'session:watches', projectPath: PROJECT, files: [], dirs: [] })
  })

  it('never submits more than the daemon accepts', () => {
    const frame = watchesFrameFor({
      projectPath: PROJECT,
      interests: boundWatchInterests([
        {
          files: Array.from({ length: 500 }, (_, index) => `${PROJECT}/file-${index}.ts`),
          dirs: Array.from({ length: 500 }, (_, index) => `${PROJECT}/dir-${index}`),
        },
      ]),
    })

    expect(frame.files.length + frame.dirs.length).toBe(SESSION_WATCH_INTEREST_LIMIT)
  })
})
