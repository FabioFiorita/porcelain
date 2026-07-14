import type { DriverRegistry } from '../types'
import { claudeDriver } from './claude'
import { codexDriver } from './codex'
import { createFakeDriver } from './fake'
import { grokDriver } from './grok'
import { opencodeDriver } from './opencode'

// PORCELAIN_AGENT_FAKE swaps every provider slot for a scripted in-process fake so the
// Playwright e2e suite can drive a real agent turn without the actual CLIs (see fake.ts).
function buildDrivers(): DriverRegistry {
  if (process.env.PORCELAIN_AGENT_FAKE === '1') {
    return {
      claude: createFakeDriver('claude'),
      codex: createFakeDriver('codex'),
      opencode: createFakeDriver('opencode'),
      grok: createFakeDriver('grok'),
    }
  }
  return {
    claude: claudeDriver,
    codex: codexDriver,
    opencode: opencodeDriver,
    grok: grokDriver,
  }
}

/** The provider→driver map the agent-manager resolves a thread's driver from. */
export const drivers: DriverRegistry = buildDrivers()
