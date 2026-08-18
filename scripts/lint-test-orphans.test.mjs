#!/usr/bin/env node
/**
 * Fixture tests for the test-only-orphan gate.
 *
 * Each case builds a throwaway workspace on disk rather than asserting against the real repo,
 * so a legitimate refactor in `apps/` can never turn these red — and so every exclusion the
 * gate claims (self-use, test-support, no-importers) is proven rather than described.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { compareToBaseline, findTestOnlyOrphans, readAliases } from './lint-test-orphans.mjs'

function workspace(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'porcelain-orphans-'))
  writeFileSync(
    path.join(root, 'knip.json'),
    JSON.stringify({ workspaces: { 'apps/web': { paths: { '@renderer/*': ['src/*'] } } } }),
  )
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(root, relative)
    mkdirSync(path.dirname(absolute), { recursive: true })
    writeFileSync(absolute, content)
  }
  return root
}

const scan = (root) => findTestOnlyOrphans({ root, scanRoots: ['apps/web/src'] })
const ids = (root) => scan(root).map((orphan) => orphan.id)

test('an export whose only importer is its own test is an orphan', () => {
  const root = workspace({
    'apps/web/src/widget.tsx': 'export function Widget() { return null }\n',
    'apps/web/src/widget.test.tsx': "import { Widget } from './widget'\nWidget()\n",
  })
  assert.deepEqual(ids(root), ['apps/web/src/widget.tsx::Widget'])
  rmSync(root, { recursive: true, force: true })
})

test('a single non-test importer clears the orphan', () => {
  const root = workspace({
    'apps/web/src/widget.tsx': 'export function Widget() { return null }\n',
    'apps/web/src/widget.test.tsx': "import { Widget } from './widget'\nWidget()\n",
    'apps/web/src/app.tsx': "import { Widget } from './widget'\nexport const App = Widget\n",
  })
  assert.deepEqual(ids(root), [])
  rmSync(root, { recursive: true, force: true })
})

test('the alias map from knip.json resolves a non-test importer', () => {
  const root = workspace({
    'apps/web/src/widget.tsx': 'export function Widget() { return null }\n',
    'apps/web/src/widget.test.tsx': "import { Widget } from './widget'\nWidget()\n",
    'apps/web/src/app.tsx':
      "import { Widget } from '@renderer/widget'\nexport const App = Widget\n",
  })
  assert.deepEqual(ids(root), [])
  rmSync(root, { recursive: true, force: true })
})

test('an export used inside its own file is alive, not an orphan', () => {
  const root = workspace({
    'apps/web/src/widget.tsx':
      'export function Widget() { return null }\nexport function Panel() { return Widget() }\n',
    'apps/web/src/widget.test.tsx': "import { Widget } from './widget'\nWidget()\n",
    'apps/web/src/app.tsx': "import { Panel } from './widget'\nexport const App = Panel\n",
  })
  assert.deepEqual(ids(root), [])
  rmSync(root, { recursive: true, force: true })
})

test('an export nobody imports at all belongs to knip, not here', () => {
  const root = workspace({
    'apps/web/src/widget.tsx': 'export function Widget() { return null }\n',
  })
  assert.deepEqual(ids(root), [])
  rmSync(root, { recursive: true, force: true })
})

test('a test-support module may serve only tests', () => {
  const root = workspace({
    'apps/web/src/test-support.tsx': 'export function renderIt() { return null }\n',
    'apps/web/src/widget.test.tsx': "import { renderIt } from './test-support'\nrenderIt()\n",
  })
  assert.deepEqual(ids(root), [])
  rmSync(root, { recursive: true, force: true })
})

test('a star re-export from a non-test file counts as a real consumer', () => {
  const root = workspace({
    'apps/web/src/widget.tsx': 'export function Widget() { return null }\n',
    'apps/web/src/widget.test.tsx': "import { Widget } from './widget'\nWidget()\n",
    'apps/web/src/index.ts': "export * from './widget'\n",
  })
  assert.deepEqual(ids(root), [])
  rmSync(root, { recursive: true, force: true })
})

test('vendored ui primitives are exempt', () => {
  const root = workspace({
    'apps/web/src/components/ui/button.tsx': 'export function Button() { return null }\n',
    'apps/web/src/components/ui/button.test.tsx': "import { Button } from './button'\nButton()\n",
  })
  assert.deepEqual(ids(root), [])
  rmSync(root, { recursive: true, force: true })
})

test('the baseline forgives a known row and fails a different one', () => {
  const orphans = [{ id: 'a.tsx::A' }, { id: 'b.tsx::B' }]
  const { added, removed } = compareToBaseline(orphans, ['a.tsx::A'])
  assert.deepEqual(
    added.map((orphan) => orphan.id),
    ['b.tsx::B'],
  )
  assert.deepEqual(removed, [])
})

test('a baselined row that is gone is reported for re-recording, not failed', () => {
  const { added, removed } = compareToBaseline([], ['a.tsx::A'])
  assert.deepEqual(added, [])
  assert.deepEqual(removed, ['a.tsx::A'])
})

test('readAliases scopes an alias to the workspace that declares it', () => {
  const root = workspace({})
  const aliases = readAliases(path.join(root, 'knip.json'))
  assert.equal(aliases.length, 1)
  assert.equal(aliases[0].prefix, '@renderer/')
  assert.equal(aliases[0].wildcard, true)
  rmSync(root, { recursive: true, force: true })
})
