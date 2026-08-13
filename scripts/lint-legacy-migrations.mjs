#!/usr/bin/env node
/**
 * Permanent banned-identifier guard. Fail if any production source under apps/ or packages/
 * reintroduces a deleted name.
 *
 * PDT-005 retired the home→repo and active-review-layout migrations. REV-009 cut the Review wire
 * over to its canonical catalog and deleted the whole Feature-era vocabulary, the `loopEvidence*`
 * procedures, the per-path reviewed mutations, and the `hasReport`/`legacyReport`/`reviewCanvas`
 * markers; this gate is the ratchet that keeps them from regrowing.
 *
 * Historical mentions inside this script's own forbidden list are the only survivors.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const FORBIDDEN = new RegExp(
  [
    // PDT-005 migrations.
    'ensureProjectCompanion',
    'resetProjectCompanionMemo',
    'hasProjectCompanion',
    'migrateActiveReviewLayout',
    'trustMigratedCommands',
    'reviewSetsPath',
    'loopEvidenceRoot',
    'migrate-home',
    'migrate-active-review',
    // REV-009 Feature-era vocabulary.
    'featureView',
    'FeatureView',
    'featureReading',
    'FeatureReading',
    'exploreFeature',
    'clearFeatureReview',
    'featureBuild',
    'featureSlice',
    'featureKey',
    'featureSnapshot',
    'featureList',
    'FeatureList',
    'featureCanvas',
    'FeatureCanvas',
    'featureEmpty',
    'featureOpenReview',
    'featureClearReview',
    'featureOutlineEvidence',
    'FeatureOutline',
    'feature-view',
    'feature-build',
    'feature-slice',
    'feature-key',
    'feature-snapshot',
    // REV-009 deleted Review wire names, fields, and temporary contract files.
    'worktreeInbox',
    'markReviewed',
    'reviewEvidenceDocs',
    'reviewEvidenceAssets',
    '[lL]oopEvidence',
    'hasReport',
    'legacyReport',
    'reviewCanvasSchema',
    'review\\.target-',
    'reviewTargetProcedures',
    'REVIEW_TARGET_STALE',
  ].join('|'),
)
const ALLOWED_RELATIVE = new Set([
  // This guard documents the forbidden tokens.
  'scripts/lint-legacy-migrations.mjs',
  // Negative-proof boundaries: these tests exist to assert a deleted name is absent, so they must
  // be allowed to spell it. Nothing here ships the name.
  'packages/contracts/src/review/review.procedures.test.ts',
  'packages/contracts/src/review/review.contract.test.ts',
  'packages/contracts/src/procedure-catalog.test.ts',
  'apps/daemon/src/features/review/review-evidence-router.test.ts',
  'apps/cli/src/cli.test.ts',
])

const hits = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'out' || name === 'dist' || name === '.git') continue
    const path = join(dir, name)
    const st = statSync(path)
    if (st.isDirectory()) {
      walk(path)
      continue
    }
    if (!/\.(ts|tsx|js|mjs|json)$/.test(name)) continue
    const rel = relative(root, path).split('\\').join('/')
    if (ALLOWED_RELATIVE.has(rel)) continue
    if (!rel.startsWith('apps/') && !rel.startsWith('packages/')) continue
    const text = readFileSync(path, 'utf8')
    for (const [i, line] of text.split('\n').entries()) {
      if (FORBIDDEN.test(line)) hits.push(`${rel}:${i + 1}:${line.trim()}`)
    }
  }
}

walk(join(root, 'apps'))
walk(join(root, 'packages'))

if (hits.length > 0) {
  console.error('lint-legacy-migrations: forbidden legacy migration surface still referenced:')
  for (const hit of hits) console.error(`  ${hit}`)
  process.exit(1)
}

console.log('lint-legacy-migrations: ok — zero home→repo / active-review migration hits')
