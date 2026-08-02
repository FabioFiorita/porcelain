#!/usr/bin/env node
/**
 * Start the Linux → Mac mobile development loop.
 *
 * Metro stays on this checkout. The simulator preview runs on the Mac because
 * serve-sim needs that machine's xcrun/simctl installation.
 *
 * Usage:
 *   pnpm mobile:dev:remote
 *   pnpm mobile:dev:remote -- --clear
 *   pnpm mobile:dev:remote -- --stop-sim
 */
import { spawn, spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultSshAlias = process.env.PORCELAIN_MOBILE_MAC_SSH ?? 'mac'
const defaultSimHost = process.env.PORCELAIN_MOBILE_SIM_HOST ?? 'macbook.local'
const defaultSimPort = process.env.PORCELAIN_MOBILE_SIM_PORT ?? '3200'
const remoteLogPath = '/tmp/porcelain-serve-sim.log'

const HELP = `Remote mobile development loop

Usage:
  pnpm mobile:dev:remote [-- expo-options]
  pnpm mobile:dev:remote -- --stop-sim

The command keeps Expo/Metro on this host and starts or reuses serve-sim on
the Mac reached through the SSH alias "${defaultSshAlias}".

Options owned by this command:
  --sim-host <host>    Preview host (default: ${defaultSimHost})
  --sim-port <port>    Preview port (default: ${defaultSimPort})
  --ssh-alias <name>   SSH alias for the Mac (default: ${defaultSshAlias})
  --dry-run            Print commands without connecting or starting Metro
  --stop-sim           Stop serve-sim on the Mac and exit
  -h, --help           Show this help

All other options are passed to Expo. For example:
  pnpm mobile:dev:remote -- --clear
`

function fail(message) {
  throw new Error(`[mobile:dev:remote] ${message}`)
}

function parsePort(value, flag) {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(`${flag} needs an integer port from 1 to 65535`)
  }
  return port
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    simHost: defaultSimHost,
    simPort: parsePort(defaultSimPort, 'PORCELAIN_MOBILE_SIM_PORT'),
    sshAlias: defaultSshAlias,
    stopSim: false,
  }
  const expoArgs = []

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '-h' || arg === '--help') {
      options.help = true
      continue
    }
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (arg === '--stop-sim') {
      options.stopSim = true
      continue
    }

    const nextValue = (flag) => {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) fail(`${flag} needs a value`)
      index += 1
      return value
    }

    if (arg === '--sim-host') {
      options.simHost = nextValue(arg)
      continue
    }
    if (arg.startsWith('--sim-host=')) {
      options.simHost = arg.slice('--sim-host='.length)
      continue
    }
    if (arg === '--sim-port') {
      options.simPort = parsePort(nextValue(arg), arg)
      continue
    }
    if (arg.startsWith('--sim-port=')) {
      options.simPort = parsePort(arg.slice('--sim-port='.length), '--sim-port')
      continue
    }
    if (arg === '--ssh-alias') {
      options.sshAlias = nextValue(arg)
      continue
    }
    if (arg.startsWith('--ssh-alias=')) {
      options.sshAlias = arg.slice('--ssh-alias='.length)
      continue
    }

    if (arg !== '--') expoArgs.push(arg)
  }

  return { expoArgs, options }
}

function simUrl(options) {
  return `http://${options.simHost}:${options.simPort}`
}

function remoteStartCommand(options) {
  return `nohup npx --yes serve-sim@latest --port ${options.simPort} --host 0.0.0.0 --panes none -q >${remoteLogPath} 2>&1 < /dev/null & disown`
}

function remoteStopCommand() {
  return 'npx --yes serve-sim@latest --kill'
}

function runSsh(options, command, stdio = 'inherit') {
  const result = spawnSync('ssh', [options.sshAlias, command], {
    cwd: root,
    stdio,
  })
  if (result.error) fail(`could not run ssh: ${result.error.message}`)
  if (result.status !== 0) {
    const detail = result.signal ? ` (${result.signal})` : ''
    fail(`ssh ${options.sshAlias} failed with status ${result.status ?? 'unknown'}${detail}`)
  }
}

async function isReachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) })
    return response.status < 500
  } catch {
    return false
  }
}

async function waitForPreview(url) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isReachable(url)) return true
    await delay(250)
  }
  return false
}

function printRemoteLog(options) {
  const result = spawnSync('ssh', [options.sshAlias, `tail -n 40 ${remoteLogPath}`], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  if (output) console.error(`\n[mobile:dev:remote] Mac serve-sim log:\n${output}`)
}

async function ensurePreview(options) {
  const url = simUrl(options)
  console.log(`[mobile:dev:remote] Checking simulator preview at ${url}`)
  if (await isReachable(url)) {
    console.log('[mobile:dev:remote] Reusing the existing Mac serve-sim server')
    return
  }

  console.log(`[mobile:dev:remote] Starting serve-sim on ${options.sshAlias}`)
  runSsh(options, remoteStartCommand(options))
  if (await waitForPreview(url)) {
    console.log(`[mobile:dev:remote] Simulator preview ready at ${url}`)
    return
  }

  printRemoteLog(options)
  fail(`serve-sim did not become reachable at ${url}`)
}

function hasExpoHostOption(args) {
  return args.some(
    (arg) =>
      arg === '--host' || arg === '--localhost' || arg === '--tunnel' || arg.startsWith('--host='),
  )
}

function startMetro(expoArgs) {
  const args = hasExpoHostOption(expoArgs) ? expoArgs : ['--host', 'lan', ...expoArgs]
  console.log(
    `[mobile:dev:remote] Starting Metro with: pnpm --dir apps/mobile start ${args.join(' ')}`,
  )
  return spawn('pnpm', ['--dir', 'apps/mobile', 'start', ...args], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  })
}

async function main() {
  const { expoArgs, options } = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(HELP)
    return
  }

  if (options.dryRun) {
    console.log(
      `[mobile:dev:remote] SSH check/start: ssh ${options.sshAlias} '${remoteStartCommand(options)}'`,
    )
    console.log(`[mobile:dev:remote] Simulator preview: ${simUrl(options)}`)
    console.log(
      `[mobile:dev:remote] Metro: pnpm --dir apps/mobile start --host lan${expoArgs.length ? ` ${expoArgs.join(' ')}` : ''}`,
    )
    return
  }

  if (options.stopSim) {
    console.log(`[mobile:dev:remote] Stopping serve-sim on ${options.sshAlias}`)
    runSsh(options, remoteStopCommand())
    return
  }

  await ensurePreview(options)
  console.log(`[mobile:dev:remote] Preview URL: ${simUrl(options)}`)
  console.log('[mobile:dev:remote] Ctrl-C stops Metro; the Mac preview stays running for reuse')
  const metro = startMetro(expoArgs)
  let stopping = false

  const stopMetro = () => {
    if (stopping) return
    stopping = true
    if (metro.exitCode === null && !metro.killed) metro.kill('SIGINT')
  }
  process.once('SIGINT', stopMetro)
  process.once('SIGTERM', stopMetro)

  await new Promise((resolveExit) => {
    metro.once('error', (error) => {
      console.error(`[mobile:dev:remote] Metro failed to start: ${error.message}`)
      resolveExit(1)
    })
    metro.once('exit', (code, signal) => {
      if (signal && !stopping) console.error(`[mobile:dev:remote] Metro exited after ${signal}`)
      resolveExit(code ?? 1)
    })
  })
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
