#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'

function publicConfig(environment) {
  const pnpmArgs = ['--dir', 'apps/mobile', 'exec', 'expo', 'config', '--type', 'public', '--json']
  const command = process.platform === 'win32' ? 'cmd.exe' : 'pnpm'
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'pnpm.cmd', ...pnpmArgs] : pnpmArgs
  const output = execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: environment,
  })
  return JSON.parse(output)
}

test('an omitted APP_VARIANT keeps the shipping identity', () => {
  const environment = { ...process.env }
  delete environment.APP_VARIANT
  const config = publicConfig(environment)
  assert.equal(config.ios?.bundleIdentifier, 'com.fabiofiorita.porcelain')
})

test('the local development variant has its separate identity', () => {
  const config = publicConfig({ ...process.env, APP_VARIANT: 'development' })
  assert.equal(config.ios?.bundleIdentifier, 'com.fabiofiorita.porcelain.dev')
})
