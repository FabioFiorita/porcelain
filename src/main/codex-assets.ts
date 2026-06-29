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

export function codexInstallCommands(): string[] {
  return [
    `codex plugin marketplace add ${codexMarketplaceDir()}`,
    `codex plugin add ${PLUGIN_NAME}@${CODEX_MARKETPLACE_NAME}`,
  ]
}

export function codexPluginVersion(): string {
  return PLUGIN_VERSION
}
