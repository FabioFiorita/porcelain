#!/usr/bin/env node
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { DEV_METRO_PORT, DEV_MOBILE_STATE } from './dev-env.mjs'
import { iosNativeProjectNeedsRegeneration, mobileLaunch } from './mobile-dev.mjs'

test('Metro uses the active profile port and development variant', () => {
  const launch = mobileLaunch(['metro', '--clear'], { APP_VARIANT: 'production' })
  assert.deepEqual(launch.args.slice(-3), ['--port', String(DEV_METRO_PORT), '--clear'])
  assert.equal(launch.env.METRO_PORT, String(DEV_METRO_PORT))
  assert.equal(launch.env.APP_VARIANT, 'development')
  assert.equal(launch.env.TMPDIR, join(DEV_MOBILE_STATE, 'tmp'))
})

test('the Android loop owns the development variant and profile state', () => {
  const launch = mobileLaunch(['android', 'preflight'], {
    APP_VARIANT: 'production',
    ANDROID_LOOP_ENV_FILE: '/tmp/machine-owned-android-loop-env.sh',
  })
  assert.deepEqual(launch.args, ['preflight'])
  assert.equal(launch.env.METRO_PORT, String(DEV_METRO_PORT))
  assert.equal(launch.env.APP_VARIANT, 'development')
  assert.equal(launch.env.ANDROID_LOOP_STATE_DIR, join(DEV_MOBILE_STATE, 'android'))
  assert.equal(launch.env.ANDROID_LOOP_ENV_FILE, '/tmp/machine-owned-android-loop-env.sh')
})

test('the iOS runner owns an explicit simulator and points its dev client at this profile', () => {
  const launch = mobileLaunch(['ios', '--no-build-cache'], {
    APP_VARIANT: 'production',
    PORCELAIN_IOS_SIMULATOR: 'iPhone 17 Pro',
  })

  assert.deepEqual(launch.args, [
    '--dir',
    'apps/mobile',
    'exec',
    'expo',
    'run:ios',
    '--device',
    'iPhone 17 Pro',
    '--port',
    String(DEV_METRO_PORT),
    '--no-build-cache',
  ])
  assert.equal(launch.env.METRO_PORT, String(DEV_METRO_PORT))
  assert.equal(launch.env.APP_VARIANT, 'development')
  assert.equal(launch.env.RCT_METRO_PORT, String(DEV_METRO_PORT))
  assert.equal(launch.env.REACT_NATIVE_PACKAGER_HOSTNAME, '127.0.0.1')
})

test('the iOS runner refuses an implicit simulator or profile override', () => {
  assert.throws(() => mobileLaunch(['ios']), /PORCELAIN_IOS_SIMULATOR is required/)
  assert.throws(
    () =>
      mobileLaunch(['ios', '--device', 'iPhone 17 Pro'], { PORCELAIN_IOS_SIMULATOR: 'iPhone 17' }),
    /owns --device and --port/,
  )
})

test('the iOS launcher regenerates a missing or production native project before launch', () => {
  assert.equal(iosNativeProjectNeedsRegeneration(undefined), true)
  assert.equal(
    iosNativeProjectNeedsRegeneration('PRODUCT_BUNDLE_IDENTIFIER = com.fabiofiorita.porcelain;'),
    true,
  )
  assert.equal(
    iosNativeProjectNeedsRegeneration(
      'PRODUCT_BUNDLE_IDENTIFIER = com.fabiofiorita.porcelain.dev;',
    ),
    false,
  )
})
