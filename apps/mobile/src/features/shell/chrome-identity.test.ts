import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The ratchet on this client's identity, and it is here because the mistake was made twice.
 *
 * Twice the mobile app was moved toward the platform's own chrome — `NativeTabs` for the tab
 * bar, `UINavigationBar` for every title, `UISearchController` for the boards' filter,
 * `UISegmentedControl` for every scope switcher — on the reasoning that chrome is the one thing
 * an app should take from the system. Twice the result was rejected for the same reason: a
 * native control is drawn by UIKit from the system's palette, type and radii, so it cannot be
 * told about `--muted`, `--radius` or the theme the human pinned, and a screen with one of them
 * in it reads as two apps stacked on each other. Porcelain's identity is the web client's, it
 * lives in `packages/ui/src/tokens.css`, and both clients paint from it.
 *
 * A cleanup nothing prevents from regrowing is not a cleanup, so:
 *
 *   - **No `@expo/ui`, anywhere.** There is no quarantine any more: the last two — a bottom
 *     sheet's presentation and a long-press context menu — are `@rn-primitives` now, the same
 *     primitives the web client's Dialog and ContextMenu are built on, so both clients draw
 *     from one set of tokens. The dependency is gone from `package.json`; this keeps it gone.
 *   - **No native header options.** A screen that declares `title`, `headerRight` or
 *     `headerLargeTitle` is asking for a bar this app does not draw. `ScreenHeader` is the bar.
 *
 * Neither rule is a style preference. Each names a thing that shipped and had to be taken back
 * out.
 */

const SRC = join(__dirname, '..', '..')

/**
 * Header options a native bar would draw. `headerShown` is deliberately absent — a layout
 * turning the bar OFF is the rule, not a violation of it.
 */
const NATIVE_HEADER_OPTIONS = [
  'headerLargeTitle',
  'headerRight:',
  'headerLeft:',
  'headerSearchBarOptions',
  'headerBackButtonDisplayMode',
]

/**
 * The file with its comments removed.
 *
 * Both rules name the thing they forbid, and this file's own prose names all of them — so does
 * every comment explaining why a bar was replaced. A ratchet that fires on the explanation for
 * itself teaches people to stop writing explanations.
 */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return entry.endsWith('.tsx') || entry.endsWith('.ts') ? [path] : []
  })
}

/** Every source file that is not a test. */
function shippedFiles(): string[] {
  return sourceFiles(SRC).filter((path) => !path.includes('.test.'))
}

describe('chrome identity', () => {
  it('keeps `@expo/ui` out of the client entirely', () => {
    const offenders = shippedFiles().filter((path) => code(path).includes('@expo/ui'))
    expect(offenders).toEqual([])
  })

  it('declares no native header options — `ScreenHeader` is the bar', () => {
    const offenders = shippedFiles().flatMap((path) => {
      const source = code(path)
      return NATIVE_HEADER_OPTIONS.filter((option) => source.includes(option)).map(
        (option) => `${path}: ${option}`,
      )
    })
    expect(offenders).toEqual([])
  })
})
