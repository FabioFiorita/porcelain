import { homedir } from 'node:os'
import { join } from 'node:path'
import { PLUGIN_NAME, PLUGIN_VERSION } from './plugin-assets'

export const CODEX_MARKETPLACE_NAME = 'porcelain-local'

export function codexMarketplaceDir(): string {
  return join(homedir(), '.porcelain', 'codex-plugin')
}

export function codexPluginDir(): string {
  return join(codexMarketplaceDir(), 'plugins', PLUGIN_NAME)
}

export function codexMarketplaceManifest(): Record<string, unknown> {
  return {
    name: CODEX_MARKETPLACE_NAME,
    interface: {
      displayName: 'Porcelain Local',
    },
    plugins: [
      {
        name: PLUGIN_NAME,
        source: {
          source: 'local',
          path: `./plugins/${PLUGIN_NAME}`,
        },
        policy: {
          installation: 'AVAILABLE',
          authentication: 'ON_INSTALL',
        },
        category: 'Productivity',
      },
    ],
  }
}

export function codexPluginManifest(version: string): Record<string, unknown> {
  return {
    name: PLUGIN_NAME,
    version,
    description:
      'Porcelain companion plugin for feature review sets, review comments, project boards, saved actions, notes, and flow layers.',
    author: {
      name: 'Porcelain',
    },
    homepage: 'https://github.com/FabioFiorita/porcelain',
    repository: 'https://github.com/FabioFiorita/porcelain',
    license: 'MIT',
    keywords: ['porcelain', 'code-review', 'mcp', 'project-board'],
    skills: './skills/',
    interface: {
      displayName: 'Porcelain',
      shortDescription: 'Send review context from Codex to Porcelain.',
      longDescription:
        "Porcelain lets Codex define whole-feature review sets, read and resolve human review comments, inspect reviewed marks and project notes, manage project-board cards and saved actions, and tune review-flow layers through Porcelain's local MCP server.",
      developerName: 'Porcelain',
      category: 'Productivity',
      capabilities: ['MCP', 'Skills', 'Code Review', 'Project Management'],
      defaultPrompt: [
        'Set up a Porcelain feature review for this change.',
        'Check my Porcelain review comments.',
        'What is on my Porcelain project board?',
      ],
    },
    mcpServers: './.mcp.json',
  }
}

export function codexMcpManifest(): Record<string, unknown> {
  return {
    mcpServers: {
      porcelain: {
        command: 'node',
        args: ['./server.js'],
      },
    },
  }
}

/**
 * Install (and re-install/upgrade) the local Codex plugin. Unlike Claude — which
 * has `marketplace update`/`plugin update` verbs — a Codex LOCAL marketplace is a
 * point-in-time snapshot taken at `marketplace add`, and `marketplace upgrade`
 * only refreshes *Git* sources. So a plain `add` + `add` re-run would silently keep
 * the OLD snapshot, never picking up a bumped PLUGIN_VERSION. We therefore drop the
 * plugin + marketplace first and re-add, which re-snapshots the freshly-written
 * files. The `|| true` on the removes keeps the first install (nothing to remove
 * yet) from failing the `&&`-joined chain; the trailing `add`s still gate success.
 */
export function codexInstallCommands(): string[] {
  const plugin = `${PLUGIN_NAME}@${CODEX_MARKETPLACE_NAME}`
  return [
    `codex plugin remove ${plugin} || true`,
    `codex plugin marketplace remove ${CODEX_MARKETPLACE_NAME} || true`,
    `codex plugin marketplace add ${codexMarketplaceDir()}`,
    `codex plugin add ${plugin}`,
  ]
}

export function codexPluginVersion(): string {
  return PLUGIN_VERSION
}
