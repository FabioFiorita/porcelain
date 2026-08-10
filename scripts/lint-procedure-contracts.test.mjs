#!/usr/bin/env node
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  checkProcedureCatalog,
  checkRouterValidationLedger,
  DOMAIN_KEYS,
  extractRouterProcedures,
  PRODUCTION_ROUTER_FILES,
  REMAINING_ROUTER_FILES,
} from './lint-procedure-contracts.mjs'

const base = () => ({
  daemonProcedures: [
    { name: 'boardCards', kind: 'query', source: 'board.ts' },
    { name: 'addBoardCard', kind: 'mutation', source: 'board.ts' },
  ],
  contractNames: ['boardCards', 'addBoardCard'],
  baselineEntries: [
    { domain: 'board', name: 'boardCards', kind: 'query', source: 'procedure-ledger-baseline.ts' },
    {
      domain: 'board',
      name: 'addBoardCard',
      kind: 'mutation',
      source: 'procedure-ledger-baseline.ts',
    },
  ],
  ledgerEntries: [
    { domain: 'board', name: 'boardCards', kind: 'query', source: 'procedure-ledger.ts' },
    { domain: 'board', name: 'addBoardCard', kind: 'mutation', source: 'procedure-ledger.ts' },
  ],
  ledgerDomains: new Set(DOMAIN_KEYS),
})

test('rejects a duplicate ledger entry', () => {
  const fixture = base()
  fixture.ledgerEntries.push(fixture.ledgerEntries[0])
  assert.ok(checkProcedureCatalog(fixture).some((failure) => failure.includes('ledger procedure')))
})

test('rejects ledger growth beyond PROCEDURE_NAMES', () => {
  const fixture = base()
  fixture.daemonProcedures.push({ name: 'newProcedure', kind: 'query', source: 'board.ts' })
  fixture.contractNames.push('newProcedure')
  fixture.ledgerEntries.push({
    domain: 'board',
    name: 'newProcedure',
    kind: 'query',
    source: 'procedure-ledger.ts',
  })
  assert.ok(
    checkProcedureCatalog(fixture).some((failure) =>
      failure.includes('ledger procedure is not in initial ownership baseline: newProcedure'),
    ),
  )
})

test('rejects a ledger procedure moved to the wrong domain', () => {
  const fixture = base()
  fixture.ledgerEntries[0] = { ...fixture.ledgerEntries[0], domain: 'git' }
  assert.ok(
    checkProcedureCatalog(fixture).some((failure) =>
      failure.includes('ledger procedure has wrong initial domain: boardCards'),
    ),
  )
})

test('rejects a completed domain procedure moved to the wrong domain', () => {
  const fixture = base()
  fixture.ledgerEntries = [fixture.ledgerEntries[1]]
  fixture.completedRecords = [
    { domain: 'git', name: 'boardCards', kind: 'query', source: 'board.procedures.ts' },
  ]
  assert.ok(
    checkProcedureCatalog(fixture).some((failure) =>
      failure.includes('completed domain procedure has wrong initial domain: boardCards'),
    ),
  )
})

test('rejects a record with a kind changed from the initial baseline', () => {
  const fixture = base()
  fixture.ledgerEntries[0] = { ...fixture.ledgerEntries[0], kind: 'mutation' }
  assert.ok(
    checkProcedureCatalog(fixture).some((failure) =>
      failure.includes('ledger procedure has wrong initial kind: boardCards'),
    ),
  )
})

test('rejects a completed domain record with a kind changed from the initial baseline', () => {
  const fixture = base()
  fixture.ledgerEntries = [fixture.ledgerEntries[1]]
  fixture.completedRecords = [
    { domain: 'board', name: 'boardCards', kind: 'mutation', source: 'board.procedures.ts' },
  ]
  assert.ok(
    checkProcedureCatalog(fixture).some((failure) =>
      failure.includes('completed domain procedure has wrong initial kind: boardCards'),
    ),
  )
})

test('rejects a router/ledger kind drift', () => {
  const fixture = base()
  fixture.ledgerEntries[0] = { ...fixture.ledgerEntries[0], kind: 'mutation' }
  assert.ok(checkProcedureCatalog(fixture).some((failure) => failure.includes('kind drift')))
})

test('rejects a router procedure absent from every contract record', () => {
  const fixture = base()
  fixture.daemonProcedures.push({ name: 'unknownProcedure', kind: 'query', source: 'board.ts' })
  fixture.contractNames.push('unknownProcedure')
  assert.ok(
    checkProcedureCatalog(fixture).some((failure) =>
      failure.includes('router procedure has no ledger/domain record: unknownProcedure'),
    ),
  )
})

function procedureSource({
  catalogImport = "import { procedureCatalog } from '@porcelain/contracts'",
  input = '',
  output = '',
  kind = 'query',
} = {}) {
  return `${catalogImport}
export const router = t.router({
  boardCards: publicProcedure
    ${input}
    ${output}
    .${kind}(() => undefined),
})
`
}

function migratedBoardFixture(options) {
  const source = procedureSource(options)
  return {
    routerFiles: [...PRODUCTION_ROUTER_FILES],
    routerProcedures: extractRouterProcedures(source, 'board.ts'),
    routerSources: { 'board.ts': source },
    remainingRouterFiles: REMAINING_ROUTER_FILES.filter((filename) => filename !== 'board.ts'),
  }
}

test('retains each router filename and complete procedure source block', () => {
  const [procedure] = extractRouterProcedures(
    procedureSource({
      input: '.input(procedureCatalog.boardCards.input)',
      output: '.output(procedureCatalog.boardCards.output)',
    }),
    'board.ts',
  )

  assert.equal(procedure.filename, 'board.ts')
  assert.match(procedure.block, /procedureCatalog\.boardCards\.input/)
  assert.match(procedure.block, /procedureCatalog\.boardCards\.output/)
})

