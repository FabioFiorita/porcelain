import type { DriverRegistry } from '../types'
import { claudeDriver } from './claude'
import { codexDriver } from './codex'
import { opencodeDriver } from './opencode'

/** The provider→driver map the agent-manager resolves a thread's driver from. */
export const drivers: DriverRegistry = {
  claude: claudeDriver,
  codex: codexDriver,
  opencode: opencodeDriver,
}
