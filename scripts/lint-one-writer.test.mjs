import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ALLOWED, findSecondWriters, isSecondWriter, WRITER_ROOT } from './lint-one-writer.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('the daemon may write the Porcelain home', () => {
  const source = "import { porcelainHome } from '@shared/porcelain-home'\nwriteFileSync(p, x)"
  assert.equal(isSecondWriter(`${WRITER_ROOT}/features/tasks/store.ts`, source), false)
})

test('anything else writing the Porcelain home is refused', () => {
  const source = "import { porcelainHome } from '@shared/porcelain-home'\nwriteFileSync(p, x)"
  assert.equal(isSecondWriter('apps/cli/src/tasks-file.ts', source), true)
  assert.equal(isSecondWriter('scripts/handy-helper.mjs', source), true)
})

test('reading the Porcelain home stays allowed anywhere', () => {
  const source = "import { porcelainHome } from '@shared/porcelain-home'\nreadFileSync(p, 'utf8')"
  assert.equal(isSecondWriter('scripts/report.mjs', source), false)
})

test('writing somewhere that is not the Porcelain home is not this gate concern', () => {
  assert.equal(isSecondWriter('scripts/build.mjs', 'writeFileSync(out, bundle)'), false)
})

test('deleting the store counts as writing it', () => {
  const source = "import { canvasBundleDir } from '@shared/canvas-porcelain'\nrmSync(dir)"
  assert.equal(isSecondWriter('packages/shared/src/nuke.ts', source), true)
})

test('the repository has exactly one writer', () => {
  assert.deepEqual(findSecondWriters(), [])
})

test('every allowlisted writer still exists, so the list cannot rot', () => {
  for (const [path, reason] of Object.entries(ALLOWED)) {
    assert.ok(existsSync(join(root, path)), `${path} is allowlisted (${reason}) but is gone`)
  }
})
