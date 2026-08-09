#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { DOMAIN_KEYS } from './architecture/domains.mjs'
import { checkArchitecture } from './lint-architecture.mjs'

// Messages only the ARC-002 registry/target-domain checks can produce. Fixture repos otherwise
// still trip the pre-existing legacy-ledger checks (oversized files, foundation imports) because
// those hardcoded paths do not exist under a temporary root; filtering to this pattern lets a
// fixture assert on the behavior under test without reproducing the whole legacy ledger.
const NEW_CHECK_PATTERN =
  /DOMAIN_MIGRATIONS must define|supporting region is also registered|registered target root|migration record|migration status|registers a target root|registers no target root|legacy path still exists|not unique across DOMAIN_MIGRATIONS|is not a registered target domain|has no public index\.ts|deep-imports|domain instead of its public entry/

function buildMigrations(overrides = {}) {
  const base = Object.fromEntries(
    DOMAIN_KEYS.map((key) => [key, { status: 'legacy', targetRoots: [], legacyPaths: [] }]),
  )
  for (const [key, patch] of Object.entries(overrides)) base[key] = { ...base[key], ...patch }
  return base
}

function writeFixtureFile(root, relativePath, content) {
  const absolute = path.join(root, relativePath)
  mkdirSync(path.dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
}

function withFixtureRepo(build, run) {
  const root = mkdtempSync(path.join(tmpdir(), 'lint-architecture-'))
  try {
    build(root)
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function newViolations(failures) {
  return failures.filter((failure) => NEW_CHECK_PATTERN.test(failure))
}

test('an all-legacy registry with no registered target root passes the new checks', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/mobile/src/features/board/board-column.tsx',
        'export const x = 1\n',
      )
    },
    (root) => {
      const failures = checkArchitecture(root, buildMigrations())
      assert.deepEqual(newViolations(failures), [])
    },
  )
})

test('an unregistered target domain directory fails once it exposes a public index.ts', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(root, 'apps/daemon/src/features/board/index.ts', 'export const board = 1\n')
    },
    (root) => {
      const failures = checkArchitecture(root, buildMigrations())
      assert.ok(
        failures.some((failure) =>
          /index\.ts exists but is not a registered target root for domain board/.test(failure),
        ),
      )
    },
  )
})

test('a registered migrating root with its public index.ts passes', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(root, 'apps/daemon/src/features/board/index.ts', 'export const board = 1\n')
    },
    (root) => {
      const migrations = buildMigrations({
        board: {
          status: 'migrating',
          targetRoots: ['apps/daemon/src/features/board'],
          legacyPaths: [],
        },
      })
      const failures = checkArchitecture(root, migrations)
      assert.deepEqual(newViolations(failures), [])
    },
  )
})

test('a deep relative import across a foreign registered root fails', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/daemon/src/features/board/index.ts',
        "import { deep } from '../git/deep'\nexport const board = 1\n",
      )
      writeFixtureFile(root, 'apps/daemon/src/features/git/index.ts', 'export const git = 1\n')
      writeFixtureFile(root, 'apps/daemon/src/features/git/deep.ts', 'export const deep = 1\n')
    },
    (root) => {
      const migrations = buildMigrations({
        board: {
          status: 'migrating',
          targetRoots: ['apps/daemon/src/features/board'],
          legacyPaths: [],
        },
        git: {
          status: 'migrating',
          targetRoots: ['apps/daemon/src/features/git'],
          legacyPaths: [],
        },
      })
      const failures = checkArchitecture(root, migrations)
      assert.ok(failures.some((failure) => failure.includes('deep-imports')))
    },
  )
})

test('a relative import that resolves to the foreign root index.ts passes', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/daemon/src/features/board/index.ts',
        "import { git } from '../git'\nexport const board = 1\n",
      )
      writeFixtureFile(root, 'apps/daemon/src/features/git/index.ts', 'export const git = 1\n')
    },
    (root) => {
      const migrations = buildMigrations({
        board: {
          status: 'migrating',
          targetRoots: ['apps/daemon/src/features/board'],
          legacyPaths: [],
        },
        git: {
          status: 'migrating',
          targetRoots: ['apps/daemon/src/features/git'],
          legacyPaths: [],
        },
      })
      const failures = checkArchitecture(root, migrations)
      assert.ok(!failures.some((failure) => failure.includes('deep-imports')))
    },
  )
})

test('a complete domain fails while its recorded legacy path still exists', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/daemon/src/features/search/index.ts',
        'export const search = 1\n',
      )
      writeFixtureFile(root, 'apps/daemon/src/legacy-search.ts', 'export const legacySearch = 1\n')
    },
    (root) => {
      const migrations = buildMigrations({
        search: {
          status: 'complete',
          targetRoots: ['apps/daemon/src/features/search'],
          legacyPaths: ['apps/daemon/src/legacy-search.ts'],
        },
      })
      const failures = checkArchitecture(root, migrations)
      assert.ok(
        failures.some((failure) =>
          /domain search is complete but its legacy path still exists/.test(failure),
        ),
      )
    },
  )
})
