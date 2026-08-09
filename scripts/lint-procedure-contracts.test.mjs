#!/usr/bin/env node
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkProcedureCatalog, DOMAIN_KEYS } from './lint-procedure-contracts.mjs'

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

console.log('lint-procedure-contracts fixtures: ok')
