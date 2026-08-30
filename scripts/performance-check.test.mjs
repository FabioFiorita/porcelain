import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { INITIAL_ENTRY_GZIP_BUDGET_BYTES, checkRendererArtifacts } from './performance-check.mjs'

function withFixture(run) {
  const rendererDir = mkdtempSync(join(tmpdir(), 'porcelain-renderer-budget-'))
  try {
    mkdirSync(join(rendererDir, 'assets'))
    writeFileSync(
      join(rendererDir, 'index.html'),
      '<script type="module" crossorigin src="./assets/entry-hash.js"></script>',
    )
    writeFileSync(join(rendererDir, 'assets/entry-hash.js'), 'console.log("ready")')
    writeFileSync(join(rendererDir, 'assets/logo-hash.png'), Buffer.alloc(40 * 1024))
    writeFileSync(join(rendererDir, 'assets/SymbolsNerdFontMono-Regular-hash.woff2'), 'font')
    return run(rendererDir)
  } finally {
    rmSync(rendererDir, { recursive: true, force: true })
  }
}

test('accepts a renderer whose HTML-selected module and emitted assets fit the budgets', () => {
  withFixture((rendererDir) => {
    const result = checkRendererArtifacts({ rendererDir })
    assert.equal(result.entry, 'assets/entry-hash.js')
    assert.equal(result.rawBytes, Buffer.byteLength('console.log("ready")'))
    assert.ok(result.gzipBytes > 0)
  })
})

test('rejects an oversized initial module selected by index.html', () => {
  withFixture((rendererDir) => {
    writeFileSync(
      join(rendererDir, 'assets/entry-hash.js'),
      randomBytes(INITIAL_ENTRY_GZIP_BUDGET_BYTES + 1),
    )
    assert.throws(
      () => checkRendererArtifacts({ rendererDir }),
      /initial module assets\/entry-hash\.js is .* gzip; budget is/,
    )
  })
})

test('rejects a missing renderer build and a build without index.html', () => {
  const missingRendererDir = mkdtempSync(join(tmpdir(), 'porcelain-missing-renderer-'))
  rmSync(missingRendererDir, { recursive: true })
  assert.throws(
    () => checkRendererArtifacts({ rendererDir: missingRendererDir }),
    /renderer build is missing:/,
  )

  const rendererDir = mkdtempSync(join(tmpdir(), 'porcelain-renderer-without-index-'))
  try {
    assert.throws(
      () => checkRendererArtifacts({ rendererDir }),
      /renderer build is missing index\.html:/,
    )
  } finally {
    rmSync(rendererDir, { recursive: true, force: true })
  }
})

test('rejects duplicate or non-WOFF2 Symbols font artifacts', () => {
  withFixture((rendererDir) => {
    writeFileSync(join(rendererDir, 'assets/SymbolsNerdFontMono-Regular-copy.woff2'), 'font')
    assert.throws(
      () => checkRendererArtifacts({ rendererDir }),
      /expected exactly one SymbolsNerdFontMono-Regular WOFF2 and no duplicate\/TTF/,
    )
  })

  withFixture((rendererDir) => {
    rmSync(join(rendererDir, 'assets/SymbolsNerdFontMono-Regular-hash.woff2'))
    writeFileSync(join(rendererDir, 'assets/SymbolsNerdFontMono-Regular-copy.ttf'), 'font')
    assert.throws(
      () => checkRendererArtifacts({ rendererDir }),
      /expected exactly one SymbolsNerdFontMono-Regular WOFF2 and no duplicate\/TTF/,
    )
  })
})
