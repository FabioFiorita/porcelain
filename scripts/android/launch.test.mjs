import assert from 'node:assert/strict'
import test from 'node:test'
import { avdName, selectAvd } from './launch.mjs'

test('ADB emulator names tolerate Windows console carriage returns', () => {
  assert.equal(avdName('Phone\r\r\nOK\r\r\n'), 'Phone')
  assert.equal(avdName('Tablet\nOK\n'), 'Tablet')
})

test('phone and tablet select distinct explicit defaults regardless of inventory order', () => {
  assert.equal(selectAvd('phone', ['Tablet', 'Phone'], {}), 'Phone')
  assert.equal(selectAvd('tablet', ['Phone', 'Tablet'], {}), 'Tablet')
})

test('a host can select its own AVD names without changing the repository', () => {
  assert.equal(
    selectAvd('phone', ['Pixel_9'], { PORCELAIN_ANDROID_PHONE_AVD: 'Pixel_9' }),
    'Pixel_9',
  )
})

test('missing or invalid selections never fall back to an unrelated device', () => {
  assert.throws(() => selectAvd('phone', ['Tablet'], {}), /PORCELAIN_ANDROID_PHONE_AVD/)
  assert.throws(() => selectAvd('desktop', ['Phone'], {}), /Choose phone or tablet/)
})
