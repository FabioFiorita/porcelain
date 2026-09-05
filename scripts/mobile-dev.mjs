#!/usr/bin/env node
/** Profile-aware entrypoint for Metro plus explicit native device loops. */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DEV_METRO_PORT, DEV_MOBILE_STATE, DEV_PROFILE } from './dev-env.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const developmentBundleIdentifier = 'com.fabiofiorita.porcelain.dev'

function pnpmLaunch(args, platform = process.platform) {
  // Windows batch shims must run through cmd.exe rather than Node's direct spawn.
  return platform === 'win32'
    ? { command: 'cmd.exe', args: ['/d', '/s', '/c', 'pnpm.cmd', ...args] }
    : { command: 'pnpm', args }
}

export function iosNativeProjectNeedsRegeneration(projectFileContent) {
  return !projectFileContent?.includes(
    `PRODUCT_BUNDLE_IDENTIFIER = ${developmentBundleIdentifier};`,
  )
}

export function mobileLaunch(argv, inheritedEnv = process.env, platform = process.platform) {
  const [surface = 'metro', ...args] = argv
  const env = {
    ...inheritedEnv,
    // These are local development launchers. Do not let a shell's shipping variant leak into
    // Metro or either native loop; app.config itself still defaults to production for shipping.
    APP_VARIANT: 'development',
    METRO_PORT: String(DEV_METRO_PORT),
    // Expo's iOS build and dev-client paths consult this separately from --port.
    // Keep the generated native binary and the running Metro server on the profile port.
    RCT_METRO_PORT: String(DEV_METRO_PORT),
    ANDROID_LOOP_STATE_DIR: join(DEV_MOBILE_STATE, 'android'),
    TMPDIR: join(DEV_MOBILE_STATE, 'tmp'),
  }
  if (surface === 'metro') {
    return {
      ...pnpmLaunch(
        [
          '--dir',
          'apps/mobile',
          'exec',
          'expo',
          'start',
          '--port',
          String(DEV_METRO_PORT),
          ...args,
        ],
        platform,
      ),
      env,
    }
  }
  if (surface === 'android') {
    if (['phone', 'tablet', '--help'].includes(args[0])) {
      return {
        command: process.execPath,
        args: [join(root, 'scripts/android/launch.mjs'), ...args],
        env,
      }
    }
    if (args[0] === 'build') {
      return {
        command: process.execPath,
        args: [join(root, 'scripts/android/build.mjs'), ...args.slice(1)],
        env,
      }
    }
    return {
      command: join(root, 'scripts', 'mobile-android-loop.sh'),
      args,
      env,
    }
  }
  if (surface === 'ios') {
    const device = inheritedEnv.PORCELAIN_IOS_SIMULATOR
    if (!device) {
      throw new Error(
        'PORCELAIN_IOS_SIMULATOR is required; choose an explicit iPhone simulator before launching iOS',
      )
    }
    if (
      args.includes('--device') ||
      args.includes('-d') ||
      args.includes('--port') ||
      args.includes('-p')
    ) {
      throw new Error(
        'the iOS launcher owns --device and --port; set PORCELAIN_IOS_SIMULATOR instead',
      )
    }
    return {
      // A simulator can always reach the Mac through loopback. Supplying this to Expo's URL
      // creator prevents an old LAN address from becoming the development client's next source.
      ...pnpmLaunch(
        [
          '--dir',
          'apps/mobile',
          'exec',
          'expo',
          'run:ios',
          '--device',
          device,
          '--port',
          String(DEV_METRO_PORT),
          ...args,
        ],
        platform,
      ),
      env: {
        ...env,
        REACT_NATIVE_PACKAGER_HOSTNAME: '127.0.0.1',
      },
    }
  }
  throw new Error(`unknown mobile surface ${surface}; expected metro, android, or ios`)
}

function iosProjectFile() {
  return join(root, 'apps', 'mobile', 'ios', 'PorcelainDev.xcodeproj', 'project.pbxproj')
}

async function regenerateIosDevelopmentProject(launch) {
  const projectFile = iosProjectFile()
  const project = existsSync(projectFile) ? readFileSync(projectFile, 'utf8') : undefined
  if (!iosNativeProjectNeedsRegeneration(project)) return

  console.log('Regenerating the ignored iOS project for Porcelain Dev…')
  await new Promise((resolvePromise, reject) => {
    const prebuild = pnpmLaunch([
      '--dir',
      'apps/mobile',
      'exec',
      'expo',
      'prebuild',
      '--platform',
      'ios',
    ])
    const child = spawn(prebuild.command, prebuild.args, {
      cwd: root,
      env: launch.env,
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) return resolvePromise()
      reject(
        new Error(`Expo iOS prebuild ${signal ? `stopped by ${signal}` : `failed with ${code}`}`),
      )
    })
  })
}

async function main() {
  const argv = process.argv.slice(2)
  const launch = mobileLaunch(argv)
  mkdirSync(launch.env.TMPDIR, { recursive: true })
  const profile = DEV_PROFILE.slug ? `worktree ${DEV_PROFILE.slug}` : 'primary checkout'
  console.log(
    `Porcelain mobile DEV · ${profile}\n\n  Metro       ${DEV_METRO_PORT}\n  state       ${DEV_MOBILE_STATE}\n`,
  )
  if (argv[0] === 'ios') await regenerateIosDevelopmentProject(launch)
  const child = spawn(launch.command, launch.args, { cwd: root, env: launch.env, stdio: 'inherit' })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
  child.on('exit', (code, signal) => {
    if (signal) {
      process.removeAllListeners(signal)
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 1)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('[dev:mobile]', error)
    process.exit(1)
  })
}
