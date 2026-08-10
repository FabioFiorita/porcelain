#!/usr/bin/env node
/**
 * Keep the daemon procedure surface and the transitional/domain contract records in lockstep.
 * The migration-only initial ownership baseline fixes each procedure's domain and kind. The ledger
 * can only shrink as a domain record lands; it may never grow, move, or change a procedure kind.
 * CON-012 adds a temporary router-file ledger: each file removed from it must use its exact
 * procedureCatalog input/output bindings. CON-021 deletes that bridge after every router migrates.
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

// Temporary CON-012 router validation scaffolding. CON-021 deletes both lists once every router
// is contract-validated and no remaining file is needed.
export const PRODUCTION_ROUTER_FILES = [
  'board.ts',
  'daemon.ts',
  'files.ts',
  'git.ts',
  'network.ts',
  'repos.ts',
  'review.ts',
  'settings.ts',
  'terminal.ts',
]

export const REMAINING_ROUTER_FILES = ['terminal.ts']

const INITIAL_PROCEDURE_COUNT = 113

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export function extractRouterProcedures(source, filename) {
  const starts = [...source.matchAll(/^ {2}(\w+):\s*(?:public|admin)Procedure/gm)]
  return starts.map((match, index) => {
    const end = starts[index + 1]?.index ?? source.length
    const block = source.slice(match.index, end)
    const kind = /\.(query|mutation)\s*\(/.exec(block)?.[1]
    return { filename, name: match[1], kind, block }
  })
}

function readRouterProcedures(repositoryRoot) {
  const routerDir = join(repositoryRoot, 'apps', 'daemon', 'src', 'router')
  const files = readdirSync(routerDir)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .sort()
  const procedures = []
  const sources = {}
  for (const file of files) {
    const source = readFileSync(join(routerDir, file), 'utf8')
    sources[file] = source
    for (const procedure of extractRouterProcedures(source, file)) {
      procedures.push({ ...procedure, source: `apps/daemon/src/router/${file}` })
    }
  }
  return { files, procedures, sources }
}

function readProcedureNames(repositoryRoot) {
  const source = readFileSync(
    join(repositoryRoot, 'packages', 'contracts', 'src', 'procedures', 'names.ts'),
    'utf8',
  )
  return [...source.matchAll(/^\s+'(\w+)',\s*$/gm)].map((match) => match[1])
}

function readInitialOwnershipBaseline(repositoryRoot) {
  const source = readFileSync(
    join(repositoryRoot, 'packages', 'contracts', 'src', 'procedure-ledger-baseline.ts'),
    'utf8',
  )
  return [
    ...source.matchAll(
      /\{\s*domain:\s*'([^']+)'\s*,\s*name:\s*'(\w+)'\s*,\s*kind:\s*'(query|mutation)'\s*\}/g,
    ),
  ].map((match) => ({
    domain: match[1],
    name: match[2],
    kind: match[3],
    source: 'procedure-ledger-baseline.ts',
  }))
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
  // Match both populated multiline buckets and a completed domain's `[]` bucket.
  // Procedure entries never contain a closing square bracket, so the first `]` is
  // the ledger array terminator.
  const domainPattern = /^ {2}(?:'([^']+)'|(\w+)): \[([\s\S]*?)\](?:,|$)/gm
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

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length
}

function procedureLabel({ filename, name }) {
  return `apps/daemon/src/router/${filename}:${name}`
}

function directlyImportsProcedureCatalog(source) {
  for (const match of source.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g,
  )) {
    if (match[2] !== '@porcelain/contracts') continue
    const names = match[1].split(',').map((specifier) => specifier.trim())
    if (names.includes('procedureCatalog')) return true
  }
  return false
}

/**
 * Temporary CON-012 migration gate. It validates exact production filenames before treating a
 * file outside the remaining ledger as migrated, then requires its same-name catalog bindings.
 */
