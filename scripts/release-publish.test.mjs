import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { collectFiles, publishRelease } from './release-publish.mjs'

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'porcelain-release-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  writeFileSync(join(dir, 'installer.zip'), 'package')
  return dir
}

function github({ exists = false, broken = false, failUpload = false, failQuery = false } = {}) {
  const calls = []
  let draft = true
  const run = (_cmd, args) => {
    calls.push(args)
    if (args[0] === 'repo') return 'example/porcelain'
    if (args.includes('--paginate')) {
      if (failQuery) throw new Error('Network unavailable')
      assert.ok(args.includes('--jq'), 'filter release metadata before buffering command output')
      return exists ? 'v0.9.0\nv1.0.0\nv0.8.0' : 'v0.9.0'
    }
    if (args[1] === 'upload' && failUpload) throw new Error('Upload failed')
    if (args[1] === 'edit') draft = false
    if (args[1] === 'view')
      return JSON.stringify({
        isDraft: draft,
        url: 'https://example.com/release',
        assets: [{ name: 'installer.zip', size: broken ? 1 : 7 }],
      })
    if (args[0] === 'api') return 'v1.0.0'
    return ''
  }
  return { calls, run }
}

for (const exists of [false, true])
  test(`publishes verified assets (${exists ? 'retry' : 'new draft'})`, (t) => {
    const api = github({ exists })
    publishRelease({ tag: 'v1.0.0', assets: [fixture(t)] }, api.run)
    const create = api.calls.find((args) => args[1] === 'create')
    if (exists) assert.equal(create, undefined)
    else {
      assert.ok(create.includes('--draft'))
      assert.ok(create.includes('--verify-tag'))
      assert.ok(!create.includes('--target'))
    }
    const operations = api.calls.filter((args) => args[0] === 'release').map((args) => args[1])
    assert.ok(operations.indexOf('upload') < operations.indexOf('view'))
    assert.ok(operations.indexOf('view') < operations.indexOf('edit'))
  })

for (const fault of ['broken', 'failUpload', 'failQuery'])
  test(`does not publish on ${fault}`, (t) => {
    const api = github({ [fault]: true })
    assert.throws(() => publishRelease({ tag: 'v1.0.0', assets: [fixture(t)] }, api.run))
    assert.ok(!api.calls.some((args) => args[1] === 'edit'))
    if (fault === 'failQuery') assert.ok(!api.calls.some((args) => args[1] === 'create'))
  })

test('rejects duplicate asset names before uploading', (t) => {
  const dir = fixture(t)
  const other = join(dir, 'other')
  mkdirSync(other)
  writeFileSync(join(other, 'installer.zip'), 'other')
  assert.throws(() => collectFiles([dir, other]), /unique/)
})
