#!/usr/bin/env node
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseListeningPids, portOwnerProbe } from './dev-daemon.mjs'

test('the port owner probe follows the host platform', () => {
  assert.deepEqual(portOwnerProbe(43118, 'darwin'), {
    command: 'lsof',
    args: ['-nP', '-iTCP:43118', '-sTCP:LISTEN', '-t'],
  })
  assert.deepEqual(portOwnerProbe(43118, 'linux'), {
    command: 'ss',
    args: ['-ltnp', 'sport = :43118'],
  })
})

test('the platform probes return unique listener pids', () => {
  assert.deepEqual(parseListeningPids('412\n412\n991\n', 'lsof'), ['412', '991'])
  assert.deepEqual(
    parseListeningPids('users:(("node",pid=412,fd=23),("node",pid=412,fd=24))', 'ss'),
    ['412'],
  )
})
