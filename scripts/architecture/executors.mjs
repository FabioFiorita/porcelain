#!/usr/bin/env node
/**
 * Fresh-context executor argv builders for architecture group dispatch.
 *
 * Never resume/continue. Never shell:true. Paths come from validated inputs.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'

export const GROK_BIN = join(homedir(), '.grok', 'bin', 'grok')
/** Claude Personal only — never the subscription alias `claude` as vocabulary. */
export const CLAUDE_PERSONAL_BIN = join(homedir(), '.local', 'bin', 'claude')

/**
 * @param {{ promptFile: string, cwd: string, grokBin?: string }} options
 * @returns {{ command: string, args: string[], envExtras?: Record<string, string> }}
 */
export function buildGrokInvocation(options) {
  const command = options.grokBin ?? GROK_BIN
  const args = [
    '--prompt-file',
    options.promptFile,
    '--cwd',
    options.cwd,
    '--no-subagents',
    '--no-memory',
    '--reasoning-effort',
    'high',
    '--permission-mode',
    'bypassPermissions',
    '--output-format',
    'plain',
  ]
  return { command, args }
}

/**
 * @param {{ prompt: string, cwd: string, claudeBin?: string }} options
 * @returns {{ command: string, args: string[] }}
 */
export function buildClaudePersonalInvocation(options) {
  const command = options.claudeBin ?? CLAUDE_PERSONAL_BIN
  // -p takes the prompt as a trailing argument (no prompt-file flag on this CLI).
  const args = [
    '-p',
    '--model',
    'opus',
    '--effort',
    'max',
    '--dangerously-skip-permissions',
    '--disable-slash-commands',
    options.prompt,
  ]
  return { command, args }
}

/**
 * Build argv for the named executor. Rejects unknown names and resume flags.
 * @param {'grok' | 'claude-personal'} executor
 * @param {{ promptFile: string, prompt: string, cwd: string }} options
 */
export function buildExecutorInvocation(executor, options) {
  if (executor === 'grok') {
    return buildGrokInvocation({ promptFile: options.promptFile, cwd: options.cwd })
  }
  if (executor === 'claude-personal') {
    return buildClaudePersonalInvocation({ prompt: options.prompt, cwd: options.cwd })
  }
  throw new Error(`unsupported executor: ${executor}`)
}

/** Forbidden argv tokens that would resume prior context. */
export const FORBIDDEN_CONTEXT_FLAGS = Object.freeze([
  '--continue',
  '-c',
  '--resume',
  '-r',
  '--experimental-memory',
  '--fork-session',
])

/**
 * Assert an argv list never resumes/continues a prior session.
 * @param {string[]} args
 */
export function assertFreshContextArgs(args) {
  for (const flag of FORBIDDEN_CONTEXT_FLAGS) {
    if (args.includes(flag)) {
      throw new Error(`fresh-context violation: ${flag} is forbidden`)
    }
  }
  // Grok memory must be explicitly off when present.
  if (args.includes('--experimental-memory')) {
    throw new Error('fresh-context violation: memory must stay disabled')
  }
}
