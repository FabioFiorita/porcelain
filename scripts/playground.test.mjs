#!/usr/bin/env node
/**
 * Fixture tests for the playground fleet.
 *
 * Every case runs against a temporary home; none of them touch the real
 * `~/code/porcelain-playground*` family. The generation cases assert the shape a fixture
 * claims to have — a `dirty` playground that generated clean would still open fine and
 * would silently prove nothing.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import {
  assertRemovable,
  createPlayground,
  fleetMemberPath,
  fleetRoot,
  listPlaygrounds,
  managedPlaygroundRoot,
  removePlayground,
  SHAPES,
} from './playground.mjs'

const PRIMARY = { slug: null }
const WORKTREE = { slug: 'fix-review' }

const homes = []
function sandbox() {
  const home = mkdtempSync(join(tmpdir(), 'porcelain-fleet-'))
  homes.push(home)
  return join(home, 'code', 'porcelain-playground')
}
after(() => {
  for (const home of homes) rmSync(home, { recursive: true, force: true })
})

// Never `.trim()` porcelain status: the first column is a space for unstaged changes, so
// trimming turns " M path" into "M path" and every leading-space assertion silently misses.
const status = (root) =>
  execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })

const statusLines = (root) => status(root).split('\n').filter(Boolean)

test('primary and worktree profiles resolve to the same managed root', () => {
  const primary = '/home/dev/code/porcelain-playground'
  const worktree = '/home/dev/code/porcelain-playgrounds/fix-review'
  assert.equal(managedPlaygroundRoot(primary), '/home/dev/code/porcelain-playgrounds')
  assert.equal(managedPlaygroundRoot(worktree), '/home/dev/code/porcelain-playgrounds')
})

test('profiles get separate fleet roots under a segment no worktree slug can take', () => {
  const primary = fleetRoot('/home/dev/code/porcelain-playground', PRIMARY)
  const worktree = fleetRoot('/home/dev/code/porcelain-playgrounds/fix-review', WORKTREE)
  assert.equal(primary, '/home/dev/code/porcelain-playgrounds/.fleet/primary')
  assert.equal(worktree, '/home/dev/code/porcelain-playgrounds/.fleet/fix-review')
  assert.notEqual(primary, worktree)
  // A managed worktree slug must start with [a-z0-9], so `.fleet` can never be one.
  assert.match('.fleet', /^\./)
})

test('member names are validated before they become paths', () => {
  assert.throws(() => fleetMemberPath('../escape'), /invalid playground name/)
  assert.throws(() => fleetMemberPath('Has-Caps'), /invalid playground name/)
  assert.throws(() => fleetMemberPath(''), /invalid playground name/)
})

test('removal refuses anything that is not a direct fleet member', () => {
  const root = '/home/dev/code/porcelain-playgrounds/.fleet/primary'
  assert.equal(assertRemovable(`${root}/dirty`, root), `${root}/dirty`)
  assert.throws(() => assertRemovable(root, root), /refusing to remove/)
  assert.throws(() => assertRemovable(`${root}/nested/deep`, root), /refusing to remove/)
  assert.throws(() => assertRemovable('/home/dev/code/porcelain', root), /refusing to remove/)
})

test('clean shape commits everything it generates', () => {
  const root = createPlayground('clean', 'clean', sandbox(), PRIMARY)
  assert.equal(status(root), '')
})

test('dirty shape leaves modified and untracked files', () => {
  const root = createPlayground('dirty', 'dirty', sandbox(), PRIMARY)
  const lines = statusLines(root)
  assert.ok(lines.some((line) => line.startsWith(' M src/greeting.ts')))
  assert.ok(lines.some((line) => line.startsWith('?? src/pending.ts')))
})

test('staged shape splits staged from unstaged', () => {
  const root = createPlayground('staged', 'staged', sandbox(), PRIMARY)
  const lines = statusLines(root)
  assert.ok(lines.some((line) => line.startsWith('A  src/staged.ts')))
  assert.ok(lines.some((line) => line.startsWith(' M src/greeting.ts')))
})

test('conflicted shape stops inside an unresolved merge', () => {
  const root = createPlayground('conflicted', 'conflicted', sandbox(), PRIMARY)
  assert.ok(existsSync(join(root, '.git', 'MERGE_HEAD')), 'expected a merge in progress')
  assert.match(status(root), /^(UU|AA) src\/greeting\.ts$/m)
})

test('history shape produces a deep log and a second branch', () => {
  const root = createPlayground('history', 'history', sandbox(), PRIMARY)
  const log = execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: root, encoding: 'utf8' })
  assert.ok(Number(log.trim()) >= 13, `expected a deep history, got ${log.trim()}`)
  const branches = execFileSync('git', ['branch', '--list'], { cwd: root, encoding: 'utf8' })
  assert.match(branches, /work\/in-progress/)
})

test('generated history is byte-identical across runs', () => {
  const head = (playground) => {
    const root = createPlayground('clean', 'clean', playground, PRIMARY)
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  }
  assert.equal(head(sandbox()), head(sandbox()))
})

test('every declared shape generates and lists', () => {
  const playground = sandbox()
  for (const shape of Object.keys(SHAPES)) createPlayground(shape, shape, playground, PRIMARY)
  const listed = listPlaygrounds(playground, PRIMARY).map((entry) => entry.slug)
  for (const shape of Object.keys(SHAPES)) assert.ok(listed.includes(shape), `missing ${shape}`)
})

test('a second member can be added and removed independently', () => {
  const playground = sandbox()
  createPlayground('clean', 'first', playground, PRIMARY)
  createPlayground('dirty', 'second', playground, PRIMARY)
  assert.deepEqual(
    listPlaygrounds(playground, PRIMARY).map((entry) => entry.slug),
    ['first', 'second'],
  )
  removePlayground('first', playground, PRIMARY)
  assert.deepEqual(
    listPlaygrounds(playground, PRIMARY).map((entry) => entry.slug),
    ['second'],
  )
})

test('creating over an existing member fails instead of merging into it', () => {
  const playground = sandbox()
  createPlayground('clean', 'taken', playground, PRIMARY)
  assert.throws(() => createPlayground('dirty', 'taken', playground, PRIMARY), /already exists/)
})

test('an unknown shape leaves nothing behind', () => {
  const playground = sandbox()
  assert.throws(() => createPlayground('nonsense', 'nope', playground, PRIMARY), /unknown shape/)
  assert.equal(existsSync(fleetMemberPath('nope', playground, PRIMARY)), false)
})
