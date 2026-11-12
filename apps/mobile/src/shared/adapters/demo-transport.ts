import { Schema } from 'effect';
import type { Transport } from '@porcelain/client/transport';
import { ENVIRONMENT_PROTOCOL } from '@porcelain/contracts/shared';
import {
  readServiceUpdateResponseSchema,
  readReviewGitSettingsResponseSchema,
} from '@porcelain/contracts/access';
import {
  readInventoryResponseSchema,
  listFilePreferencesResponseSchema,
} from '@porcelain/contracts/projects';
import {
  readTextFileResponseSchema,
  listDirectoryResponseSchema,
  listWorktreePathsResponseSchema,
} from '@porcelain/contracts/files';
import {
  readChangesResponseSchema,
  readGitStatusResponseSchema,
  readWorktreeSummaryResponseSchema,
  readChangeDiffsResponseSchema,
  readChangeLinesResponseSchema,
  listReviewedFilesResponseSchema,
  setReviewedFilesResponseSchema,
  listCommitsResponseSchema,
  listFileCommitsResponseSchema,
  readCommitFilesResponseSchema,
  readCommitDiffsResponseSchema,
  listBranchBasesResponseSchema,
  readBranchChangesResponseSchema,
  readBranchDiffsResponseSchema,
} from '@porcelain/contracts/changes';
import {
  readWalkthroughResponseSchema,
  walkthroughConversationsResponseSchema,
  walkthroughWriterSettingsSchema,
  type WalkthroughConversationsResponse,
} from '@porcelain/contracts/walkthroughs';
import {
  demoRemote,
  demoProjectId,
  demoWorktreeId,
  demoHead,
  demoBase,
  demoFingerprint,
  demoTime,
  demoBranch,
  demoFiles,
  demoOldText,
  demoPatch,
  demoInventory,
  demoChanges,
  demoCommits,
  demoWalkthrough,
} from './demo-data';

function jsonResponse(value: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: { 'content-type': 'application/json' },
  });
}

function json<A, I>(schema: Schema.Codec<A, I>, value: A) {
  return jsonResponse(Schema.encodeSync(schema)(value));
}

const markInput = Schema.Struct({
  path: Schema.String,
  fingerprint: Schema.String,
});
const pathsInput = Schema.Struct({
  paths: Schema.Array(Schema.Array(Schema.String)),
});
const questionInput = Schema.Struct({
  anchor: Schema.Union([
    Schema.Struct({ kind: Schema.Literal('walkthrough') }),
    Schema.Struct({ kind: Schema.Literal('stop'), title: Schema.String }),
  ]),
  text: Schema.String,
});

export function demoMetadata(url: URL): Response | undefined {
  if (url.origin !== demoRemote.address) return undefined;
  if (url.pathname === '/api/health')
    return jsonResponse({
      status: 'ok',
      environmentId: demoRemote.environmentId,
    });
  if (url.pathname === '/api/environment')
    return jsonResponse({
      environmentId: demoRemote.environmentId,
      name: demoRemote.name,
      version: null,
      protocol: ENVIRONMENT_PROTOCOL,
    });
  if (url.pathname === '/api/session')
    return jsonResponse({
      kind: 'device',
      environmentId: demoRemote.environmentId,
      deviceId: demoRemote.environmentId,
      trusted: false,
    });
  return jsonResponse(
    {
      message:
        'This action needs a connected computer and is unavailable in the demo.',
    },
    { status: 422 },
  );
}

