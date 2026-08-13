#!/usr/bin/env node
/**
 * Self-tests for lint-desktop-boundary.mjs. Each case writes only the files it
 * needs under Desktop main/preload and calls checkDesktopBoundary(root).
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { checkDesktopBoundary } from './lint-desktop-boundary.mjs'

function writeFixtureFile(root, relativePath, content) {
  const absolute = path.join(root, relativePath)
  mkdirSync(path.dirname(absolute), { recursive: true })
  writeFileSync(absolute, content)
}

function withFixtureRepo(build, run) {
  const root = mkdtempSync(path.join(tmpdir(), 'lint-desktop-boundary-'))
  try {
    build(root)
    run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('a main file importing @backend/fs/external-url yields []', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/desktop/src/main/window.ts',
        `import { isSafeExternalUrl } from '@backend/fs/external-url'
export const guard = isSafeExternalUrl
`,
      )
    },
    (root) => {
      assert.deepEqual(checkDesktopBoundary(root), [])
    },
  )
})

test('importing @backend/net/admin-token yields []', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/desktop/src/main/daemon.ts',
        `import { ensureAdminToken } from '@backend/net/admin-token'
export const token = ensureAdminToken
`,
      )
    },
    (root) => {
      assert.deepEqual(checkDesktopBoundary(root), [])
    },
  )
})

test('importing @backend/cli-install yields []', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/desktop/src/main/cli-install.ts',
        `import { ensureCli } from '@backend/cli-install'
export const install = ensureCli
`,
      )
    },
    (root) => {
      assert.deepEqual(checkDesktopBoundary(root), [])
    },
  )
})

test('importing @backend/features/remote yields a failure naming features', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/desktop/src/main/daemon.ts',
        `import { remote } from '@backend/features/remote'
export const client = remote
`,
      )
    },
    (root) => {
      const failures = checkDesktopBoundary(root)
      assert.ok(
        failures.some((failure) => failure.includes('features')),
        `expected features violation, got: ${JSON.stringify(failures)}`,
      )
    },
  )
})

test('importing @renderer/features/remote yields a failure naming @renderer', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/desktop/src/main/daemon.ts',
        `import { remote } from '@renderer/features/remote'
export const client = remote
`,
      )
    },
    (root) => {
      const failures = checkDesktopBoundary(root)
      assert.ok(
        failures.some((failure) => failure.includes('@renderer')),
        `expected @renderer violation, got: ${JSON.stringify(failures)}`,
      )
    },
  )
})

test('importing node:child_process from daemon.ts yields a failure naming child_process', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/desktop/src/main/daemon.ts',
        `import { spawn } from 'node:child_process'
export const child = spawn
`,
      )
    },
    (root) => {
      const failures = checkDesktopBoundary(root)
      assert.ok(
        failures.some((failure) => failure.includes('child_process')),
        `expected child_process violation, got: ${JSON.stringify(failures)}`,
      )
    },
  )
})

test('a test file daemon.test.ts importing node:child_process yields []', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/desktop/src/main/daemon.test.ts',
        `import { spawn } from 'node:child_process'
export const child = spawn
`,
      )
    },
    (root) => {
      assert.deepEqual(checkDesktopBoundary(root), [])
    },
  )
})

test('remote-daemon.ts importing @porcelain/contracts yields []', () => {
  withFixtureRepo(
    (root) => {
      writeFixtureFile(
        root,
        'apps/desktop/src/main/remote-daemon.ts',
        `import { PROTOCOL_VERSION } from '@porcelain/contracts'
export const version = PROTOCOL_VERSION
`,
      )
    },
    (root) => {
      assert.deepEqual(checkDesktopBoundary(root), [])
    },
  )
})
