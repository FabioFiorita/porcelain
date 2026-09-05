#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export function buildArguments(abi, port, windows) {
  if (!['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'].includes(abi))
    throw new Error(`Unsupported Android architecture: ${abi}`)
  if (!/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535)
    throw new Error('A valid Metro port is required.')
  return [
    ':app:assembleDebug',
    `-PreactNativeArchitectures=${abi}`,
    `-PreactNativeDevServerPort=${port}`,
    '--max-workers=2',
    '--console=plain',
    ...(windows ? ['-I', '../../../scripts/android/android-native.init.gradle'] : []),
  ]
}

function run(command, args, options = {}) {
  const batch = process.platform === 'win32' && /\.(cmd|bat)$/.test(command)
  // Batch arguments here are generated tokens, never arbitrary shell expressions.
  if (batch && [command, ...args].some((value) => !/^[\w./:=\\-]+$/.test(value)))
    throw new Error('Unsupported character in batch argument.')
  const result = spawnSync(
    batch ? 'cmd.exe' : command,
    batch ? ['/d', '/s', '/c', command, ...args] : args,
    {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
      ...options,
    },
  )
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal}).`)
  return result.stdout?.trim()
}

function main() {
  const args = process.argv.slice(2)
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log(
      'Usage: pnpm dev:mobile:android build --device <serial>\nBuilds a development APK without installing it or starting Metro.',
    )
    return
  }
  if (args.length !== 2 || args[0] !== '--device' || !/^[\w.:-]+$/.test(args[1]))
    throw new Error('Select a connected device: build --device <serial>')
  const windows = process.platform === 'win32'
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
  const adb = sdk ? join(sdk, 'platform-tools', windows ? 'adb.exe' : 'adb') : 'adb'
  const abi = run(adb, ['-s', args[1], 'shell', 'getprop', 'ro.product.cpu.abi'], {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
  })
  const gradleArgs = buildArguments(abi, process.env.METRO_PORT, windows)
  const env = { ...process.env, APP_VARIANT: 'development', NODE_ENV: 'development' }
  if (windows) {
    const key = createHash('sha256').update(root).digest('hex').slice(0, 10)
    env.PORCELAIN_NATIVE_BUILD_DIR ||= join(tmpdir(), `p-native-${key}`)
  }
  run(
    windows ? 'pnpm.cmd' : 'pnpm',
    ['--dir', 'apps/mobile', 'exec', 'expo', 'prebuild', '--platform', 'android', '--no-install'],
    { env },
  )
  run(windows ? '.\\gradlew.bat' : './gradlew', gradleArgs, {
    cwd: join(root, 'apps/mobile/android'),
    env,
  })
  const apk = join(root, 'apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk')
  if (!existsSync(apk)) throw new Error('Build completed but the development APK was not found.')
  console.log(`Development APK: ${apk}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