export function createDemoTransport(): Transport {
  const files = new Map(Object.entries(demoFiles));
  const reviewedScopes = new Map<
    string,
    Map<string, { path: string; fingerprint: string; reviewedAt: string }>
  >();
  let conversations: WalkthroughConversationsResponse['conversations'] = [];
  let preferences: { path: string; pinned: boolean; hidden: boolean }[] = [];
  const worktree = `/api/worktrees/${demoWorktreeId}`;
  const original = (path: string) =>
    path === 'src/welcome.ts' ? demoOldText : (demoFiles[path] ?? '');
  const diff = { kind: 'text' as const, patch: demoPatch };
  const commitPaths = (oid: string) =>
    oid === demoHead
      ? ['src/welcome.ts', 'src/welcome.test.ts']
      : ['README.md'];
  const committedDiff = (path: string) => {
    const text =
      path === 'src/welcome.ts' ? demoOldText : (demoFiles[path] ?? '');
    const lines = text.trimEnd().split('\n');
    return {
      kind: 'text' as const,
      patch: `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${lines.length} @@\n${lines.map((line) => `+${line}`).join('\n')}\n`,
    };
  };

  return async (input, init) => {
    const url = new URL(input, demoRemote.address);
    const path = url.pathname;
    const method = init?.method?.toUpperCase() ?? 'GET';
    if (
      url.origin !== demoRemote.address ||
      (path.startsWith('/api/worktrees/') &&
        !path.startsWith(`${worktree}/`)) ||
      (path.startsWith('/api/projects/') &&
        !path.startsWith(`/api/projects/${demoProjectId}/`))
    )
      return jsonResponse({ message: 'Not a demo resource.' }, { status: 404 });
    const body: unknown = init?.body
      ? await new Response(init.body).json()
      : {};
    if (path === '/api/service/update' && method === 'GET')
      return json(readServiceUpdateResponseSchema, {
        managed: false,
        version: undefined,
        latest: undefined,
        available: false,
        running: false,
        last: undefined,
        canUpdate: false,
      });
    if (path === '/api/review-git-settings' && method === 'GET')
      return json(readReviewGitSettingsResponseSchema, {
        kind: 'unconfigured',
      });
    if (path === '/api/remote-access')
      return jsonResponse(
        { message: 'The local demo has no network sharing settings.' },
        { status: 403 },
      );
    if (path === '/api/inventory' || path === '/api/inventory/refresh')
      return json(readInventoryResponseSchema, demoInventory);
    if (path.endsWith('/file-preferences')) {
      if (method === 'PUT') {
        const value = Schema.decodeUnknownSync(
          Schema.Struct({
            path: Schema.String,
            flag: Schema.Literals(['pinned', 'hidden']),
            value: Schema.Boolean,
          }),
        )(body);
        const previous = preferences.find(
          (entry) => entry.path === value.path,
        ) ?? { path: value.path, pinned: false, hidden: false };
        preferences = [
          ...preferences.filter((entry) => entry.path !== value.path),
          { ...previous, [value.flag]: value.value },
        ];
      }
      return json(listFilePreferencesResponseSchema, { preferences });
    }
    if (path.endsWith('/pull-requests'))
      return jsonResponse({
        kind: 'available',
        account: 'demo',
        pullRequests: [],
        truncated: false,
        recentlyClosedSince: demoTime,
      });
    if (path === `${worktree}/summary`)
      return json(readWorktreeSummaryResponseSchema, {
        environmentId: demoRemote.environmentId,
        worktreeId: demoWorktreeId,
        additions: 2,
        deletions: 1,
        binaryFiles: 0,
      });
    if (path === `${worktree}/changes`)
      return json(readChangesResponseSchema, demoChanges);
    if (path === `${worktree}/git/status`)
      return json(readGitStatusResponseSchema, {
        ...demoChanges,
        consistency: 'best-effort',
        branch: {
          name: demoBranch,
          upstream: undefined,
          ahead: 0,
          behind: 0,
          remoteName: undefined,
          sourceRef: undefined,
          upstreamOid: undefined,
          stashes: [],
          discarded: [],
        },
        headCommit: { subject: 'Add a welcome message' },
        changes: demoChanges.changes.flatMap((file) => file.comparisons),
      });
    if (path === `${worktree}/changes/diffs`) {
      const { selections } = Schema.decodeUnknownSync(
        Schema.Struct({
          selections: Schema.Array(
            Schema.Struct({
              scope: Schema.Literals(['staged', 'unstaged']),
              oldPath: Schema.UndefinedOr(Schema.NullOr(Schema.String)),
              newPath: Schema.UndefinedOr(Schema.NullOr(Schema.String)),
            }),
          ),
        }),
      )(body);
      return json(readChangeDiffsResponseSchema, {
        environmentId: demoRemote.environmentId,
        worktreeId: demoWorktreeId,
        statusToken: demoFingerprint,
        diffs: selections.map((selection) => ({
          selection: {
            ...selection,
            oldPath: selection.oldPath ?? undefined,
            newPath: selection.newPath ?? undefined,
          },
          content: diff,
        })),
      });
    }
    if (path === `${worktree}/changes/lines`) {
      const file = url.searchParams.get('path') ?? '';
      const from = Number(url.searchParams.get('from'));
      const to = Number(url.searchParams.get('to'));
      const at = url.searchParams.get('at') === 'head' ? 'head' : 'worktree';
      const text = at === 'head' ? original(file) : (files.get(file) ?? '');
      return json(readChangeLinesResponseSchema, {
        environmentId: demoRemote.environmentId,
        worktreeId: demoWorktreeId,
        at,
        path: file,
        from,
        to,
        lines: text.split('\n').slice(from - 1, to),
      });
    }
    if (path === `${worktree}/text`) {
      const file = url.searchParams.get('path') ?? '';
      const text = files.get(file);
      if (text === undefined)
        return jsonResponse(
          { message: 'Sample file not found.' },
          { status: 404 },
        );
      return json(readTextFileResponseSchema, {
        worktreeId: demoWorktreeId,
        path: file,
        encoding: 'utf-8',
        byteLength: new TextEncoder().encode(text).length,
        text,
        contentFingerprint: demoFingerprint,
      });
    }
    if (path === `${worktree}/paths`)
      return json(listWorktreePathsResponseSchema, {
        worktreeId: demoWorktreeId,
        paths: [...files.keys()],
      });
    if (path === `${worktree}/directory`) {
      const directory = url.searchParams.get('path') ?? '';
      const entries = new Map<string, 'file' | 'directory'>();
      for (const file of files.keys()) {
        const prefix = directory ? `${directory}/` : '';
        if (!file.startsWith(prefix)) continue;
        const rest = file.slice(prefix.length);
        const name = rest.split('/')[0];
        if (name) entries.set(name, rest.includes('/') ? 'directory' : 'file');
      }
      return json(listDirectoryResponseSchema, {
        worktreeId: demoWorktreeId,
        path: directory,
        entries: [...entries].map(([name, kind]) => ({ name, kind })),
      });
    }
    if (
      path === `${worktree}/reviewed` ||
      path === `${worktree}/reviewed-bulk`
    ) {
      const scopeInput = Schema.decodeUnknownSync(
        Schema.Struct({
          scope: Schema.optional(Schema.String),
          base: Schema.optional(Schema.String),
        }),
      )(body);
      const scope =
        scopeInput.scope ?? url.searchParams.get('scope') ?? 'worktree';
      const key = JSON.stringify([
        scope,
        scope === 'branch'
          ? (scopeInput.base ?? url.searchParams.get('branch') ?? 'main')
          : '',
      ]);
      const marks =
        reviewedScopes.get(key) ??
        new Map<
          string,
          { path: string; fingerprint: string; reviewedAt: string }
        >();
      reviewedScopes.set(key, marks);
      const reviewed = () => ({
        worktreeId: demoWorktreeId,
        marks: [...marks.values()],
      });
      if (method === 'PUT') {
        const values = path.endsWith('-bulk')
          ? Schema.decodeUnknownSync(
              Schema.Struct({ files: Schema.Array(markInput) }),
            )(body).files
          : [Schema.decodeUnknownSync(markInput)(body)];
        for (const value of values)
          marks.set(value.path, { ...value, reviewedAt: demoTime });
        if (path.endsWith('-bulk'))
          return json(setReviewedFilesResponseSchema, {
            ...reviewed(),
            marked: values.map((value) => value.path),
            conflicts: [],
          });
      }
      if (method === 'DELETE') {
        const paths = path.endsWith('-bulk')
          ? Schema.decodeUnknownSync(
              Schema.Struct({ paths: Schema.Array(Schema.String) }),
            )(body).paths
          : [url.searchParams.get('path') ?? ''];
        for (const path of paths) marks.delete(path);
      }
      return json(listReviewedFilesResponseSchema, reviewed());
    }
    if (path === `${worktree}/commits`)
      return json(listCommitsResponseSchema, demoCommits);
    if (path === `${worktree}/file-commits`)
      return json(listFileCommitsResponseSchema, {
        commits: demoCommits.commits
          .filter((commit) =>
            commitPaths(commit.oid).includes(
              url.searchParams.get('path') ?? '',
            ),
          )
          .map((commit) => ({
            commit,
            path: url.searchParams.get('path') ?? 'src/welcome.ts',
            previousPath: undefined,
            status: 'added' as const,
          })),
        nextAfter: undefined,
        tip: demoHead,
        boundary: undefined,
        restarted: false,
      });
    const commitFiles = path.match(
      new RegExp(`^${worktree}/commits/([a-f0-9]{40})/files$`),
    );
    if (commitFiles) {
      const commit = demoCommits.commits.find(
        (entry) => entry.oid === commitFiles[1],
      );
      if (!commit)
        return jsonResponse(
          { message: 'Sample commit not found.' },
          { status: 404 },
        );
      return json(readCommitFilesResponseSchema, {
        commit,
        comparison:
          commit.oid === demoHead
            ? { kind: 'parent', parentNumber: 1, baseOid: demoBase }
            : { kind: 'empty-tree' },
        files: commitPaths(commit.oid).map((path) => ({
          oldPath: undefined,
          newPath: path,
          status: 'added' as const,
          oldMode: '000000',
          newMode: '100644',
        })),
      });
    }
    if (path.match(new RegExp(`^${worktree}/commits/[a-f0-9]{40}/diffs$`))) {
      const { paths } = Schema.decodeUnknownSync(pathsInput)(body);
      return json(readCommitDiffsResponseSchema, {
        commitOid: path.split('/').at(-2) ?? demoHead,
        diffs: paths.map((paths) => ({
          paths,
          content: committedDiff(paths[0] ?? ''),
        })),
      });
    }
    if (path === `${worktree}/branch-bases`)
      return json(listBranchBasesResponseSchema, {
        defaultRef: 'main',
        bases: [{ ref: 'main', name: 'main', remote: false }],
      });
    if (path === `${worktree}/branch-changes`)
      return json(readBranchChangesResponseSchema, {
        worktreeId: demoWorktreeId,
        head: { oid: demoHead, branch: demoBranch },
        base: { ref: 'main', oid: demoBase },
        mergeBaseOid: demoBase,
        commits: 1,
        files: commitPaths(demoHead).map((path) => ({
          path,
          oldPath: undefined,
          newPath: path,
          status: 'added' as const,
          oldMode: '000000',
          newMode: '100644',
          fingerprint: demoFingerprint,
        })),
      });
    if (path === `${worktree}/branch-changes/diffs`)
      return json(readBranchDiffsResponseSchema, {
        diffs: Schema.decodeUnknownSync(pathsInput)(body).paths.map(
          (paths) => ({ paths, content: committedDiff(paths[0] ?? '') }),
        ),
      });
    if (path === '/api/walkthrough-settings' && method === 'GET')
      return json(walkthroughWriterSettingsSchema, {
        writer: demoWalkthrough.writer,
        models: [
          {
            ...demoWalkthrough.writer,
            label: 'Simulated demo',
            efforts: ['medium'],
            defaultEffort: 'medium',
          },
        ],
      });
    if (path === `${worktree}/walkthrough` && method === 'GET')
      return json(readWalkthroughResponseSchema, {
        walkthrough: demoWalkthrough,
        freshness: 'current',
      });
    const conversationPath = `${worktree}/walkthrough/${demoWalkthrough.id}/conversations`;
    const view = () => ({
      runId: demoWalkthrough.id,
      pullRequestNumber: undefined,
      conversations,
    });
    if (path === `${conversationPath}/messages` && method === 'POST') {
      const value = Schema.decodeUnknownSync(questionInput)(body);
      const id = `demo-message-${conversations.reduce((total, entry) => total + entry.messages.length, 0)}`;
      const messages: WalkthroughConversationsResponse['conversations'][number]['messages'] =
        [
          {
            author: 'developer',
            id,
            text: value.text,
            createdAt: demoTime,
            post: { status: 'none' },
          },
          {
            author: 'agent',
            id: `${id}-reply`,
            replyTo: id,
            createdAt: demoTime,
            state: {
              status: 'answered',
              text: 'Simulated demo reply: trimming removes accidental spaces. When the result is blank, the greeting uses “friend”. In a connected project, your signed-in agent answers questions about the actual change.',
              answeredAt: demoTime,
              durationMs: 0,
              costUsd: undefined,
            },
          },
        ];
      const key = JSON.stringify(value.anchor);
      const previous = conversations.find(
        (entry) => JSON.stringify(entry.anchor) === key,
      );
      conversations = [
        ...conversations.filter((entry) => entry !== previous),
        {
          runId: demoWalkthrough.id,
          anchor: value.anchor,
          messages: [...(previous?.messages ?? []), ...messages],
        },
      ];
      return json(walkthroughConversationsResponseSchema, view());
    }
    if (path === conversationPath)
      return json(walkthroughConversationsResponseSchema, view());
    if (path.startsWith(`${conversationPath}/`) && path.endsWith('/brief'))
      return jsonResponse({
        text:
          conversations
            .flatMap((entry) =>
              entry.messages.flatMap((message) =>
                message.author === 'developer' ? [message.text] : [],
              ),
            )
            .join('\n\n') || null,
      });
    if (
      path.startsWith(`${conversationPath}/messages/`) &&
      path.endsWith('/saved') &&
      method === 'PUT'
    ) {
      const { saved } = Schema.decodeUnknownSync(
        Schema.Struct({ saved: Schema.Boolean }),
      )(body);
      const id = path.split('/').at(-2);
      conversations = conversations.map((entry) => ({
        ...entry,
        messages: entry.messages.map((message) =>
          message.author === 'developer' && message.id === id
            ? { ...message, post: { status: saved ? 'saved' : 'none' } }
            : message,
        ),
      }));
      return json(walkthroughConversationsResponseSchema, view());
    }
    if (
      path === '/api/health' ||
      path === '/api/environment' ||
      path === '/api/session'
    )
      return demoMetadata(url) ?? jsonResponse({}, { status: 404 });
    return jsonResponse(
      {
        message:
          'This action needs a connected computer and is unavailable in the demo.',
      },
      { status: method === 'GET' ? 404 : 422 },
    );
  };
}
