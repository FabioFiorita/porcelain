#!/usr/bin/env node
/**
 * Keep the daemon procedure surface and the transitional/domain contract records in lockstep.
 * The ledger can only shrink as a domain record lands; it may never grow or change a procedure
 * kind. Full input/output exhaustiveness is CON-012's responsibility.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DOMAIN_KEYS = [
  'remote',
  'projects',
  'files',
  'search',
  'git',
  'review',
  'board',
  'actions',
  'terminal',
  'project-data',
]

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function extractRouterProcedures(source) {
  const starts = [...source.matchAll(/^ {2}(\w+):\s*(?:public|admin)Procedure/gm)]
  return starts.map((match, index) => {
    const end = starts[index + 1]?.index ?? source.length
    const block = source.slice(match.index, end)
    const kind = /\.(query|mutation)\s*\(/.exec(block)?.[1]
    return { name: match[1], kind }
  })
}

function readRouterProcedures(repositoryRoot) {
  const routerDir = join(repositoryRoot, 'apps', 'daemon', 'src', 'router')
  const procedures = []
  for (const file of readdirSync(routerDir).filter((name) => name.endsWith('.ts'))) {
    for (const procedure of extractRouterProcedures(readFileSync(join(routerDir, file), 'utf8'))) {
      procedures.push({ ...procedure, source: `apps/daemon/src/router/${file}` })
    }
  }
  return procedures
}

function readProcedureNames(repositoryRoot) {
  const source = readFileSync(
    join(repositoryRoot, 'packages', 'contracts', 'src', 'procedures', 'names.ts'),
    'utf8',
  )
  return [...source.matchAll(/^\s+'(\w+)',\s*$/gm)].map((match) => match[1])
}

function readLedgerEntries(repositoryRoot) {
  const source = readFileSync(
    join(repositoryRoot, 'packages', 'contracts', 'src', 'procedure-ledger.ts'),
    'utf8',
  )
  const body = source.slice(
    source.indexOf('export const unmigratedProcedureLedger = {'),
    source.indexOf('} as const satisfies'),
  )
  const entries = []
  const domains = new Set()
  const domainPattern = /^ {2}(?:'([^']+)'|(\w+)): \[([\s\S]*?)^ {2}\],?/gm
  for (const match of body.matchAll(domainPattern)) {
    const domain = match[1] ?? match[2]
    domains.add(domain)
    for (const entry of match[3].matchAll(
      /\{\s*name:\s*'(\w+)'\s*,\s*kind:\s*'(query|mutation)'\s*\}/g,
    )) {
      entries.push({ domain, name: entry[1], kind: entry[2], source: 'procedure-ledger.ts' })
    }
  }
  return { domains, entries }
}

function readCompletedDomainRecords(repositoryRoot) {
  const records = []
  for (const domain of DOMAIN_KEYS) {
    const file = join(
      repositoryRoot,
      'packages',
      'contracts',
      'src',
      domain,
      `${domain}.procedures.ts`,
    )
    if (!existsSync(file)) continue
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/^\s{2,}(\w+):\s*\{\s*kind:\s*'(query|mutation)'/gm)) {
      records.push({ domain, name: match[1], kind: match[2], source: file })
    }
  }
  return records
}

function duplicateNames(entries) {
  const seen = new Set()
  const duplicates = new Set()
  for (const entry of entries) {
    if (seen.has(entry.name)) duplicates.add(entry.name)
    seen.add(entry.name)
  }
  return [...duplicates].sort()
}

function duplicateValues(values) {
  const seen = new Set()
  const duplicates = new Set()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates].sort()
}

/**
 * Pure catalog check exported for fixture tests. `contractNames` is the current horizontal
 * PROCEDURE_NAMES baseline; `ledgerEntries` and `completedRecords` are its shrink-only owners.
 */
