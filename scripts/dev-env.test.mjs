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
import {
  DEV_ADMIN_TOKEN_FILE,
  DEV_HOME,
  DEV_METRO_PORT,
  DEV_MOBILE_STATE,
  DEV_PLAYGROUND,
  DEV_PORT,
  DEV_USER_DATA,
  DEV_WEB_PORT,
  devEnv,
  mobileMetroPort,
  webDevPort,
} from './dev-env.mjs'

test('the dev env arms the daemon playground boundary', () => {
  assert.equal(devEnv().PORCELAIN_DEV, '1')
})

test('the dev env points every path away from production', () => {
  const env = devEnv()
  assert.equal(env.PORCELAIN_HOME, DEV_HOME)
  assert.equal(env.PORCELAIN_USER_DATA, DEV_USER_DATA)
  assert.equal(env.PORCELAIN_DAEMON_PORT, String(DEV_PORT))
  assert.equal(env.PORCELAIN_DEV_PLAYGROUND, DEV_PLAYGROUND)
  assert.equal(env.PORCELAIN_ADMIN_TOKEN_FILE, DEV_ADMIN_TOKEN_FILE)
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

/**
 * `pnpm dev:web` proxies to the daemon of ITS checkout. A shared or colliding web port
 * would silently show one worktree's browser client the other worktree's daemon.
 */
test('the web dev port is derived from the daemon port, so profiles never collide', () => {
  assert.equal(webDevPort(43118), 53118)
  assert.equal(webDevPort(43200), 53200)
  assert.equal(webDevPort(43999), 53999)
  assert.equal(DEV_WEB_PORT, webDevPort(DEV_PORT))
  assert.notEqual(DEV_WEB_PORT, DEV_PORT)
})

test('the mobile port and ownership state are profile-specific', () => {
  assert.equal(mobileMetroPort(43118), 8081)
  assert.equal(mobileMetroPort(43200), 44000)
  assert.equal(mobileMetroPort(43999), 44799)
  assert.throws(() => mobileMetroPort(43119), /unmanaged daemon port/)
  assert.equal(DEV_METRO_PORT, mobileMetroPort(DEV_PORT))
  assert.match(DEV_MOBILE_STATE, /porcelain-mobile-(primary|[a-z0-9-]+)$/)
})
