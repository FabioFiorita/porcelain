#!/usr/bin/env node
import { appendFileSync } from 'node:fs'

// Release-only inputs bypass Turborepo and must never become cache keys.
// biome-ignore lint/suspicious/noUndeclaredEnvVars: GitHub release secret
const hasLink = Boolean(process.env.CSC_LINK?.trim())
// biome-ignore lint/suspicious/noUndeclaredEnvVars: GitHub release secret
const hasPassword = Boolean(process.env.CSC_KEY_PASSWORD?.trim())

if (hasLink !== hasPassword) {
  console.error(
    'Configure both WIN_CSC_LINK and WIN_CSC_KEY_PASSWORD, or leave both unset for an unsigned Windows release.',
  )
  process.exit(1)
}

// biome-ignore lint/suspicious/noUndeclaredEnvVars: GitHub Actions output contract
const outputFile = process.env.GITHUB_OUTPUT
if (!outputFile) {
  console.error('GITHUB_OUTPUT is required to select the Windows release signing mode.')
  process.exit(1)
}

const enabled = hasLink && hasPassword
appendFileSync(outputFile, `enabled=${enabled}\n`)

if (enabled) {
  console.log('Windows artifacts will be Authenticode signed.')
} else {
  console.warn(
    '::warning::Windows signing credentials are not configured; publishing an unsigned installer.',
  )
}
