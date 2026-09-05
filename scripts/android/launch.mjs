#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DEV_METRO_PORT, DEV_MOBILE_STATE, DEV_PORT } from '../dev-env.mjs'

export function selectAvd(form, available, env = process.env) {
  if (!['phone', 'tablet'].includes(form)) throw new Error('Choose phone or tablet.')
  const key = `PORCELAIN_ANDROID_${form.toUpperCase()}_AVD`
  const name = env[key] || (form === 'phone' ? 'Phone' : 'Tablet')
  if (!available.includes(name))
    throw new Error(`AVD ${name} not found. Set ${key} to an existing AVD: ${available.join(', ')}`)
  return name
}

export function sdkTool(name, env = process.env, platform = process.platform) {
  const sdk =
    env.ANDROID_HOME ||
    env.ANDROID_SDK_ROOT ||
    (platform === 'win32'
      ? join(homedir(), 'AppData/Local/Android/Sdk')
      : platform === 'darwin'
        ? join(homedir(), 'Library/Android/sdk')
        : join(homedir(), 'Android/Sdk'))
  const path = join(
    sdk,
    name === 'adb' ? 'platform-tools' : 'emulator',
    `${name}${platform === 'win32' ? '.exe' : ''}`,
  )
  return existsSync(path) ? path : name
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function avdName(output) {
  return output.split(/\r?\n/)[0].trim()
}

async function main() {
  const [form, ...args] = process.argv.slice(2)
  if (form === '--help') {
    console.log(
      'Usage: pnpm dev:mobile:android <phone|tablet>\nStart Dev daemon and Mobile Metro first. Uses Phone/Tablet AVDs, or PORCELAIN_ANDROID_PHONE_AVD / PORCELAIN_ANDROID_TABLET_AVD. Requires an installed development app.',
    )
    return
  }
  if (args.length) throw new Error('Unexpected arguments; use --help.')
  const adb = sdkTool('adb')
  const emulator = sdkTool('emulator')
  const run = (tool, argv) =>
    execFileSync(tool, argv, {
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  const avd = selectAvd(form, run(emulator, ['-list-avds']).split(/\r?\n/))
  const metro = await fetch(`http://127.0.0.1:${DEV_METRO_PORT}/status`, {
    signal: AbortSignal.timeout(3000),
  })
    .then((r) => r.text())
    .catch(() => '')
  if (!metro.includes('packager-status:running'))
    throw new Error('Start Mobile Metro (pnpm dev:mobile) first.')
  await fetch(`http://127.0.0.1:${DEV_PORT}/`, { signal: AbortSignal.timeout(3000) }).catch(() => {
    throw new Error('Start Dev daemon (pnpm dev:daemon) first.')
  })
  function findDevice() {
    const devices = run(adb, ['devices'])
      .split(/\r?\n/)
      .filter((line) => /^emulator-\d+\s+device$/.test(line.trim()))
      .map((line) => line.split(/\s+/)[0])
    const matches = devices.filter((serial) => {
      try {
        return avdName(run(adb, ['-s', serial, 'emu', 'avd', 'name'])) === avd
      } catch {
        return false
      }
    })
    if (matches.length > 1)
      throw new Error(`Multiple running instances of ${avd}; keep one before launching.`)
    return matches[0]
  }
  let serial = findDevice()
  if (!serial) {
    mkdirSync(DEV_MOBILE_STATE, { recursive: true })
    const log = join(DEV_MOBILE_STATE, `android-${form}.log`)
    const fd = openSync(log, 'a')
    const child = spawn(emulator, ['-avd', avd], {
      detached: true,
      windowsHide: true,
      stdio: ['ignore', fd, fd],
    })
    closeSync(fd)
    await new Promise((resolve, reject) => {
      child.once('spawn', resolve)
      child.once('error', reject)
    })
    child.unref()
    console.log(`Started ${avd} (PID ${child.pid}); emulator log: ${log}`)
  } else console.log(`Reusing ${avd} (${serial}).`)
  const deadline = Date.now() + 180000
  let booted = false
  while (Date.now() < deadline) {
    serial ||= findDevice()
    if (serial) {
      try {
        booted = run(adb, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed']) === '1'
      } catch {
        /* A device may briefly disconnect while booting. */
      }
    }
    if (booted) break
    await delay(1000)
  }
  if (!booted) throw new Error(`Timed out waiting for ${avd}. Check its emulator window/log.`)
  const device = (...argv) => run(adb, ['-s', serial, ...argv])
  // Resolve identity from Expo so native configuration stays authoritative.
  const expo = process.platform === 'win32' ? 'cmd.exe' : 'pnpm'
  const expoArgs = ['--dir', 'apps/mobile', 'exec', 'expo', 'config', '--type', 'public', '--json']
  const config = JSON.parse(
    run(
      expo,
      process.platform === 'win32' ? ['/d', '/s', '/c', 'pnpm.cmd', ...expoArgs] : expoArgs,
    ),
  )
  const app = config.android.package
  if (!app.endsWith('.dev')) throw new Error('Refusing to launch a non-development application.')
  let installed = false
  try {
    installed = device('shell', 'pm', 'path', app).startsWith('package:')
  } catch {
    /* Package manager exits nonzero when the app is absent. */
  }
  if (!installed)
    throw new Error(
      `Development app missing on ${serial}. Build with pnpm dev:mobile:android build --device ${serial}, then install the printed APK with adb -s ${serial} install -r <apk>.`,
    )
  const forwards = device('reverse', '--list').split(/\r?\n/)
  for (const port of [DEV_METRO_PORT, DEV_PORT]) {
    const target = `tcp:${port}`
    if (
      forwards.some((line) => {
        const columns = line.trim().split(/\s+/)
        return columns[1] === target && columns[2] === target
      })
    )
      continue
    device('reverse', '--no-rebind', target, target)
  }
  const url = `${config.scheme}://expo-development-client/?url=${encodeURIComponent(`http://127.0.0.1:${DEV_METRO_PORT}`)}`
  console.log(
    device('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', url, app),
  )
  console.log(
    `${avd} (${serial}) opened with Metro ${DEV_METRO_PORT} and daemon ${DEV_PORT}. Pair in Porcelain if this is a new connection. Close the emulator window when finished.`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