test('accepts the current remaining ledger beside every migrated router file', () => {
  const unmigrated = procedureSource()
  const migrated = procedureSource({
    input: '.input(procedureCatalog.boardCards.input)',
    output: '.output(procedureCatalog.boardCards.output)',
  })
  const routerSources = Object.fromEntries(
    PRODUCTION_ROUTER_FILES.map((filename) => [
      filename,
      REMAINING_ROUTER_FILES.includes(filename) ? unmigrated : migrated,
    ]),
  )
  const procedures = PRODUCTION_ROUTER_FILES.flatMap((filename) =>
    extractRouterProcedures(routerSources[filename], filename),
  )
  assert.deepEqual(
    checkRouterValidationLedger({
      routerFiles: [...PRODUCTION_ROUTER_FILES],
      routerProcedures: procedures,
      routerSources,
    }),
    [],
  )
})

test('rejects an unknown remaining router filename', () => {
  const fixture = migratedBoardFixture()
  fixture.remainingRouterFiles.push('unknown.ts')
  assert.ok(
    checkRouterValidationLedger(fixture).some((failure) =>
      failure.includes('remaining router filename is unknown: unknown.ts'),
    ),
  )
})

test('rejects a duplicate remaining router filename', () => {
  const fixture = migratedBoardFixture()
  // Derived from the live ledger so shrinking it as routers migrate cannot rot this fixture; once
  // the ledger is empty any production router filename proves the same rule.
  const [duplicate = PRODUCTION_ROUTER_FILES[0]] = fixture.remainingRouterFiles
  fixture.remainingRouterFiles = [duplicate, duplicate]
  assert.ok(
    checkRouterValidationLedger(fixture).some((failure) =>
      failure.includes(`remaining router filename appears more than once: ${duplicate}`),
    ),
  )
})

test('rejects a missing production router filename', () => {
  const fixture = migratedBoardFixture()
  fixture.routerFiles = fixture.routerFiles.filter((filename) => filename !== 'daemon.ts')
  assert.ok(
    checkRouterValidationLedger(fixture).some((failure) =>
      failure.includes('production router file is missing: daemon.ts'),
    ),
  )
})

test('rejects a non-production remaining router filename', () => {
  const fixture = migratedBoardFixture()
  fixture.remainingRouterFiles.push('board.test.ts')
  assert.ok(
    checkRouterValidationLedger(fixture).some((failure) =>
      failure.includes('remaining router filename is not a production router file: board.test.ts'),
    ),
  )
})

test('rejects a catalog identifier not imported directly from the contracts root', () => {
  const fixture = migratedBoardFixture({
    catalogImport: "import { procedureCatalog } from './local-catalog'",
    input: '.input(procedureCatalog.boardCards.input)',
    output: '.output(procedureCatalog.boardCards.output)',
  })
  assert.ok(
    checkRouterValidationLedger(fixture).some((failure) =>
      failure.includes(
        'validated router must import procedureCatalog directly from @porcelain/contracts: board.ts',
      ),
    ),
  )
})

test('rejects missing, wrong, and duplicate canonical inputs', () => {
  const cases = [
    { options: {}, expected: 'router procedure input is missing' },
    {
      options: { input: '.input(procedureCatalog.addBoardCard.input)' },
      expected: 'router procedure input is wrong',
    },
    {
      options: {
        input:
          '.input(procedureCatalog.boardCards.input)\n    .input(procedureCatalog.boardCards.input)',
      },
      expected: 'router procedure input is duplicated',
    },
  ]

  for (const { options, expected } of cases) {
    assert.ok(
      checkRouterValidationLedger(migratedBoardFixture(options)).some((failure) =>
        failure.includes(expected),
      ),
    )
  }
})

test('rejects missing, wrong, and duplicate canonical outputs', () => {
  const cases = [
    {
      options: { input: '.input(procedureCatalog.boardCards.input)' },
      expected: 'router procedure output is missing',
    },
    {
      options: {
        input: '.input(procedureCatalog.boardCards.input)',
        output: '.output(procedureCatalog.addBoardCard.output)',
      },
      expected: 'router procedure output is wrong',
    },
    {
      options: {
        input: '.input(procedureCatalog.boardCards.input)',
        output:
          '.output(procedureCatalog.boardCards.output)\n    .output(procedureCatalog.boardCards.output)',
      },
      expected: 'router procedure output is duplicated',
    },
  ]

  for (const { options, expected } of cases) {
    assert.ok(
      checkRouterValidationLedger(migratedBoardFixture(options)).some((failure) =>
        failure.includes(expected),
      ),
    )
  }
})

test('rejects a router kind drift after a file leaves the remaining ledger', () => {
  const fixture = base()
  fixture.ledgerEntries = [fixture.ledgerEntries[1]]
  fixture.completedRecords = [
    { domain: 'board', name: 'boardCards', kind: 'query', source: 'board.procedures.ts' },
  ]
  fixture.daemonProcedures = extractRouterProcedures(
    procedureSource({
      input: '.input(procedureCatalog.boardCards.input)',
      output: '.output(procedureCatalog.boardCards.output)',
      kind: 'mutation',
    }),
    'board.ts',
  )
  assert.ok(
    checkProcedureCatalog(fixture).some((failure) =>
      failure.includes('procedure kind drift for boardCards: router=mutation record=query'),
    ),
  )
})

console.log('lint-procedure-contracts fixtures: ok')
