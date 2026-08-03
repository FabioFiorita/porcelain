#!/usr/bin/env node
/**
 * Ensure packages/contracts procedure names match apps/daemon routers 1:1.
 * Full I/O shapes live in contracts; this check prevents silent wire drift.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const routerDir = join(root, 'apps', 'daemon', 'src', 'router')
const namesFile = join(root, 'packages', 'contracts', 'src', 'procedures', 'names.ts')

const daemonNames = new Set()
for (const f of readdirSync(routerDir).filter((x) => x.endsWith('.ts'))) {
  const text = readFileSync(join(routerDir, f), 'utf8')
  for (const m of text.matchAll(/^\s+(\w+):\s*(?:public|admin)Procedure/gm)) {
    daemonNames.add(m[1])
  }
}

const namesSrc = readFileSync(namesFile, 'utf8')
const contractNames = new Set([...namesSrc.matchAll(/^\s+'(\w+)',\s*$/gm)].map((m) => m[1]))

const missingInContracts = [...daemonNames].filter((n) => !contractNames.has(n)).sort()
const extraInContracts = [...contractNames].filter((n) => !daemonNames.has(n)).sort()

if (missingInContracts.length > 0 || extraInContracts.length > 0) {
  console.error('Procedure catalog drift (packages/contracts vs apps/daemon routers):\n')
  if (missingInContracts.length > 0) {
    console.error(`  in daemon, missing from contracts (${missingInContracts.length}):`)
    for (const n of missingInContracts) console.error(`    + ${n}`)
  }
  if (extraInContracts.length > 0) {
    console.error(`  in contracts, not in daemon (${extraInContracts.length}):`)
    for (const n of extraInContracts) console.error(`    - ${n}`)
  }
  console.error(
    '\nRegenerate names: scan apps/daemon/src/router and update packages/contracts/src/procedures/names.ts',
  )
  process.exit(1)
}

// Refined map keys must be procedure names
const refinedSrc = readFileSync(
  join(root, 'packages', 'contracts', 'src', 'procedures', 'refined.ts'),
  'utf8',
)
const refinedKeys = [...refinedSrc.matchAll(/^\s{2}(\w+):\s*io\(/gm)].map((m) => m[1])
const badRefined = refinedKeys.filter((k) => !daemonNames.has(k))
if (badRefined.length > 0) {
  console.error('refinedProcedureIo has unknown procedure names:', badRefined.join(', '))
  process.exit(1)
}

console.log(
  `lint-procedure-contracts: ok — ${daemonNames.size} procedures, ${refinedKeys.length} refined`,
)
