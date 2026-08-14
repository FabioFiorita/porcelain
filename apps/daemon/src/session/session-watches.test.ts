import {
  SESSION_WATCH_INTEREST_LIMIT,
  type SessionWatchesFrame,
  sessionWatchesFixtures,
  sessionWatchesFrameSchema,
} from '@porcelain/contracts/session'
import { mutableFixture } from '@porcelain/contracts/testing'
import { describe, expect, it, vi } from 'vitest'
import { createSessionWatchInterests, resolveSessionWatchInterests } from './session-watches'

const PROJECT = '/synthetic/repo'

function frame(overrides: Partial<SessionWatchesFrame> = {}): SessionWatchesFrame {
  return sessionWatchesFrameSchema.parse({
    ...sessionWatchesFixtures.empty,
    projectPath: PROJECT,
    ...overrides,
  })
}

function resolved(overrides: Partial<SessionWatchesFrame> = {}) {
  const outcome = resolveSessionWatchInterests(frame(overrides))
  if (!outcome.ok) throw new Error(`expected accepted interests, got ${outcome.error.code}`)
  return outcome.interests
}

function watchSinkSpy() {
  return {
    apply:
      vi.fn<
        (interests: {
          readonly projectPath: string
          readonly files: readonly string[]
          readonly dirs: readonly string[]
        }) => void
      >(),
    clear: vi.fn<() => void>(),
  }
}

describe('Session watch interests', () => {
  it('accepts the contract fixture as-is', () => {
    const interests = resolved(mutableFixture(sessionWatchesFixtures.watches))

    expect(interests.files).toEqual(['/synthetic/repo/src/open-document.ts'])
    expect(interests.dirs).toEqual(['/synthetic/repo/src'])
    expect(interests.rejected).toEqual([])
    expect(interests.droppedOverLimit).toBe(0)
  })

  it('canonicalizes and deduplicates equivalent paths', () => {
    const interests = resolved({
      files: [
        `${PROJECT}/src/a.ts`,
        `${PROJECT}/src/./a.ts`,
        `${PROJECT}/src/nested/../a.ts`,
        `${PROJECT}/src/b.ts`,
      ],
      dirs: [`${PROJECT}/src/`, `${PROJECT}/src`],
    })

    expect(interests.files).toEqual([`${PROJECT}/src/a.ts`, `${PROJECT}/src/b.ts`])
    expect(interests.dirs).toEqual([`${PROJECT}/src`])
  })

  it('keeps the project root itself as a watchable directory', () => {
    expect(resolved({ dirs: [PROJECT] }).dirs).toEqual([PROJECT])
  })

  it('keeps in-project names that begin with two dots', () => {
    expect(
      resolved({
        files: [`${PROJECT}/..foo`],
        dirs: [`${PROJECT}/..folder`],
      }),
    ).toMatchObject({
      files: [`${PROJECT}/..foo`],
      dirs: [`${PROJECT}/..folder`],
      rejected: [],
    })
  })

  it('rejects paths outside the declared project without expanding scope', () => {
    const interests = resolved({
      files: [`${PROJECT}/../elsewhere/secret.ts`, '/etc/shadow'],
      dirs: ['/synthetic/repo-other/src', `${PROJECT}/..`],
    })

    expect(interests.files).toEqual([])
    expect(interests.dirs).toEqual([])
    expect(interests.rejected.map((entry) => entry.reason)).toEqual([
      'outside-project',
      'outside-project',
      'outside-project',
      'outside-project',
    ])
  })

  it('rejects relative paths', () => {
    const interests = resolved({ files: ['src/a.ts'], dirs: ['./src'] })

    expect(interests.rejected).toEqual([
      { path: 'src/a.ts', reason: 'not-absolute' },
      { path: './src', reason: 'not-absolute' },
    ])
  })

  it('rejects a frame whose project path is not absolute', () => {
    expect(resolveSessionWatchInterests(frame({ projectPath: 'synthetic/repo' }))).toEqual({
      ok: false,
      error: { code: 'session.invalid-project-path', projectPath: 'synthetic/repo' },
    })
  })

  it('caps combined files and directories at the contract limit', () => {
    const files = Array.from({ length: 100 }, (_unused, index) => `${PROJECT}/src/f${index}.ts`)
    const dirs = Array.from({ length: 100 }, (_unused, index) => `${PROJECT}/src/d${index}`)

    const interests = resolved({ files, dirs })

    expect(interests.files).toHaveLength(100)
    expect(interests.dirs).toHaveLength(SESSION_WATCH_INTEREST_LIMIT - 100)
    expect(interests.files.length + interests.dirs.length).toBe(SESSION_WATCH_INTEREST_LIMIT)
    expect(interests.droppedOverLimit).toBe(200 - SESSION_WATCH_INTEREST_LIMIT)
  })

  it('drops directories entirely when files alone reach the limit', () => {
    const files = Array.from(
      { length: SESSION_WATCH_INTEREST_LIMIT + 10 },
      (_unused, index) => `${PROJECT}/src/f${index}.ts`,
    )

    const interests = resolved({ files, dirs: [`${PROJECT}/src`] })

    expect(interests.files).toHaveLength(SESSION_WATCH_INTEREST_LIMIT)
    expect(interests.dirs).toEqual([])
    expect(interests.droppedOverLimit).toBe(11)
  })

  it('applies accepted interests to the sink and reconciles on re-registration', () => {
    const sink = watchSinkSpy()
    const interests = createSessionWatchInterests(sink)

    interests.register(frame({ files: [`${PROJECT}/src/a.ts`], dirs: [`${PROJECT}/src`] }))
    expect(sink.apply).toHaveBeenLastCalledWith({
      projectPath: PROJECT,
      files: [`${PROJECT}/src/a.ts`],
      dirs: [`${PROJECT}/src`],
    })

    interests.register(frame({ files: [], dirs: [] }))
    expect(sink.apply).toHaveBeenLastCalledWith({
      projectPath: PROJECT,
      files: [],
      dirs: [],
    })
    expect(interests.current()?.files).toEqual([])
  })

  it('touches no watcher for a frame it cannot scope', () => {
    const sink = watchSinkSpy()
    const interests = createSessionWatchInterests(sink)

    const outcome = interests.register(frame({ projectPath: 'relative/repo' }))

    expect(outcome.ok).toBe(false)
    expect(sink.apply).not.toHaveBeenCalled()
    expect(interests.current()).toBeUndefined()
  })

  it('releases every watcher on close', () => {
    const sink = watchSinkSpy()
    const interests = createSessionWatchInterests(sink)
    interests.register(frame({ dirs: [`${PROJECT}/src`] }))

    interests.clear()
    interests.clear()

    expect(sink.clear).toHaveBeenCalledTimes(2)
    expect(interests.current()).toBeUndefined()
  })
})
