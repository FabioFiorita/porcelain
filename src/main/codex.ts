import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  codexInstallCommands,
  codexMarketplaceDir,
  codexMarketplaceManifest,
  codexMcpManifest,
  codexPluginDir,
  codexPluginManifest,
  codexPluginVersion,
} from './codex-assets'
import { builtServerPath, type PluginInstallResult, runInstall } from './plugin'
import { SKILLS } from './plugin-assets'

export interface CodexInstallResult extends Omit<PluginInstallResult, 'marketplaceDir'> {
  marketplaceDir: string
}

export async function writeCodexPluginFiles(): Promise<string> {
  const root = codexMarketplaceDir()
  const plugin = codexPluginDir()
  await mkdir(join(root, '.agents', 'plugins'), { recursive: true })
  await mkdir(join(plugin, '.codex-plugin'), { recursive: true })

  await writeFile(
    join(root, '.agents', 'plugins', 'marketplace.json'),
    JSON.stringify(codexMarketplaceManifest(), null, 2),
  )
  await writeFile(
    join(plugin, '.codex-plugin', 'plugin.json'),
    JSON.stringify(codexPluginManifest(codexPluginVersion()), null, 2),
  )
  await writeFile(join(plugin, '.mcp.json'), JSON.stringify(codexMcpManifest(), null, 2))
  for (const skill of SKILLS) {
    const dir = join(plugin, 'skills', skill.name)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'SKILL.md'), skill.content)
  }
  await copyFile(builtServerPath(), join(plugin, 'server.js'))
  return root
}

export async function installCodex(): Promise<CodexInstallResult> {
  const marketplaceDir = await writeCodexPluginFiles()
  const commands = codexInstallCommands()
  const result = await runInstall(commands)
  return { ...result, marketplaceDir, commands }
}
