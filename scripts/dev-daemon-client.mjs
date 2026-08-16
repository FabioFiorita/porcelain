#!/usr/bin/env node
/**
 * A minimal admin tRPC client for the DEV daemon.
 *
 * Reads go through the daemon's real procedures, which are a typed contract
 * (`packages/contracts`) and therefore safe to depend on — unlike the CLI's human-readable
 * stdout, which is an explainer, not an interface. Writes belong to the shipped CLI; this
 * module exists so a seeder can ask what already exists before writing again.
 *
 * No dependencies: tRPC's non-batched HTTP shape is a plain POST/GET, and the protocol
 * version comes from the built contracts so it can never drift into a lie.
 */
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEV_ADMIN_TOKEN_FILE, DEV_PORT, ensureDevAdminToken } from './dev-env.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

function protocolHeader() {
  const built = join(root, 'apps', 'desktop', 'out', 'main', 'contracts', 'protocol.js')
  try {
    const { PROTOCOL_VERSION, PROTOCOL_VERSION_HEADER } = require(built)
    return { [PROTOCOL_VERSION_HEADER]: String(PROTOCOL_VERSION) }
  } catch {
    throw new Error(`built contracts missing at ${built} — run \`pnpm build\``)
  }
}

function headers() {
  return {
    authorization: `Bearer ${ensureDevAdminToken()}`,
    'content-type': 'application/json',
    ...protocolHeader(),
  }
}

async function unwrap(response, procedure) {
  // A failing route may answer with HTML (the static handler) rather than JSON, so parse
  // defensively — but keep the raw text in the message when it will not parse, or the real
  // cause disappears behind a bare status code.
  const text = await response.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    if (!response.ok)
      throw new Error(`${procedure} failed: ${response.status} ${text.slice(0, 200)}`)
    throw new Error(`${procedure} returned a non-JSON body: ${text.slice(0, 200)}`)
  }
  if (!response.ok) {
    const message = body?.error?.message ?? body?.error?.json?.message ?? response.status
    throw new Error(`${procedure} failed: ${message}`)
  }
  return body?.result?.data
}

export async function adminQuery(procedure, input, port = DEV_PORT) {
  const query = input === undefined ? '' : `?input=${encodeURIComponent(JSON.stringify(input))}`
  const response = await fetch(`http://127.0.0.1:${port}/trpc/${procedure}${query}`, {
    headers: headers(),
  })
  return unwrap(response, procedure)
}

export async function adminMutation(procedure, input, port = DEV_PORT) {
  const response = await fetch(`http://127.0.0.1:${port}/trpc/${procedure}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(input ?? null),
  })
  return unwrap(response, procedure)
}

/** A clear failure beats a stack of ECONNREFUSED from every later call. */
export async function assertDaemonReachable(port = DEV_PORT) {
  try {
    await adminQuery('recentRepos', undefined, port)
  } catch (error) {
    throw new Error(
      `no dev daemon answering on 127.0.0.1:${port} (admin token: ${DEV_ADMIN_TOKEN_FILE})\n` +
        `  start one: pnpm dev:daemon\n  cause: ${error instanceof Error ? error.message : error}`,
    )
  }
}
