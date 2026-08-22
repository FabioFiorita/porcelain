#!/usr/bin/env node
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEV_METRO_PORT, DEV_MOBILE_STATE } from './dev-env.mjs'
import { mobileLaunch } from './mobile-dev.mjs'

test('Metro uses the active profile port and cache directory', () => {
  const launch = mobileLaunch(['metro', '--clear'])
  assert.deepEqual(launch.args.slice(-3), ['--port', String(DEV_METRO_PORT), '--clear'])
  assert.equal(launch.env.METRO_PORT, String(DEV_METRO_PORT))
  assert.equal(launch.env.TMPDIR, `${DEV_MOBILE_STATE}/tmp`)
})

test('the Android loop uses the active profile port and ownership directory', () => {
  const launch = mobileLaunch(['android', 'preflight'])
  assert.deepEqual(launch.args, ['preflight'])
  assert.equal(launch.env.METRO_PORT, String(DEV_METRO_PORT))
  assert.equal(launch.env.ANDROID_LOOP_STATE_DIR, `${DEV_MOBILE_STATE}/android`)
})
