import { Redacted } from 'effect';
import type { Remote } from '@porcelain/client/access/rules';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import type {
  ReadChangesResponse,
  ListCommitsResponse,
} from '@porcelain/contracts/changes';
import type { readWalkthroughResponseSchema } from '@porcelain/contracts/walkthroughs';

export const demoRemote: Remote = {
  environmentId: '83d90de8-793b-4f8c-ae11-b091581c9537',
  name: 'Demo computer',
  address: 'https://demo.porcelain.invalid',
  credential: Redacted.make('local-demo'),
  deviceId: 'porcelain-demo',
};
export const demoProjectId = 'f5dd81bf-c039-4345-927a-e55315a50029';
export const demoWorktreeId = '9e939510f914ca5886ccab463c94166f';
export const demoHead = 'a'.repeat(40);
export const demoBase = 'b'.repeat(40);
export const demoFingerprint = 'c'.repeat(64);
export const demoTime = '2026-01-01T12:00:00.000Z';
export const demoBranch = 'feat/welcome-message';
export const demoFiles: Readonly<Record<string, string>> = {
  'README.md':
    '# Hello Garden\n\nA small example project for exploring Porcelain.\n\nOpen the Walkthrough to understand the change, read the diff, or explore the file history.\nAll demo data stays on this device.\n',
  'src/welcome.ts':
    'export function welcome(name: string) {\n  const trimmed = name.trim();\n  return `Hello, ${trimmed || "friend"}!`;\n}\n',
  'src/welcome.test.ts':
    'import { expect, test } from "vitest";\nimport { welcome } from "./welcome";\n\ntest("greets visitors without a name", () => {\n  expect(welcome("  ")).toBe("Hello, friend!");\n});\n',
};
export const demoOldText =
  'export function welcome(name: string) {\n  return `Hello, ${name}!`;\n}\n';
export const demoPatch =
  'diff --git a/src/welcome.ts b/src/welcome.ts\n--- a/src/welcome.ts\n+++ b/src/welcome.ts\n@@ -1,3 +1,4 @@\n export function welcome(name: string) {\n-  return `Hello, ${name}!`;\n+  const trimmed = name.trim();\n+  return `Hello, ${trimmed || "friend"}!`;\n }\n';
export const demoInventory: ReadInventoryResponse = {
  environmentId: demoRemote.environmentId,
  environment: { name: demoRemote.name, custom: true, icon: 'laptop' },
  projects: [
    {
      id: demoProjectId,
      name: 'Hello Garden',
      available: true,
      worktrees: [
        {
          id: demoWorktreeId,
          path: '/demo/hello-garden',
          main: true,
          branch: demoBranch,
          available: true,
          headCommittedAt: demoTime,
          walkthroughTitle: 'A warmer welcome for every visitor',
        },
      ],
    },
  ],
};
export const demoChanges: ReadChangesResponse = {
  environmentId: demoRemote.environmentId,
  worktreeId: demoWorktreeId,
  statusToken: demoFingerprint,
  headOid: demoHead,
  inProgress: undefined,
  mergeHeadOid: undefined,
  branch: { name: demoBranch, upstream: undefined, ahead: 0, behind: 0 },
  changes: [
    {
      path: 'src/welcome.ts',
      fingerprint: demoFingerprint,
      comparisons: [
        {
          scope: 'unstaged',
          kind: 'modified',
          oldPath: 'src/welcome.ts',
          newPath: 'src/welcome.ts',
          oldMode: '100644',
          newMode: '100644',
          oldOid: demoBase,
          newOid: undefined,
          supported: true,
        },
      ],
    },
  ],
};
export const demoCommits: ListCommitsResponse = {
  snapshot: {
    tipOid: demoHead,
    head: { kind: 'attached', ref: `refs/heads/${demoBranch}` },
  },
  commits: [
    {
      oid: demoHead,
      parentOids: [demoBase],
      author: { name: 'Garden team', timestamp: demoTime },
      subject: 'Add a welcome message',
      subjectTruncated: false,
      body: undefined,
      bodyTruncated: false,
      refs: [
        { kind: 'head', name: 'HEAD' },
        { kind: 'local-branch', name: demoBranch },
      ],
    },
    {
      oid: demoBase,
      parentOids: [],
      author: { name: 'Garden team', timestamp: '2025-12-31T12:00:00.000Z' },
      subject: 'Plant the first seed',
      subjectTruncated: false,
      body: undefined,
      bodyTruncated: false,
      refs: [{ kind: 'local-branch', name: 'main' }],
    },
  ],
  nextAfter: undefined,
  tip: demoHead,
  boundary: undefined,
  restarted: false,
};
export const demoWalkthrough: NonNullable<
  (typeof readWalkthroughResponseSchema.Type)['walkthrough']
> = {
  id: 'demo-welcome',
  pullRequestNumber: undefined,
  sessionId: undefined,
  projectId: demoProjectId,
  worktreeId: demoWorktreeId,
  baseOid: demoBase,
  headOid: demoHead,
  contentTreeOid: demoHead,
  baseRef: 'main',
  includesUncommitted: true,
  branch: demoBranch,
  writer: { provider: 'codex', model: 'sample', effort: 'medium' },
  createdAt: demoTime,
  state: {
    status: 'ready',
    writtenAt: demoTime,
    durationMs: 0,
    costUsd: undefined,
    content: {
      outcome: 'needs_you',
      title: 'A warmer welcome for every visitor',
      summary:
        'The greeting now trims whitespace and welcomes unnamed visitors as “friend”. This is a bundled example; no agent or computer is connected.',
      growth: [
        {
          change: 'changed',
          what: 'Visitor greeting',
          note: 'Blank names receive a friendly fallback.',
        },
      ],
      stops: [
        {
          title: 'Choose the fallback greeting',
          explanation:
            'Whitespace is removed before choosing the name. A blank value becomes “friend”, so every visitor receives a complete greeting.',
          attention: {
            kind: 'product',
            note: 'The fallback is visible to visitors.',
            question: 'Does “friend” fit the voice of the product?',
          },
          excerpts: [
            {
              path: 'src/welcome.ts',
              side: 'new',
              start: 1,
              end: 4,
              caption: 'Trim the name before choosing the greeting.',
            },
          ],
          evidence: [],
          files: [
            { path: 'src/welcome.ts', note: 'The greeting and fallback.' },
            {
              path: 'src/welcome.test.ts',
              note: 'An example of the intended behavior.',
            },
          ],
        },
      ],
      onlyInTranscript: [],
      stillUnclear: [],
      checks: 'Demo content only. No checks were run for this sample.',
    },
  },
};
