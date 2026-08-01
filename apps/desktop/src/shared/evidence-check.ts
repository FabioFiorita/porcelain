/**
 * Structured verification checks attached to loop evidence — the pass/fail/skip
 * result of each verification step (lint, tests, build, e2e). Runtime code
 * shared between renderer and daemon lives in `src/shared/` (like ws-protocol /
 * agent-protocol): this node-free leaf lets the RENDERER import the shape + the
 * pure overall-status helper without runtime-importing `@backend/*` and pulling
 * evidence-store's `node:fs` graph into the browser bundle. `evidence-store.ts`
 * re-exports these so backend/test callers still use one entry point. The CLI
 * (`src/cli/evidence-file.ts`) deliberately duplicates
 * the shape + caps instead of importing (dependency-free, Node builtins only).
 */
export type EvidenceCheckStatus = 'pass' | 'fail' | 'skip'

export interface EvidenceCheck {
  label: string
  status: EvidenceCheckStatus
  detail?: string
}

/** Caps — a checks list that breaks any of these is dropped by readers, never thrown. */
export const MAX_CHECKS = 32
export const MAX_CHECK_LABEL = 120
export const MAX_CHECK_DETAIL = 400

/** Derived overall status: any fail → 'fail'; all pass (≥1) → 'pass'; otherwise null (no signal). */
export function evidenceOverallStatus(checks: EvidenceCheck[]): 'pass' | 'fail' | null {
  if (checks.some((check) => check.status === 'fail')) return 'fail'
  if (checks.some((check) => check.status === 'pass')) return 'pass'
  return null
}
