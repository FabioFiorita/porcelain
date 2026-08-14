#!/usr/bin/env node
/** Fixture tests for LCH-002 migration cleanup and fresh-agent discovery. */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { REQUIRED_DISCOVERY_FILES } from './lint-agent-foundations.mjs'
import { checkLaunchCleanup, REQUIRED_FRESH_AGENT_FILES } from './lint-launch-cleanup.mjs'

function writeFile(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath)
  mkdirSync(path.dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

function buildMigrations(overrides = {}) {
  const base = {
    search: { status: 'complete', targetRoots: ['packages/contracts/src/search'], legacyPaths: [] },
    review: { status: 'complete', targetRoots: ['packages/contracts/src/review'], legacyPaths: [] },
    board: { status: 'migrating', targetRoots: ['packages/contracts/src/board'], legacyPaths: [] },
  }
  return { ...base, ...overrides }
}

function withFixture(build, run) {
  const root = mkdtempSync(path.join(tmpdir(), 'lint-launch-cleanup-'))
  try {
    writeFile(
      root,
      'AGENTS.md',
      '## Delivery loop\npnpm verify\nUse Porcelain Companion only when intentionally operating companion surfaces.\n',
    )
    for (const relativePath of REQUIRED_FRESH_AGENT_FILES.slice(1)) {
      writeFile(
        root,
        relativePath,
        relativePath === 'docs/internals/domain-architecture.md'
          ? 'canonical domain paths use one narrow `index.ts`.\n'
          : '# current\n',
      )
    }
    for (const relativePath of REQUIRED_DISCOVERY_FILES.slice(1)) {
      writeFile(root, relativePath, '# current\n')
    }
    build(root)
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const cleanOptions = {
  migrations: buildMigrations(),
  deepImportBaselines: {},
}

test('current ledgers, active paths, and discovery pass', () => {
  withFixture(
    (_) => {},
    (root) => assert.deepEqual(checkLaunchCleanup(root, cleanOptions), []),
  )
})

test('a completed-domain legacy ledger entry is rejected', () => {
  withFixture(
    (_) => {},
    (root) => {
      const failures = checkLaunchCleanup(root, {
        ...cleanOptions,
        migrations: buildMigrations({
          search: {
            status: 'complete',
            targetRoots: ['packages/contracts/src/search'],
            legacyPaths: ['apps/daemon/src/legacy-search.ts'],
          },
        }),
      })
      assert.ok(failures.some((failure) => failure.includes('legacy ledger entry')))
    },
  )
})

test('a zeroed deep-import row is rejected', () => {
  withFixture(
    (_) => {},
    (root) => {
      const failures = checkLaunchCleanup(root, {
        ...cleanOptions,
        deepImportBaselines: {
          'apps/mobile/src/features/comments': { occurrences: 0, files: 0 },
        },
      })
      assert.ok(failures.some((failure) => failure.includes('zeroed deep-import baseline')))
    },
  )
})

test('a known compatibility reader/path is rejected', () => {
  withFixture(
    (root) => writeFile(root, 'apps/current-reader.ts', 'const old = reviewSetsPath\n'),
    (root) => {
      const failures = checkLaunchCleanup(root, cleanOptions)
      assert.ok(failures.some((failure) => failure.includes('compatibility reader')))
    },
  )
})

test('fresh-agent discovery requires current docs and focused procedures', () => {
  withFixture(
    (root) => rmSync(path.join(root, 'docs/README.md')),
    (root) => {
      const failures = checkLaunchCleanup(root, cleanOptions)
      assert.ok(failures.some((failure) => failure.includes('docs/README.md')))
    },
  )
})
