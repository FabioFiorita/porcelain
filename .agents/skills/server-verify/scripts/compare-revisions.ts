import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { request } from 'node:http';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { Schema } from 'effect';
import { connectionSchema } from '../../verify-core/connection.ts';
import {
  compareReviewResponseSchema,
  readReviewInterdiffResponseSchema,
} from '@porcelain/contracts/reviews';

export async function compareRevisions(
  connectionPath: string,
): Promise<string> {
  const card = Schema.decodeUnknownSync(connectionSchema)(
    JSON.parse(await readFile(connectionPath, 'utf8')),
  );
  const credentialPath = card.credentialFiles.fixture;
  if (credentialPath === undefined)
    throw new Error('Missing fixture credential file');
  const credentialSchema = Schema.Struct({ credential: Schema.String });
  const { credential } = Schema.decodeUnknownSync(credentialSchema)(
    JSON.parse(await readFile(credentialPath, 'utf8')),
  );
  const headers = {
    authorization: `Bearer ${credential}`,
    origin: card.requiredOrigin.http,
    'content-type': 'application/json',
  };
  const repository = card.fixtures.repositoryPath;
  const worktree = join(card.fixtures.projectHome, 'revision-comparison');
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
  const evidence: object[] = [];
  async function http(path: string, method = 'GET', body?: object) {
    const response = await fetch(`${card.serverUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get('content-type') ?? '',
      /application\/json/,
    );
    const answer: unknown = await response.json();
    evidence.push({
      path,
      method,
      status: response.status,
      contentType: response.headers.get('content-type'),
      body: answer,
    });
    return answer;
  }
  const toolReplySchema = Schema.Struct({
    result: Schema.Struct({
      content: Schema.Array(Schema.Struct({ text: Schema.String })),
    }),
  });
  async function mcp(name: string, input: object) {
    const raw = await new Promise<string>((resolve, reject) => {
      const req = request(
        {
          socketPath: card.ownerSocketPath,
          path: '/mcp',
          method: 'POST',
          headers: {
            accept: 'application/json, text/event-stream',
            'content-type': 'application/json',
            'x-porcelain-cwd': worktree,
            'mcp-protocol-version': '2026-07-28',
            'mcp-method': 'tools/call',
            'mcp-name': name,
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('error', reject);
          response.on('end', () =>
            response.statusCode === 200
              ? resolve(Buffer.concat(chunks).toString('utf8'))
              : reject(new Error(`MCP HTTP ${response.statusCode}`)),
          );
        },
      );
      req.on('error', reject);
      req.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: randomUUID(),
          method: 'tools/call',
          params: {
            name,
            arguments: { cwd: worktree, ...input },
            _meta: {
              'io.modelcontextprotocol/protocolVersion': '2026-07-28',
              'io.modelcontextprotocol/clientCapabilities': {},
            },
          },
        }),
      );
    });
    const text = Schema.decodeUnknownSync(toolReplySchema)(JSON.parse(raw))
      .result.content[0]?.text;
    if (text === undefined) throw new Error('No MCP tool response');
    const answer: unknown = JSON.parse(text);
    return answer;
  }
  const publishedSchema = Schema.Struct({
    reviewId: Schema.String,
    revision: Schema.Int,
    headOid: Schema.String,
    baseOid: Schema.String,
  });
  const threadSchema = Schema.Struct({ id: Schema.String });
  git(repository, 'config', 'user.name', 'Porcelain Verification');
  git(repository, 'config', 'user.email', 'verify@example.invalid');
  git(repository, 'add', '-A');
  if (git(repository, 'status', '--porcelain') !== '')
    git(repository, 'commit', '-qm', 'Prepare comparison baseline');
  git(repository, 'branch', 'comparison-base');
  git(repository, 'worktree', 'add', '-b', 'revision-comparison', worktree);
  const layerId = randomUUID();
  const stepId = randomUUID();
  const draft = {
    base: 'refs/heads/comparison-base',
    verdict: {
      asked: { text: 'Verify revision comparison across rebase' },
      recommendation: 'merge',
      reasons: ['The two pinned revisions explain the requested delta'],
      notProven: [],
      removed: [],
    },
    layers: [
      {
        id: layerId,
        title: 'Compare one decision',
        summary: 'A retained decision',
        lanes: ['Code'],
        steps: [
          {
            id: stepId,
            lane: 0,
            title: 'Decision',
            text: 'Compare the head blobs',
            kind: 'changed',
            pointer: { path: 'decision.ts', startLine: 1, endLine: 1 },
          },
        ],
      },
    ],
  };
  await writeFile(
    join(worktree, 'decision.ts'),
    'export const decision = 1;\n',
  );
  await writeFile(join(worktree, 'stable.ts'), 'export const stable = true;\n');
  git(worktree, 'add', '-A');
  git(worktree, 'commit', '-qm', 'Publish the first decision');
  const first = Schema.decodeUnknownSync(publishedSchema)(
    await mcp('publish_review', {
      ...draft,
      expectedRevision: 0,
      proof: { checks: [{ name: 'comparison fixture', result: 'fail' }] },
    }),
  );
  evidence.push({ publication: first });
  const url = `/api/reviews/${first.reviewId}`;
  await http(`${url}/seen`, 'PUT', { revision: 1 });
  for (const path of ['decision.ts', 'stable.ts'])
    await http(`${url}/marks`, 'PUT', {
      kind: 'file',
      revision: 1,
      path,
      headBlobOid: git(worktree, 'rev-parse', `HEAD:${path}`),
    });
  const thread = Schema.decodeUnknownSync(threadSchema)(
    await mcp('create_comment', {
      reviewId: first.reviewId,
      anchor: { kind: 'change' },
      body: 'An agent message after revision one.',
    }),
  );
  await mcp('resolve_comment', {
    reviewId: first.reviewId,
    threadId: thread.id,
    resolved: true,
  });
  await writeFile(
    join(worktree, 'decision.ts'),
    'export const decision = 2;\n',
  );
  git(worktree, 'commit', '-am', 'Revise only the decision file');
  git(repository, 'checkout', 'comparison-base');
  await writeFile(
    join(repository, 'unrelated-main.ts'),
    'export const unrelated = true;\n',
  );
  git(repository, 'add', 'unrelated-main.ts');
  git(repository, 'commit', '-qm', 'Advance the base');
  git(worktree, 'rebase', 'comparison-base');
  const directRangeFiles = git(
    worktree,
    'diff',
    '--name-only',
    first.headOid,
    'HEAD',
  ).split('\n');
  assert.deepEqual(directRangeFiles, ['decision.ts', 'unrelated-main.ts']);
  evidence.push({
    rebase: {
      fromHead: first.headOid,
      toHead: git(worktree, 'rev-parse', 'HEAD'),
      base: git(worktree, 'rev-parse', 'comparison-base'),
      directRangeFiles,
    },
  });
  const second = Schema.decodeUnknownSync(publishedSchema)(
    await mcp('publish_review', {
      ...draft,
      expectedRevision: 1,
      proof: { checks: [{ name: 'comparison fixture', result: 'pass' }] },
    }),
  );
  assert.equal(second.reviewId, first.reviewId);
  assert.equal(second.revision, 2);
  evidence.push({ publication: second });
  const compare = Schema.decodeUnknownSync(compareReviewResponseSchema)(
    await http(`${url}/compare?from=1&to=2`),
  );
  assert.deepEqual(compare.comparison?.files, [
    {
      path: 'decision.ts',
      change: 'changed',
      headChanged: true,
      baseChanged: false,
    },
    {
      path: 'stable.ts',
      change: 'unchanged',
      headChanged: false,
      baseChanged: false,
    },
  ]);
  assert.equal(compare.comparison.fileMarks.carriedCount, 1);
  assert.equal(compare.comparison.conversation.agentMessageCount, 1);
  assert.deepEqual(compare.comparison.conversation.resolvedThreadIds, [
    thread.id,
  ]);
  const diff = Schema.decodeUnknownSync(readReviewInterdiffResponseSchema)(
    await http(`${url}/interdiff?from=1&to=2&path=decision.ts`),
  );
  assert.equal(diff.kind, 'diff');
  if (diff.kind !== 'diff') throw new Error('Expected file interdiff');
  const content = diff.diffs[0]?.content;
  assert.equal(content?.kind, 'text');
  if (content?.kind !== 'text') throw new Error('Expected text interdiff');
  assert.match(content.patch, /-export const decision = 1;/);
  assert.match(content.patch, /\+export const decision = 2;/);
  git(repository, 'worktree', 'remove', worktree);
  git(repository, 'branch', '-D', 'revision-comparison');
  git(repository, 'gc', '--prune=now');
  assert.deepEqual(
    Schema.decodeUnknownSync(compareReviewResponseSchema)(
      await http(`${url}/compare?from=1&to=2`),
    ),
    compare,
  );
  assert.deepEqual(
    Schema.decodeUnknownSync(readReviewInterdiffResponseSchema)(
      await http(`${url}/interdiff?from=1&to=2&path=decision.ts`),
    ),
    diff,
  );
  const evidencePath = join(card.evidenceDirectory, 'revision-comparison.json');
  await writeFile(
    evidencePath,
    JSON.stringify({ build: card.build, evidence }, null, 2),
  );
  return `${evidencePath}\n`;
}
