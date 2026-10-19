import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Schema } from 'effect';
import {
  createCommentThreadResponseSchema,
  type PublishReviewRequest,
} from '@porcelain/contracts/reviews';
import { type Recorder, type ServerHandle } from './isolated-server.ts';
import { toolCall, toolResult } from './requests.ts';
import {
  developmentCommits,
  developmentFiles,
} from './development-sample-files.ts';

export async function seedDevelopmentSample(
  server: ServerHandle,
  recorder: Recorder,
) {
  const session = server.session(recorder, await server.sampleIds());
  if (
    (await session.git('status', '--porcelain')).trim() !== 'M README.md' ||
    (await session.git('rev-list', '--count', 'HEAD')).trim() !== '1'
  )
    throw new Error('The development sample needs a fresh disposable fixture.');

  const write = async (path: string, text: string) => {
    await mkdir(dirname(join(session.repository, path)), { recursive: true });
    await session.writeFile(path, text);
  };
  await session.writeFile(
    session.fixture.readme.path,
    session.fixture.readme.committed,
  );
  for (const commit of developmentCommits) {
    for (const path of commit.paths) await write(path, developmentFiles[path]);
    await session.git('add', '--', ...commit.paths);
    await session.git('commit', '-m', commit.title);
  }
  await session.git('switch', '-c', 'demo/offline-cache');
  for (const path of [
    'docs/offline-sync.md',
    'src/lib/offline-cache.ts',
  ] as const)
    await write(path, developmentFiles[path]);
  await session.git(
    'add',
    '--',
    'docs/offline-sync.md',
    'src/lib/offline-cache.ts',
  );
  await session.git('commit', '-m', 'Queue offline dispatch notes');
  await session.git('switch', session.fixture.branch);
  for (const path of [
    'src/api/read-shipments.ts',
    'docs/architecture/events.md',
  ] as const)
    await write(path, developmentFiles[path]);
  await session.git(
    'mv',
    'docs/operations/checklist.md',
    'docs/operations/release-checklist.md',
  );
  await session.remove('docs/legacy/deployment.txt');
  await session.git('add', '-A');
  await session.git(
    'commit',
    '-m',
    'Document dispatch events and release handoff',
  );
  await session.git(
    'merge',
    '--no-ff',
    'demo/offline-cache',
    '-m',
    'Merge offline dispatch queue',
  );
  await session.git('branch', '-f', 'porcelain-fixture-base', 'HEAD');
  const secondary = join(server.projectHome, 'offline-cache');
  await session.git('worktree', 'add', secondary, 'demo/offline-cache');

  await write(
    'src/domain/shipment.ts',
    developmentFiles['src/domain/shipment.ts']
      .replace("'delivered';", "'delivered' | 'awaiting-documents';")
      .replace(
        '  readonly owner: string;',
        '  readonly owner: string;\n  readonly nextAction?: string;',
      ),
  );
  await write(
    'src/lib/status-tone.ts',
    developmentFiles['src/lib/status-tone.ts'].replace(
      "    case 'delayed': return 'warning';",
      "    case 'delayed': return 'warning';\n    case 'awaiting-documents': return 'warning';",
    ),
  );
  await write(
    'src/ui/shipment-card.tsx',
    developmentFiles['src/ui/shipment-card.tsx'].replace(
      '      <p>Dispatcher: {shipment.owner}</p>',
      '      <p>Dispatcher: {shipment.owner}</p>\n      {shipment.nextAction ? <p>Next: {shipment.nextAction}</p> : null}',
    ),
  );
  await write(
    'src/api/read-shipments.ts',
    developmentFiles['src/api/read-shipments.ts']
      .replace(
        'readonly routeId?: string',
        'readonly routeId?: string; readonly includeDelivered?: boolean',
      )
      .replace(
        '    query.routeId === undefined || row.routeId === query.routeId,',
        "    (query.routeId === undefined || row.routeId === query.routeId) &&\n    (query.includeDelivered === true || row.status !== 'delivered'),",
      ),
  );
  await session.git(
    'mv',
    'docs/operations/dispatch.md',
    'docs/operations/dispatch-guide.md',
  );
  await session.remove('docs/operations/release-checklist.md');
  await write(
    'docs/operations/escalation.md',
    '# Escalating a document hold\n\n1. Keep the shipment visible in the dispatch queue.\n2. Read the next action on its card.\n3. Ask the dispatcher to confirm the missing document.\n4. Record the next check time.\n',
  );
  await write(
    'src/ui/shipment-filters.tsx',
    'export function ShipmentFilters({ includeDelivered, onChange }: { includeDelivered: boolean; onChange: (value: boolean) => void }) {\n  return <label><input type="checkbox" checked={includeDelivered} onChange={(event) => onChange(event.currentTarget.checked)} />Include delivered shipments</label>;\n}\n',
  );
  for (const [path, text] of [
    [
      'docs/offline-sync.md',
      developmentFiles['docs/offline-sync.md'] +
        '\n## Pending branch work\n\nKeep queued notes in oldest-first order and show the next retry time.\n',
    ],
    [
      'src/lib/offline-cache.ts',
      developmentFiles['src/lib/offline-cache.ts'] +
        '\nexport function pendingNoteCount(queue: readonly QueuedNote[], shipmentId: string) {\n  return queue.filter((note) => note.shipmentId === shipmentId).length;\n}\n',
    ],
    [
      'docs/offline-walkthrough.md',
      '# Offline branch walkthrough\n\nThis worktree has different pending changes. Compare its history and return to main for the published review.\n',
    ],
  ] as const) {
    await writeFile(join(secondary, path), text);
    recorder.steps.push({
      phase: recorder.phase,
      kind: 'write',
      path: join(secondary, path),
      bytes: Buffer.byteLength(text),
    });
  }
  await session.read({ method: 'POST', path: '/api/inventory/refresh' }, 200);

  await session.git('add', '-A');
  await session.git('commit', '-m', 'Keep document holds visible');
  const review: PublishReviewRequest = {
    base: 'refs/heads/porcelain-fixture-base',
    verdict: {
      asked: { text: 'Show the dispatch document-hold decisions' },
      recommendation: 'hold',
      reasons: ['This synthetic fixture demonstrates review reading'],
      notProven: [
        { what: 'Application checks', why: 'Synthetic source-reading fixture' },
      ],
      removed: [
        {
          behavior: 'Release checklist',
          why: 'The dispatch guide and escalation procedure replace it',
          paths: ['docs/operations/release-checklist.md'],
        },
      ],
    },
    expectedRevision: 0,
    summaryHtml:
      '<!doctype html><h1>Dispatch document holds</h1><p>This synthetic source-reading sample adds a document hold status, keeps the next action visible, and explains the dispatch handoff. Application checks have not been run.</p>',
    layers: await Promise.all(
      [
        {
          title: 'Keep document holds visible',
          summary:
            'Carry the status and next action from the model into the card.',
          paths: [
            'src/domain/shipment.ts',
            'src/lib/status-tone.ts',
            'src/ui/shipment-card.tsx',
          ],
        },
        {
          title: 'Filter completed deliveries',
          summary:
            'Hide completed shipments unless the dispatcher asks to see them.',
          paths: ['src/api/read-shipments.ts', 'src/ui/shipment-filters.tsx'],
        },
        {
          title: 'Explain the dispatch handoff',
          summary: 'Rename the guide and add a document escalation procedure.',
          paths: [
            'docs/operations/dispatch-guide.md',
            'docs/operations/escalation.md',
          ],
        },
      ].map(async (layer) => ({
        id: randomUUID(),
        title: layer.title,
        summary: layer.summary,
        lanes: ['Implementation'],
        steps: await Promise.all(
          layer.paths.map(async (path) => ({
            id: randomUUID(),
            lane: 0,
            title: path,
            text: layer.summary,
            kind: 'changed' as const,
            pointer: {
              path,
              startLine: 1,
              endLine: (await session.readFile(path)).split('\n').length - 1,
            },
          })),
        ),
      })),
    ),
  };
  const published = await session.read(
    toolCall(session, 1, 'publish_review', review),
    200,
  );
  if (toolResult(published.body).isError === true)
    throw new Error('Development review publication failed');
  const comment = Schema.decodeUnknownSync(createCommentThreadResponseSchema)(
    (
      await session.read(
        {
          method: 'POST',
          path: `/api/worktrees/${session.worktreeId}/comments`,
          body: {
            anchor: { kind: 'file', filePath: 'src/domain/shipment.ts' },
            body: 'Should a document hold stay visible until the dispatcher records the next action?',
          },
        },
        200,
      )
    ).body,
  );
  const replied = await session.read(
    toolCall(session, 2, 'reply_to_comment', {
      threadId: comment.id,
      body: 'Yes. The pending status and card changes keep the hold and its next action visible.',
    }),
    200,
  );
  if (toolResult(replied.body).isError === true)
    throw new Error('Development comment reply failed');
  await session.read(
    {
      method: 'POST',
      path: `/api/worktrees/${session.worktreeId}/comments`,
      body: {
        anchor: {
          kind: 'codeRange',
          filePath: 'src/api/read-shipments.ts',
          startLine: 5,
          endLine: 8,
          side: 'additions',
        },
        body: 'Please keep the delivered filter independent of route selection.',
      },
    },
    200,
  );
}
