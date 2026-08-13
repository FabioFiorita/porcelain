#!/usr/bin/env node
/**
 * Self-tests for lint-supporting-regions.mjs. Each case writes only the files it
 * needs under the supporting roots and calls checkSupportingRegions(root).
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { checkSupportingRegions } from './lint-supporting-regions.mjs'

function writeFixtureFile(root, relativePath, content) {
  const absolute = path.join(root, relativePath)
  mkdirSync(path.dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
}

function withFixtureRepo(build, run) {
  const root = mkdtempSync(path.join(tmpdir(), 'lint-supporting-regions-'))
  try {
    build(root)
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('a shell file importing a review barrel and a type-only contract yields []', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/web/src/components/shell/review-group.tsx',
        `import type { ReviewReading } from '@porcelain/contracts/review'
import { useReviewReading } from '@renderer/features/review'
export const ReviewGroup = useReviewReading
`,
      )
    },
    (root) => {
      assert.deepEqual(checkSupportingRegions(root), [])
    },
  )
})

test('importing @renderer/lib/trpc yields a failure that names trpc', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/web/src/components/shell/review-group.tsx',
        `import { trpc } from '@renderer/lib/trpc'
export const client = trpc
`,
      )
    },
    (root) => {
      const failures = checkSupportingRegions(root)
      assert.ok(
        failures.some((failure) => failure.includes('trpc')),
        `expected trpc violation, got: ${JSON.stringify(failures)}`,
      )
    },
  )
})

test('importing @renderer/lib/daemon yields a failure that names daemon', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/web/src/components/shell/review-group.tsx',
        `import { daemon } from '@renderer/lib/daemon'
export const client = daemon
`,
      )
    },
    (root) => {
      const failures = checkSupportingRegions(root)
      assert.ok(
        failures.some((failure) => failure.includes('daemon')),
        `expected daemon violation, got: ${JSON.stringify(failures)}`,
      )
    },
  )
})

test('importing @backend/review/flow from a production .tsx yields a failure that names @backend', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/web/src/components/shell/review-group.tsx',
        `import type { FlowGroup } from '@backend/review/flow'
export type Group = FlowGroup
`,
      )
    },
    (root) => {
      const failures = checkSupportingRegions(root)
      assert.ok(
        failures.some((failure) => failure.includes('@backend')),
        `expected @backend violation, got: ${JSON.stringify(failures)}`,
      )
    },
  )
})

test('importing @renderer/features/review/comments/composer yields a failure that names the deep review path', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/web/src/components/shell/review-group.tsx',
        `import { Composer } from '@renderer/features/review/comments/composer'
export const ReviewComposer = Composer
`,
      )
    },
    (root) => {
      const failures = checkSupportingRegions(root)
      assert.ok(
        failures.some((failure) => failure.includes('@renderer/features/review/comments/composer')),
        `expected deep review path violation, got: ${JSON.stringify(failures)}`,
      )
    },
  )
})

test('importing reviewEvidenceQuerySchema from contracts yields a failure that names QuerySchema', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/web/src/components/shell/review-group.tsx',
        `import { reviewEvidenceQuerySchema } from '@porcelain/contracts/review'
export const schema = reviewEvidenceQuerySchema
`,
      )
    },
    (root) => {
      const failures = checkSupportingRegions(root)
      assert.ok(
        failures.some((failure) => failure.includes('QuerySchema')),
        `expected QuerySchema violation, got: ${JSON.stringify(failures)}`,
      )
    },
  )
})

test('importing commitModelSchema from @porcelain/contracts in settings yields []', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/web/src/components/settings/data-section.tsx',
        `import { commitModelSchema } from '@porcelain/contracts'
export const schema = commitModelSchema
`,
      )
    },
    (root) => {
      assert.deepEqual(checkSupportingRegions(root), [])
    },
  )
})

test('importing ChangesList from @/features/changes/changes-list in mobile shell yields []', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/mobile/src/features/shell/surface-slots.tsx',
        `import { ChangesList } from '@/features/changes/changes-list'
export const List = ChangesList
`,
      )
    },
    (root) => {
      assert.deepEqual(checkSupportingRegions(root), [])
    },
  )
})

test('importing isTabletFormFactor from @/features/shell/use-app-window in mobile settings yields []', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/mobile/src/features/settings/preferences-store.ts',
        `import { isTabletFormFactor } from '@/features/shell/use-app-window'
export const isTablet = isTabletFormFactor
`,
      )
    },
    (root) => {
      assert.deepEqual(checkSupportingRegions(root), [])
    },
  )
})

test('glance-home.test.tsx importing @backend/review/flow yields []', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/web/src/components/shell/glance-home.test.tsx',
        `import type { FlowGroup } from '@backend/review/flow'
export type Group = FlowGroup
`,
      )
    },
    (root) => {
      assert.deepEqual(checkSupportingRegions(root), [])
    },
  )
})