export function checkProcedureCatalog({
  daemonProcedures,
  contractNames,
  ledgerEntries,
  ledgerDomains = new Set(DOMAIN_KEYS),
  completedRecords = [],
}) {
  const failures = []
  const contractSet = new Set(contractNames)
  const daemonByName = new Map()
  const allRecords = [...ledgerEntries, ...completedRecords]
  const recordByName = new Map()

  for (const duplicate of duplicateNames(daemonProcedures)) {
    failures.push(`daemon procedure appears more than once: ${duplicate}`)
  }
  for (const duplicate of duplicateNames(ledgerEntries)) {
    failures.push(`ledger procedure appears more than once: ${duplicate}`)
  }
  for (const duplicate of duplicateNames(completedRecords)) {
    failures.push(`domain procedure appears more than once: ${duplicate}`)
  }
  for (const duplicate of duplicateNames(allRecords)) {
    failures.push(`procedure appears in more than one contract record: ${duplicate}`)
  }

  if (
    ledgerDomains.size !== DOMAIN_KEYS.length ||
    !DOMAIN_KEYS.every((key) => ledgerDomains.has(key))
  ) {
    failures.push('procedure ledger must contain exactly the ten canonical domain keys')
  }

  for (const duplicate of duplicateValues(contractNames)) {
    failures.push(`contract procedure name is duplicated: ${duplicate}`)
  }

  for (const entry of ledgerEntries) {
    if (!contractSet.has(entry.name)) {
      failures.push(`ledger procedure is not in PROCEDURE_NAMES: ${entry.name}`)
    }
  }

  for (const entry of allRecords) {
    if (recordByName.has(entry.name)) continue
    recordByName.set(entry.name, entry)
  }

  for (const procedure of daemonProcedures) {
    daemonByName.set(procedure.name, procedure)
    const record = recordByName.get(procedure.name)
    if (!record) {
      failures.push(`router procedure has no ledger/domain record: ${procedure.name}`)
    } else if (record.kind !== procedure.kind) {
      failures.push(
        `procedure kind drift for ${procedure.name}: router=${procedure.kind ?? 'unknown'} record=${record.kind}`,
      )
    }
  }

  for (const entry of allRecords) {
    if (!daemonByName.has(entry.name)) {
      failures.push(`ledger/domain procedure is absent from routers: ${entry.name}`)
    }
  }

  const daemonNames = new Set(daemonProcedures.map(({ name }) => name))
  const missingInContracts = [...daemonNames].filter((name) => !contractSet.has(name)).sort()
  const extraInContracts = [...contractSet].filter((name) => !daemonNames.has(name)).sort()
  if (missingInContracts.length > 0) {
    failures.push(`procedures missing from contracts: ${missingInContracts.join(', ')}`)
  }
  if (extraInContracts.length > 0) {
    failures.push(`procedures in contracts but not routers: ${extraInContracts.join(', ')}`)
  }

  return failures
}

export function checkProcedureContracts(repositoryRoot = root) {
  const failures = []
  const daemonProcedures = readRouterProcedures(repositoryRoot)
  const contractNames = readProcedureNames(repositoryRoot)
  const ledger = readLedgerEntries(repositoryRoot)
  const completedRecords = readCompletedDomainRecords(repositoryRoot)

  failures.push(
    ...checkProcedureCatalog({
      daemonProcedures,
      contractNames,
      ledgerEntries: ledger.entries,
      ledgerDomains: ledger.domains,
      completedRecords,
    }),
  )

  const refinedSource = readFileSync(
    join(repositoryRoot, 'packages', 'contracts', 'src', 'procedures', 'refined.ts'),
    'utf8',
  )
  const daemonNames = new Set(daemonProcedures.map(({ name }) => name))
  const refinedKeys = [...refinedSource.matchAll(/^\s{2}(\w+):\s*io\(/gm)].map((match) => match[1])
  const badRefined = refinedKeys.filter((key) => !daemonNames.has(key))
  if (badRefined.length > 0) {
    failures.push(`refinedProcedureIo has unknown procedure names: ${badRefined.join(', ')}`)
  }

  return failures
}

function main() {
  const failures = checkProcedureContracts()
  if (failures.length > 0) {
    console.error('Procedure contract drift:\n')
    for (const failure of failures) console.error(`  ${failure}`)
    console.error(
      '\nRepair the ledger/domain record or router; do not weaken the executor contract.',
    )
    process.exit(1)
  }

  const daemonProcedures = readRouterProcedures(root)
  const refinedSource = readFileSync(
    join(root, 'packages', 'contracts', 'src', 'procedures', 'refined.ts'),
    'utf8',
  )
  const refinedCount = [...refinedSource.matchAll(/^\s{2}(\w+):\s*io\(/gm)].length
  console.log(
    `lint-procedure-contracts: ok — ${daemonProcedures.length} procedures, ${refinedCount} refined`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
