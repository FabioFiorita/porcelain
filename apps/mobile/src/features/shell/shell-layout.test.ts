import { describe, expect, it } from 'vitest'

import { HUB_SIDEBAR_WIDTH, SPLIT_MIN_WIDTH, decideShellLayout } from './shell-layout'

/**
 * The tablet shell's only decision, and the only part of it that can be checked without an iPad.
 *
 * Two of these cases are the ones that cost something when they are wrong: a window narrowed
 * live (Stage Manager, Split View) must fall back to one column rather than squeezing the
 * content column to nothing, and a sheet must not recompute the layout underneath itself.
 */
describe('decideShellLayout', () => {
  const wide = { width: SPLIT_MIN_WIDTH }
  const narrow = { width: SPLIT_MIN_WIDTH - 1 }

  it('gives a wide window the panels at every route, the way the web client does', () => {
    expect(decideShellLayout({ ...wide, pathname: '/' })).toBe('split')
    expect(decideShellLayout({ ...wide, pathname: '/worktree' })).toBe('split')
    expect(decideShellLayout({ ...wide, pathname: '/files' })).toBe('split')
    expect(decideShellLayout({ ...wide, pathname: '/file/src/app/index.tsx' })).toBe('split')
    // Group segments never reach `usePathname`, but a hand-joined segment list still lands here.
    expect(decideShellLayout({ ...wide, pathname: '/(hub)/' })).toBe('split')
  })

  it('does not strand the daemon-wide tabs on a phone layout', () => {
    // These four were `single` while the sidebar only appeared inside a Worktree, which is what
    // made an iPad show a phone screen in four of the five places you can stand.
    expect(decideShellLayout({ ...wide, pathname: '/terminals' })).toBe('split')
    expect(decideShellLayout({ ...wide, pathname: '/terminals/session-7' })).toBe('split')
    expect(decideShellLayout({ ...wide, pathname: '/tasks/12' })).toBe('split')
    expect(decideShellLayout({ ...wide, pathname: '/settings' })).toBe('split')
  })

  it('holds the layout a sheet was opened over', () => {
    expect(decideShellLayout({ ...wide, pathname: '/quick-open' })).toBe('unchanged')
    expect(decideShellLayout({ ...wide, pathname: '/companion' })).toBe('unchanged')
    expect(decideShellLayout({ ...wide, pathname: '/new-worktree' })).toBe('unchanged')
  })

  it('drops to one column the moment the window is too narrow, sheet or not', () => {
    expect(decideShellLayout({ ...narrow, pathname: '/files' })).toBe('single')
    expect(decideShellLayout({ ...narrow, pathname: '/worktree' })).toBe('single')
    // A window cannot make room for a sidebar just because a sheet is up.
    expect(decideShellLayout({ ...narrow, pathname: '/quick-open' })).toBe('single')
  })

  it('turns on exactly at the threshold', () => {
    expect(decideShellLayout({ pathname: '/worktree', width: SPLIT_MIN_WIDTH - 1 })).toBe('single')
    expect(decideShellLayout({ pathname: '/worktree', width: SPLIT_MIN_WIDTH })).toBe('split')
  })

  it('leaves the content column room to be a content column', () => {
    // The threshold is the sidebar plus the width a diff needs; if the sidebar grows without
    // the threshold growing, the split starts eating the column it exists to serve.
    expect(SPLIT_MIN_WIDTH - HUB_SIDEBAR_WIDTH).toBeGreaterThanOrEqual(440)
  })
})
