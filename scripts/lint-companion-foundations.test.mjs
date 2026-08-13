#!/usr/bin/env node
/** Fixture tests for the AGT-002 explicit-only Companion foundation gate. */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import {
  COMPANION_FOUNDATION_FILES,
  checkCompanionFoundation,
} from './lint-companion-foundations.mjs'

function writeFile(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath)
  mkdirSync(path.dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

function validSources() {
  return new Map([
    [
      'skills/porcelain-companion/SKILL.md',
      [
        'Companion is an explicit product-surface procedure, not an automatic session lifecycle.',
        'Do not clear another active Review automatically.',
        'Create or clear a Review only when the human requests Companion work or the agent deliberately publishes a Review.',
        'Ordinary code edits follow root AGENTS.md; do not create, clear, or complete a Review.',
        'Run check-evidence.mjs before claiming an intentionally published Review complete.',
      ].join('\n'),
    ],
    [
      'skills/porcelain-companion/references/review.md',
      'Explicit replacement: do not clear another active Review automatically.',
    ],
    [
      'skills/porcelain-companion/references/board.md',
      'Start a Review only when publication is requested.',
    ],
    [
      'skills/porcelain-companion/references/sync-environments.md',
      'Share repo-local channels deliberately.',
    ],
    [
      'skills/porcelain-companion/references/scope.md',
      'Scope is read from the current project-relative channel.',
    ],
    [
      'skills/porcelain-companion/references/git-visibility.md',
      'The current disposable .migrated-from-home marker remains ignored.',
    ],
    [
      'skills/porcelain-companion/agents/openai.yaml',
      'When the human requests Companion work or you deliberately publish a Review, start Intent-first.',
    ],
  ])
}

function withFixture(build, run) {
  const root = mkdtempSync(path.join(tmpdir(), 'lint-companion-foundations-'))
  try {
    const sources = validSources()
    build(sources)
    for (const relativePath of COMPANION_FOUNDATION_FILES) {
      writeFile(root, relativePath, sources.get(relativePath) ?? '')
    }
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('an explicit-only authored Companion source passes', () => {
  withFixture(
    (_) => {},
    (root) => {
      assert.deepEqual(checkCompanionFoundation(root), [])
    },
  )
})

test('mandatory session lifecycle wording is rejected', () => {
  withFixture(
    (sources) => {
      sources.set(
        'skills/porcelain-companion/SKILL.md',
        `${sources.get('skills/porcelain-companion/SKILL.md')}\nStart of session: review clear if previous unit is done, then review set.`,
      )
    },
    (root) => {
      assert.ok(checkCompanionFoundation(root).some((failure) => failure.includes('mandatory')))
    },
  )
})

test('deleted home migration wording is rejected', () => {
  withFixture(
    (sources) => {
      sources.set(
        'skills/porcelain-companion/references/sync-environments.md',
        'One-way migrate from home. Porcelain copies it into the repo and purges the home keys.',
      )
    },
    (root) => {
      assert.ok(checkCompanionFoundation(root).some((failure) => failure.includes('migration')))
    },
  )
})

test('missing authored source fails closed', () => {
  withFixture(
    (_) => {},
    (root) => {
      const missingPath = path.join(root, 'skills/porcelain-companion/references/board.md')
      rmSync(missingPath)
      assert.ok(
        checkCompanionFoundation(root).some((failure) =>
          failure.includes('missing authored Companion source'),
        ),
      )
      assert.equal(
        readFileSync(path.join(root, 'skills/porcelain-companion/SKILL.md'), 'utf8').length > 0,
        true,
      )
    },
  )
})
