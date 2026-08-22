#!/usr/bin/env node
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEV_HOME, DEV_PORT, DEV_PROFILE, DEV_USER_DATA } from './dev-env.mjs'
import { electronLaunch } from './dev-electron.mjs'

test('the Electron launcher carries the active dev profile into the package command', () => {
  const launch = electronLaunch(['--inspect'])

  assert.equal(launch.args[0], '--dir')
  assert.equal(launch.args[1], 'apps/desktop')
  assert.equal(launch.args[2], 'dev')
  assert.equal(launch.args[3], '--inspect')
  assert.equal(launch.env.PORCELAIN_DEV, '1')
  assert.equal(launch.env.PORCELAIN_HOME, DEV_HOME)
  assert.equal(launch.env.PORCELAIN_USER_DATA, DEV_USER_DATA)
  assert.equal(launch.env.PORCELAIN_DAEMON_PORT, String(DEV_PORT))
  assert.equal(launch.env.PORCELAIN_DEV_PLAYGROUND, DEV_PROFILE.playground)
})
