#!/usr/bin/env node
/**
 * Shape tests for the dev seeder. No daemon is contacted — these pin the declarations a
 * re-run depends on, which is where the silent bugs live: a scenario that writes state the
 * purge cannot reclaim looks fine once and duplicates forever after.
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  ACTION_SHAPES,
  SCENARIOS,
  SEED_TAG,
  SEEDED_ACTION_TITLES,
  SEEDED_ACTIONS,
  SEEDED_REVIEWS,
  SEEDED_SCOPES,
} from './dev-seed.mjs'
import { createPlayground, SHAPES } from './playground.mjs'

/** Build one shape in a throwaway fleet so a declared path can be checked against real bytes. */
function buildShape(shape) {
  const home = mkdtempSync(join(tmpdir(), 'porcelain-seed-shapes-'))
  const playground = join(home, 'porcelain-playgrounds', shape)
  return {
    path: createPlayground(shape, shape, playground, { slug: 'seed-test' }),
    cleanup: () => rmSync(home, { recursive: true, force: true }),
  }
}

test('every scenario is runnable and describes itself', () => {
  assert.ok(Object.keys(SCENARIOS).length > 0)
  for (const [name, scenario] of Object.entries(SCENARIOS)) {
    assert.equal(typeof scenario.run, 'function', `${name} has no run`)
    assert.ok((scenario.summary ?? '').length > 0, `${name} has no summary`)
  }
})

test('the documented default scenario exists', () => {
  // `pnpm dev:seed` with no argument resolves to this one.
  assert.ok('one-review' in SCENARIOS)
})

test('every seeded Action is reclaimable by the purge', () => {
  // The drift this prevents: a new Action added to the write list but not the purge list,
  // so each re-run stacks another copy on the project.
  for (const action of SEEDED_ACTIONS) {
    assert.ok(SEEDED_ACTION_TITLES.has(action.title), `${action.title} is not purged`)
    assert.ok(action.command.length > 0, `${action.title} has no command`)
  }
  assert.equal(SEEDED_ACTION_TITLES.size, SEEDED_ACTIONS.length, 'duplicate Action titles')
})

test('the everything scenario only names shapes the fleet can build', () => {
  // A shape name that no longer exists would take the whole scenario down at run time,
  // after it had already written half the state.
  const known = new Set(Object.keys(SHAPES))
  for (const shape of [
    ...SEEDED_REVIEWS.map((entry) => entry.shape),
    ...SEEDED_SCOPES.map((entry) => entry.shape),
    ...ACTION_SHAPES,
  ]) {
    assert.ok(known.has(shape), `${shape} is not a playground shape`)
  }
  assert.equal(new Set(SEEDED_REVIEWS.map((entry) => entry.title)).size, SEEDED_REVIEWS.length)
})

test('every path the seed pins, hides or reviews exists in its fixture', () => {
  // The silent failure this catches: a pin or an anchor on a path the shape never writes.
  // The daemon accepts it, the tree renders, and the state the seed claims to have made is
  // simply absent — nothing anywhere reports it.
  const declarations = new Map()
  for (const { shape, pinned = [], hidden = [] } of SEEDED_SCOPES) {
    declarations.set(shape, [...(declarations.get(shape) ?? []), ...pinned, ...hidden])
  }
  for (const { shape, review } of SEEDED_REVIEWS) {
    const anchors = review.sections.flatMap((section) =>
      (section.anchors ?? []).map((anchor) => anchor.path),
    )
    declarations.set(shape, [
      ...(declarations.get(shape) ?? []),
      ...review.files.map((file) => file.path),
      ...anchors,
    ])
  }

  for (const [shape, paths] of declarations) {
    const fixture = buildShape(shape)
    try {
      for (const path of paths) {
        assert.ok(existsSync(join(fixture.path, path)), `${shape} fixture has no ${path}`)
      }
    } finally {
      fixture.cleanup()
    }
  }
})

test('the seed tag is a single stable marker', () => {
  assert.equal(SEED_TAG, 'dev-seed')
})
