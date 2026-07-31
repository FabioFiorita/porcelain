#!/usr/bin/env node
/**
 * Deprecated. The old multi-workflow pre-cut gate is gone.
 * Day-to-day: pnpm verify + browser e2e. Ship: pnpm release:cut [patch|minor|major].
 */
console.log(`release:check is no longer required.

  Day-to-day:  pnpm verify  (+ browser e2e when UI changed)
  Ship:        pnpm release:cut          # patch (default)
               pnpm release:cut minor    # when you ask for minor
`)
process.exit(0)
