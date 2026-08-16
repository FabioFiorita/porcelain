#!/usr/bin/env node
/**
 * The dev launcher's env block is a safety boundary, not a convenience.
 *
 * `apps/daemon/src/server.ts` gates the playground guard and dev seeding on `PORCELAIN_DEV`.
 * Until this test existed, `pnpm dev:daemon` never set it, so the boundary the docs promise
 * ("a development daemon is an agent playground, never a way to open the host's real
 * checkouts") was inactive on the one path every agent uses.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEV_HOME, DEV_PLAYGROUND, DEV_PORT, DEV_USER_DATA, devEnv } from './dev-env.mjs'

test('the dev env arms the daemon playground boundary', () => {
  assert.equal(devEnv().PORCELAIN_DEV, '1')
})

test('the dev env points every path away from production', () => {
  const env = devEnv()
  assert.equal(env.PORCELAIN_HOME, DEV_HOME)
  assert.equal(env.PORCELAIN_USER_DATA, DEV_USER_DATA)
  assert.equal(env.PORCELAIN_DEV_PLAYGROUND, DEV_PLAYGROUND)
  assert.notEqual(env.PORCELAIN_HOME, `${process.env.HOME}/.porcelain`)
  assert.notEqual(env.PORCELAIN_USER_DATA, `${process.env.HOME}/.local/share/porcelain`)
  assert.notEqual(String(DEV_PORT), '43117')
})

test('caller overrides win, so a launcher flag still decides binding and port', () => {
  const env = devEnv({ PORCELAIN_LAN_BIND: '', PORCELAIN_DAEMON_PORT: '43199' })
  assert.equal(env.PORCELAIN_LAN_BIND, '')
  assert.equal(env.PORCELAIN_DAEMON_PORT, '43199')
  assert.equal(env.PORCELAIN_DEV, '1')
})
