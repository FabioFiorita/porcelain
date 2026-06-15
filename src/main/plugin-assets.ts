import { homedir } from 'node:os'
import { join } from 'node:path'

// Pure plugin definitions — no electron/fs imports, so this is unit-testable.
// The side-effecting installer (writes files, copies the built server, runs the
// `claude` CLI) lives in plugin.ts.

export const PLUGIN_NAME = 'porcelain'
export const MARKETPLACE_NAME = 'porcelain'
export const REVIEW_SKILL_NAME = 'review-with-porcelain'

/**
 * The local Claude Code marketplace root the app writes. Lives in ~/.porcelain
 * (the user's home, NOT a work repo) alongside the agent channel. Copying the
 * built MCP server here makes it a real, runnable file even when the app itself
 * is packaged inside app.asar.
 */
export function pluginMarketplaceDir(): string {
  return join(homedir(), '.porcelain', 'plugin')
}

export function marketplaceManifest(): Record<string, unknown> {
  return {
    name: MARKETPLACE_NAME,
    owner: { name: 'Porcelain' },
    description: 'Porcelain — feature-review companion plugin.',
    plugins: [
      {
        name: PLUGIN_NAME,
        source: `./${PLUGIN_NAME}`,
        description: 'Push feature review sets to the Porcelain app (MCP server + review skill).',
      },
    ],
  }
}

export function pluginManifest(version: string): Record<string, unknown> {
  return {
    name: PLUGIN_NAME,
    description:
      'Feature-review companion: push review sets to the Porcelain app so a human can review the whole feature in flow order.',
    version,
    author: { name: 'Porcelain' },
    // Inline stdio MCP server; ${CLAUDE_PLUGIN_ROOT} resolves to the installed
    // plugin dir, where the installer copies the bundled server.js.
    mcpServers: {
      porcelain: {
        command: 'node',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: literal placeholder Claude Code expands at runtime, not a JS template
        args: ['${CLAUDE_PLUGIN_ROOT}/server.js'],
      },
    },
  }
}

/** The two non-interactive CLI commands that register + install the local plugin. */
export function installCommands(): string[] {
  return [
    `claude plugin marketplace add ${pluginMarketplaceDir()}`,
    `claude plugin install ${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
  ]
}

export const REVIEW_SKILL = `---
name: ${REVIEW_SKILL_NAME}
description: Push a feature review set to the Porcelain app so a human can review the WHOLE feature (including server/cross-seam files that aren't in the git diff) in flow order. Use after implementing, or while working on, a multi-file feature — especially one that spans the client/server seam.
---

# Review with Porcelain

Porcelain is a macOS review companion that shows a "feature view": the whole feature in flow order (entry point → data), not just the git diff. You built the feature, so you know its true boundary — hand it over so the human reviews the complete picture instead of only the files that happen to have changed.

## When to use

After you implement a feature, finish a meaningful slice, or are asked to "set up the review" — especially when your change touches only part of a feature that spans many files or the client/server seam (the diff can't show the other half, because it didn't change and the link is a route string, not an import).

## How

Call the \`porcelain\` MCP tools with \`repoPath\` set to the ABSOLUTE path of the repo you're working in (your cwd):

- \`set_feature_review\` — replace the review set: \`{ repoPath, name, files: [...] }\`
- \`add_review_files\` — add files to it incrementally while you work
- \`get_feature_review\` — read back the current set (name, files, sources, notes); use it to verify what you pushed or to make an idempotent update (read → modify → \`set\`), and to recover the set if you lose context
- \`clear_feature_review\` — remove it

Each file is \`{ path, source?, note? }\`:
- \`path\` — repo-relative.
- \`source\` — OMIT for files you changed (Porcelain detects those from git). Use \`"shipped"\` for files already landed that the change depends on (the server route/controller/service, an existing endpoint), and \`"context"\` for unchanged files needed to follow the flow (shared types, constants).
- \`note\` — the cross-file invariant a reviewer must check, e.g. "labels here must match CALLOUT_TEMPLATES in the service" or "this mutation must invalidate the listX query".

## What to include

The COMPLETE feature, not just your diff:
- The files you changed (no \`source\` needed).
- The cross-seam files the diff can't show — the server route/controller/service a client change calls (\`shipped\`), and shared types or constants both sides depend on (\`context\`).
- A \`note\` on every file where there's an invariant, contract, or gotcha the reviewer would otherwise miss.

Keep it tight: the files that make up THIS feature, broad enough that the human can read it as one story from entry point to data.
`