export function checkRouterValidationLedger({
  routerFiles,
  routerProcedures,
  routerSources = {},
  remainingRouterFiles = REMAINING_ROUTER_FILES,
}) {
  const failures = []
  const productionFiles = new Set(PRODUCTION_ROUTER_FILES)
  const routerFileSet = new Set(routerFiles)
  const remainingFileSet = new Set(remainingRouterFiles)

  for (const duplicate of duplicateValues(routerFiles)) {
    failures.push(`production router filename appears more than once: ${duplicate}`)
  }
  for (const filename of routerFiles) {
    if (!filename.endsWith('.ts') || filename.endsWith('.test.ts')) {
      failures.push(`router filename is not a production router file: ${filename}`)
    } else if (!productionFiles.has(filename)) {
      failures.push(`unknown production router filename: ${filename}`)
    }
  }
  for (const filename of PRODUCTION_ROUTER_FILES) {
    if (!routerFileSet.has(filename)) {
      failures.push(`production router file is missing: ${filename}`)
    }
  }

  for (const duplicate of duplicateValues(remainingRouterFiles)) {
    failures.push(`remaining router filename appears more than once: ${duplicate}`)
  }
  for (const filename of remainingRouterFiles) {
    if (!filename.endsWith('.ts') || filename.endsWith('.test.ts')) {
      failures.push(`remaining router filename is not a production router file: ${filename}`)
    } else if (!productionFiles.has(filename)) {
      failures.push(`remaining router filename is unknown: ${filename}`)
    } else if (!routerFileSet.has(filename)) {
      failures.push(`remaining router file is missing: ${filename}`)
    }
  }

  for (const filename of PRODUCTION_ROUTER_FILES) {
    if (remainingFileSet.has(filename) || !routerFileSet.has(filename)) continue
    if (!directlyImportsProcedureCatalog(routerSources[filename] ?? '')) {
      failures.push(
        `validated router must import procedureCatalog directly from @porcelain/contracts: ${filename}`,
      )
    }
  }

  for (const procedure of routerProcedures) {
    if (remainingFileSet.has(procedure.filename)) continue
    if (!productionFiles.has(procedure.filename)) continue

    const label = procedureLabel(procedure)
    const inputCount = countMatches(procedure.block, /\.input\s*\(/g)
    const canonicalInputCount = countMatches(
      procedure.block,
      new RegExp(`\\.input\\s*\\(\\s*procedureCatalog\\.${procedure.name}\\.input\\s*\\)`, 'g'),
    )
    if (inputCount === 0) {
      failures.push(`router procedure input is missing: ${label}`)
    } else if (inputCount > 1) {
      failures.push(`router procedure input is duplicated: ${label}`)
    } else if (canonicalInputCount !== 1) {
      failures.push(
        `router procedure input is wrong: ${label} (expected .input(procedureCatalog.${procedure.name}.input))`,
      )
    }

    const outputCount = countMatches(procedure.block, /\.output\s*\(/g)
    const canonicalOutputCount = countMatches(
      procedure.block,
      new RegExp(`\\.output\\s*\\(\\s*procedureCatalog\\.${procedure.name}\\.output\\s*\\)`, 'g'),
    )
    if (outputCount === 0) {
      failures.push(`router procedure output is missing: ${label}`)
    } else if (outputCount > 1) {
      failures.push(`router procedure output is duplicated: ${label}`)
    } else if (canonicalOutputCount !== 1) {
      failures.push(
        `router procedure output is wrong: ${label} (expected .output(procedureCatalog.${procedure.name}.output))`,
      )
    }
  }

  return failures
}

/**
 * Pure catalog check exported for fixture tests. `contractNames` is the current horizontal
 * PROCEDURE_NAMES baseline; `ledgerEntries` and `completedRecords` are its shrink-only owners.
 * `baselineEntries` is the temporary migration-only owner-of-record map. It is deliberately kept
 * outside the package's public exports and deleted with the transitional ledger by CON-021.
 */
export function checkProcedureCatalog({
  daemonProcedures,
  contractNames,
  baselineEntries = [],
  ledgerEntries,
  ledgerDomains = new Set(DOMAIN_KEYS),
  completedRecords = [],
}) {
  const failures = []
  const contractSet = new Set(contractNames)
  const baselineByName = new Map()
  const daemonByName = new Map()
  const allRecords = [...ledgerEntries, ...completedRecords]
  const recordByName = new Map()

  for (const duplicate of duplicateNames(daemonProcedures)) {
    failures.push(`daemon procedure appears more than once: ${duplicate}`)
  }
  for (const duplicate of duplicateNames(ledgerEntries)) {
    failures.push(`ledger procedure appears more than once: ${duplicate}`)
  }
  for (const duplicate of duplicateNames(baselineEntries)) {
    failures.push(`initial ownership baseline procedure appears more than once: ${duplicate}`)
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

  if (baselineEntries.length !== INITIAL_PROCEDURE_COUNT) {
    failures.push(
      `initial ownership baseline must contain exactly ${INITIAL_PROCEDURE_COUNT} procedures: found ${baselineEntries.length}`,
    )
  }

  for (const entry of baselineEntries) {
    if (!DOMAIN_KEYS.includes(entry.domain)) {
      failures.push(`initial ownership baseline has a non-canonical domain: ${entry.name}`)
    }
    if (entry.kind !== 'query' && entry.kind !== 'mutation') {
      failures.push(`initial ownership baseline has an invalid kind: ${entry.name}`)
    }
    if (!contractSet.has(entry.name)) {
      failures.push(`initial ownership baseline procedure is not in PROCEDURE_NAMES: ${entry.name}`)
    }
    if (!baselineByName.has(entry.name)) baselineByName.set(entry.name, entry)
  }

  for (const name of contractSet) {
    if (!baselineByName.has(name)) {
      failures.push(`procedure is missing from initial ownership baseline: ${name}`)
    }
  }

  for (const name of baselineByName.keys()) {
    if (!contractSet.has(name)) {
      failures.push(`initial ownership baseline has a procedure outside PROCEDURE_NAMES: ${name}`)
    }
  }

  for (const entry of ledgerEntries) {
    if (!contractSet.has(entry.name)) {
      failures.push(`ledger procedure is not in PROCEDURE_NAMES: ${entry.name}`)
    }
  }

  const checkOwnership = (entries, label) => {
    for (const entry of entries) {
      const baseline = baselineByName.get(entry.name)
      if (!baseline) {
        failures.push(`${label} procedure is not in initial ownership baseline: ${entry.name}`)
        continue
      }
      if (entry.domain !== baseline.domain) {
        failures.push(
          `${label} procedure has wrong initial domain: ${entry.name} (record=${entry.domain} baseline=${baseline.domain})`,
        )
      }
      if (entry.kind !== baseline.kind) {
        failures.push(
          `${label} procedure has wrong initial kind: ${entry.name} (record=${entry.kind} baseline=${baseline.kind})`,
        )
      }
    }
  }

  checkOwnership(ledgerEntries, 'ledger')
  checkOwnership(completedRecords, 'completed domain')

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
  const routers = readRouterProcedures(repositoryRoot)
  const daemonProcedures = routers.procedures
  const contractNames = readProcedureNames(repositoryRoot)
  const ledger = readLedgerEntries(repositoryRoot)
  const baselineEntries = readInitialOwnershipBaseline(repositoryRoot)
  const completedRecords = readCompletedDomainRecords(repositoryRoot)

  failures.push(
    ...checkProcedureCatalog({
      daemonProcedures,
      contractNames,
      baselineEntries,
      ledgerEntries: ledger.entries,
      ledgerDomains: ledger.domains,
      completedRecords,
    }),
  )
  failures.push(
    ...checkRouterValidationLedger({
      routerFiles: routers.files,
      routerProcedures: daemonProcedures,
      routerSources: routers.sources,
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

  const routers = readRouterProcedures(root)
  const daemonProcedures = routers.procedures
  const refinedSource = readFileSync(
    join(root, 'packages', 'contracts', 'src', 'procedures', 'refined.ts'),
    'utf8',
  )
  const refinedCount = [...refinedSource.matchAll(/^\s{2}(\w+):\s*io\(/gm)].length
  const remainingProcedures = daemonProcedures.filter(({ filename }) =>
    REMAINING_ROUTER_FILES.includes(filename),
  ).length
  console.log(
    `lint-procedure-contracts: ok — ${daemonProcedures.length} procedures (${remainingProcedures} remaining, ${daemonProcedures.length - remainingProcedures} validated), ${refinedCount} refined`,
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
