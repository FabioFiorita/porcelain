#!/usr/bin/env node
/**
 * Deprecated. The old multi-workflow pre-cut gate is gone.
 * Day-to-day: pnpm lint on commit; pnpm verify before push; browser e2e on CI main.
 * Ship: pnpm release:cut [patch|minor|major].
 */
console.log(`release:check is no longer required.

  Commit:      pnpm lint   (hook)
  Before push: pnpm verify
  CI main:     verify + browser e2e
  Ship:        pnpm release:cut          # patch (default)
               pnpm release:cut minor    # when you ask for minor
`)
process.exit(0)
