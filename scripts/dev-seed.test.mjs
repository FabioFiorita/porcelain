#!/usr/bin/env node
/**
 * Shape tests for the dev seeder. No daemon is contacted — these pin the declarations a
 * re-run depends on, which is where the silent bugs live: a scenario that writes state the
 * purge cannot reclaim looks fine once and duplicates forever after.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SCENARIOS, SEED_TAG, SEEDED_ACTION_TITLES, SEEDED_ACTIONS } from './dev-seed.mjs'

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

test('the seed tag is a single stable marker', () => {
  // Tasks are reclaimed by this tag alone; changing it strands every previously seeded Task.
  assert.equal(SEED_TAG, 'dev-seed')
})
