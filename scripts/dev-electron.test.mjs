#!/usr/bin/env node
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEV_HOME, DEV_PORT, DEV_PROFILE, DEV_USER_DATA } from './dev-env.mjs'
import { electronLaunch } from './dev-electron.mjs'

test('the Electron launcher carries the active dev profile into the package command', () => {
  const launch = electronLaunch(['--inspect'])

  assert.deepEqual(launch.args.slice(-4), ['--dir', 'apps/desktop', 'dev', '--inspect'])
  assert.equal(launch.env.PORCELAIN_DEV, '1')
  assert.equal(launch.env.PORCELAIN_HOME, DEV_HOME)
  assert.equal(launch.env.PORCELAIN_USER_DATA, DEV_USER_DATA)
  assert.equal(launch.env.PORCELAIN_DAEMON_PORT, String(DEV_PORT))
  assert.equal(launch.env.PORCELAIN_DEV_PLAYGROUND, DEV_PROFILE.playground)
})

test('the Windows Electron launcher runs the pnpm cmd shim through cmd.exe', {
  skip: process.platform !== 'win32',
}, () => {
  const launch = electronLaunch()
  assert.equal(launch.command, 'cmd.exe')
  assert.deepEqual(launch.args.slice(0, 4), ['/d', '/s', '/c', 'pnpm.cmd'])
})
