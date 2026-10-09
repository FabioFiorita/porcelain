import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Schema } from 'effect';
import { readChangesResponseSchema } from '@porcelain/contracts/changes';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import {
  readPublishedReviewResponseSchema,
  type PublishReviewRequest,
} from '@porcelain/contracts/reviews';
import type { Session } from './session.ts';

const scenarios = [
  {
    key: 'invite-member',
    title: 'Invite a teammate',
    input: 'editor',
    output: 'invitation-pending',
    rule: "if (value !== 'editor' && value !== 'viewer') throw new Error('Unsupported role');",
    decision:
      'Invitations use the same workspace policy as existing membership changes. The request cannot grant an owner role.',
    owner: 'Workspace policy',
  },
  {
    key: 'revoke-access',
    title: 'Revoke access across devices',
    input: 'session-42',
    output: 'session-revoked',
    rule: "if (!value.startsWith('session-')) throw new Error('A session identifier is required');",
    decision:
      'Revocation goes through the session owner so web and mobile observe the same invalidation event.',
    owner: 'Session owner',
  },
  {
    key: 'publish-note',
    title: 'Publish an immutable note',
    input: 'A design decision',
    output: 'revision-created',
    rule: "if (value.trim().length === 0) throw new Error('A note must contain text');",
    decision:
      'Publishing appends a revision. Editing an existing revision would erase the explanation attached to earlier reviews.',
    owner: 'Revision journal',
  },
  {
    key: 'export-history',
    title: 'Export history without blocking writes',
    input: 'revision-8',
    output: 'export-snapshot',
    rule: "if (!value.startsWith('revision-')) throw new Error('Pin an export revision');",
    decision:
      'Exports read a pinned revision through the journal, so concurrent publishing cannot mix two versions in one export.',
    owner: 'Revision journal',
  },
  {
    key: 'schedule-reminder',
    title: 'Schedule reminders durably',
    input: '2030-01-02T09:00:00Z',
    output: 'reminder-queued',
    rule: "if (!Number.isFinite(Date.parse(value))) throw new Error('A reminder date is required');",
    decision:
      'The mutation writes an outbox entry. Delivery happens separately so a network outage cannot lose the reminder.',
    owner: 'Delivery outbox',
  },
  {
    key: 'retry-delivery',
    title: 'Retry delivery without duplicate messages',
    input: 'delivery-17',
    output: 'delivery-reused',
    rule: "if (!value.startsWith('delivery-')) throw new Error('Reuse a delivery identifier');",
    decision:
      'Retry keeps the original delivery identity and goes through the existing outbox instead of creating another queue.',
    owner: 'Delivery outbox',
  },
  {
    key: 'reconnect-device',
    title: 'Reconnect with current access',
    input: 'version-3',
    output: 'session-restored',
    rule: "if (!value.startsWith('version-')) throw new Error('An access version is required');",
    decision:
      'Reconnect uses the session owner, including revocation checks. Cached client identity is not an authorization decision.',
    owner: 'Session owner',
  },
  {
    key: 'transfer-workspace',
    title: 'Transfer workspace ownership',
    input: 'confirmed-owner',
    output: 'ownership-transferred',
    rule: "if (value !== 'confirmed-owner') throw new Error('Explicit owner confirmation is required');",
    decision:
      'Ownership transfer reuses workspace policy. The new operation does not introduce a second authorization model.',
    owner: 'Workspace policy',
  },
] as const;

const stories: Record<
  (typeof scenarios)[number]['key'],
  { view: string; viewNote: string; server: string; serverNote: string }
> = {
  'invite-member': {
    view: 'Send the invitation',
    viewNote:
      "The form sends only the invitee's role. The server decides whether this actor may invite anyone.",
    server: 'Check the inviter before writing',
    serverNote:
      "Authorization runs before the invitation is written, so a viewer's request never reaches the journal.",
  },
  'revoke-access': {
    view: 'Revoke from the device list',
    viewNote:
      'The screen asks the session owner to revoke. It never deletes a session record itself.',
    server: 'Revoke through the session owner',
    serverNote:
      'Revocation is one event that every device observes, rather than a flag each client checks.',
  },
  'publish-note': {
    view: 'Publish from the editor',
    viewNote:
      'Publishing creates a new revision. The editor never overwrites an older one.',
    server: 'Append a revision',
    serverNote:
      'The handler appends with the expected version, so two publishers cannot both win.',
  },
  'export-history': {
    view: 'Request an export at a revision',
    viewNote:
      'The export names the revision it reads. It does not read whatever happens to be current.',
    server: 'Read a pinned snapshot',
    serverNote:
      'The export reads one revision through the journal. A concurrent publish lands in the next export.',
  },
  'schedule-reminder': {
    view: 'Schedule from the calendar',
    viewNote:
      'Scheduling returns as soon as the reminder is durable, without waiting for delivery.',
    server: 'Enqueue the reminder',
    serverNote:
      'The handler writes the outbox entry next to the journal append. They are separate writes today.',
  },
  'retry-delivery': {
    view: 'Retry from the failure banner',
    viewNote:
      'Retry sends the original delivery identifier back, so the server can recognize a duplicate.',
    server: 'Retry through the existing outbox',
    serverNote:
      'Retry reuses the outbox entry instead of opening a second queue, so a message cannot go out twice.',
  },
  'reconnect-device': {
    view: 'Reconnect with the cached session',
    viewNote:
      'The device offers its cached access version. The server decides whether that version is still valid.',
    server: 'Restore only current access',
    serverNote:
      'Reconnecting re-runs revocation and the version check. A cached identity is not proof of access.',
  },
  'transfer-workspace': {
    view: 'Confirm the new owner',
    viewNote:
      'The confirmation is explicit input, not something the client infers from its own state.',
    server: 'Transfer through workspace policy',
    serverNote:
      'Ownership transfer reuses workspace policy instead of adding a second permission model.',
  },
};

async function accepted(
  session: Session,
  request: Parameters<Session['send']>[0],
) {
  const response = await session.send(request);
  if (response.status !== 200)
    throw new Error(
      `Architecture sample ${request.method} ${request.path}: ${response.status}`,
    );
  return response.body;
}

export async function seedArchitectureSample(session: Session) {
  const inventory = Schema.decodeUnknownSync(readInventoryResponseSchema)(
    await accepted(session, { method: 'GET', path: '/api/inventory' }),
  );
  const worktree = inventory.projects[0]?.worktrees.find((item) => item.main);
  if (!worktree)
    throw new Error(
      'The architecture sample needs its disposable main worktree',
    );
  const reviewPath = `/api/worktrees/${worktree.id}/review`;
  const saved = Schema.decodeUnknownSync(readPublishedReviewResponseSchema)(
    await accepted(session, { method: 'GET', path: reviewPath }),
  ).review;
  const baseline = new Map<string, string>();
  const changed = new Map<string, string>();
  const contextPath = 'packages/workspace/src/actor.ts';
  baseline.set(
    contextPath,
    "export type Actor = { id: string; workspaceId: string; role: 'owner' | 'editor' | 'viewer' };\n",
  );
  baseline.set(
    'packages/workspace/src/legacy-write.ts',
    'export const records: string[] = [];\n\nexport function legacyWrite(value: string) {\n  records.push(value);\n  return value;\n}\n',
  );
  for (const scenario of scenarios) {
    const paths = [
      `apps/web/src/${scenario.key}.ts`,
      `packages/client/src/${scenario.key}.ts`,
      `apps/server/src/${scenario.key}.ts`,
      `packages/workspace/src/${scenario.key}.ts`,
      `tests/${scenario.key}.spec.ts`,
    ];
    const [view, client, server, domain, spec] = paths;
    if (!view || !client || !server || !domain || !spec)
      throw new Error('Sample paths are incomplete');
    baseline.set(
      view,
      `import { legacyWrite } from '../../../packages/workspace/src/legacy-write.ts';\n\nexport function submit(value: string) {\n  return legacyWrite(value);\n}\n`,
    );
    baseline.set(
      client,
      `export function request(value: string) {\n  return { value };\n}\n`,
    );
    baseline.set(
      server,
      `export function handle(input: { value: string }) {\n  return input.value;\n}\n`,
    );
    baseline.set(
      domain,
      `export function decide(value: string) {\n  return value;\n}\n`,
    );
    baseline.set(
      spec,
      `import { decide } from '../packages/workspace/src/${scenario.key}.ts';\n\nif (decide('${scenario.input}') !== '${scenario.input}') throw new Error('Baseline decision');\n`,
    );
    changed.set(
      view,
      `import type { Actor } from '../../../packages/workspace/src/actor.ts';\nimport { request } from '../../../packages/client/src/${scenario.key}.ts';\n\nexport function submit(actor: Actor, value: string) {\n  const input = request(actor, value);\n  return { route: '/${scenario.key}', input, pending: true };\n}\n\nexport function display(result: { state: string; version: number }) {\n  return { label: result.state, confirmedVersion: result.version };\n}\n`,
    );
    changed.set(
      client,
      `import type { Actor } from '../../workspace/src/actor.ts';\n\nexport function request(actor: Actor, value: string) {\n  if (value.length > 4096) throw new Error('Request is too large');\n  return { actor, value, expectedVersion: 1 };\n}\n\nexport function accept(result: { state: string; version: number }) {\n  if (result.version < 1) throw new Error('Invalid server version');\n  return result;\n}\n`,
    );
    const ownerImport =
      scenario.owner === 'Session owner'
        ? "import { revoke, restore } from '../../../packages/workspace/src/sessions.ts';\n"
        : scenario.owner === 'Delivery outbox'
          ? "import { enqueue, attempt } from '../../../packages/workspace/src/outbox.ts';\n"
          : '';
    const ownerCall =
      scenario.key === 'revoke-access'
        ? '  revoke(input.value);\n'
        : scenario.key === 'reconnect-device'
          ? "  restore('session-42', Number(input.value.slice(8)));\n"
          : scenario.key === 'schedule-reminder'
            ? '  enqueue(input.value);\n'
            : scenario.key === 'retry-delivery'
              ? '  attempt(input.value);\n'
              : '';
    changed.set(
      server,
      `import type { Actor } from '../../../packages/workspace/src/actor.ts';\nimport { authorize } from '../../../packages/workspace/src/policy.ts';\nimport { decide } from '../../../packages/workspace/src/${scenario.key}.ts';\nimport { append } from '../../../packages/workspace/src/journal.ts';\n${ownerImport}\nexport function handle(input: { actor: Actor; value: string; expectedVersion: number }) {\n  authorize(input.actor);\n  const state = decide(input.value);\n${ownerCall}  return append(input.actor.workspaceId, state, input.expectedVersion);\n}\n`,
    );
    changed.set(
      domain,
      `export function decide(value: string) {\n  ${scenario.rule}\n  return '${scenario.output}';\n}\n\nexport const operation = '${scenario.key}';\nexport const owner = '${scenario.owner}';\n`,
    );
    changed.set(
      spec,
      `import { decide } from '../packages/workspace/src/${scenario.key}.ts';\nimport { handle } from '../apps/server/src/${scenario.key}.ts';\n\nconst actor = { id: 'sample-user', workspaceId: '${scenario.key}', role: 'owner' as const };\nconst result = handle({ actor, value: '${scenario.input}', expectedVersion: 1 });\nif (decide('${scenario.input}') !== '${scenario.output}') throw new Error('Decision result');\nif (result.state !== '${scenario.output}' || result.version !== 2) throw new Error('Persisted outcome');\nlet rejected = false;\ntry { handle({ actor: { ...actor, role: 'viewer' }, value: '${scenario.input}', expectedVersion: 2 }); } catch { rejected = true; }\nif (!rejected) throw new Error('A viewer cannot perform a mutation');\n`,
    );
    changed.set(
      `docs/decisions/${scenario.key}.md`,
      `# ${scenario.title}\n\n${scenario.decision}\n\nThe ${scenario.owner.toLowerCase()} remains the canonical owner.\n`,
    );
  }
  baseline.set(
    'packages/workspace/src/policy.ts',
    "import type { Actor } from './actor.ts';\n\nexport function authorize(actor: Actor) {\n  if (actor.role === 'viewer') throw new Error('Read-only actor');\n}\n",
  );
  changed.set(
    'packages/workspace/src/policy.ts',
    "import type { Actor } from './actor.ts';\n\nexport function authorize(actor: Actor) {\n  if (!actor.workspaceId) throw new Error('A workspace is required');\n  if (actor.role === 'viewer') throw new Error('Read-only actor');\n}\n\nexport function canTransfer(actor: Actor) {\n  return actor.role === 'owner';\n}\n",
  );
  changed.set(
    'packages/workspace/src/journal.ts',
    "type Event = { state: string; version: number };\nconst events = new Map<string, Event[]>();\n\nexport function append(workspace: string, state: string, expectedVersion: number) {\n  const history = events.get(workspace) ?? [];\n  const current = history.at(-1)?.version ?? 1;\n  if (current !== expectedVersion) throw new Error('Stale mutation');\n  const event = { state, version: current + 1 };\n  events.set(workspace, [...history, event]);\n  return event;\n}\n\nexport function snapshot(workspace: string, version: number) {\n  return (events.get(workspace) ?? []).filter((event) => event.version <= version);\n}\n",
  );
  changed.set(
    'packages/workspace/src/outbox.ts',
    "const deliveries = new Map<string, { state: 'pending' | 'sent'; attempts: number }>();\n\nexport function enqueue(id: string) {\n  const existing = deliveries.get(id);\n  if (existing) return existing;\n  const entry = { state: 'pending' as const, attempts: 0 };\n  deliveries.set(id, entry);\n  return entry;\n}\n\nexport function attempt(id: string) {\n  const entry = enqueue(id);\n  if (entry.state === 'sent') return false;\n  entry.attempts += 1;\n  return true;\n}\n",
  );
  changed.set(
    'packages/workspace/src/sessions.ts',
    "const revoked = new Set<string>();\n\nexport function revoke(id: string) {\n  revoked.add(id);\n  return { id, state: 'revoked' };\n}\n\nexport function restore(id: string, accessVersion: number) {\n  if (revoked.has(id)) throw new Error('Session was revoked');\n  if (accessVersion < 3) throw new Error('Refresh access before reconnecting');\n  return { id, accessVersion };\n}\n",
  );
  baseline.set(
    'docs/architecture.md',
    '# Sample workspace\n\nEach page writes its own record.\n',
  );
  changed.set(
    'docs/architecture.md',
    '# Sample workspace\n\nMutations use shared policy and the revision journal.\nDelivery and sessions have their own owners.\n',
  );
  for (const folder of new Set(
    [
      ...baseline.keys(),
      ...changed.keys(),
      'scripts/migrate-workspaces.ts',
    ].map(dirname),
  ))
    await mkdir(join(session.repository, folder), { recursive: true });
  await session.writeFile(
    session.fixture.readme.path,
    session.fixture.readme.committed,
  );
  for (const [path, text] of baseline) await session.writeFile(path, text);
  await session.git('add', '-A');
  await session.git(
    'commit',
    '-m',
    'Establish the synthetic workspace baseline',
  );
  for (const [path, text] of changed) await session.writeFile(path, text);
  await session.remove('packages/workspace/src/legacy-write.ts');
  await session.git('add', 'apps/web', 'packages/client');

  const lanes = ['Entry points', 'Shared client', 'Server', 'Owners'];
  const layers: PublishReviewRequest['layers'][number][] = [];
  const boxes: NonNullable<
    PublishReviewRequest['diagram']
  >['after']['boxes'][number][] = [];
  const arrows: NonNullable<
    PublishReviewRequest['diagram']
  >['after']['arrows'][number][] = [];
  const owners = new Map<string, { id: string; layerId: string }>();
  for (const scenario of scenarios) {
    const id = randomUUID();
    const story = stories[scenario.key];
    const steps: PublishReviewRequest['layers'][number]['steps'][number][] = [
      {
        path: `apps/web/src/${scenario.key}.ts`,
        title: story.view,
        lane: 0,
      },
      {
        path: `packages/client/src/${scenario.key}.ts`,
        title: 'Bound the request',
        lane: 1,
      },
      {
        path: `apps/server/src/${scenario.key}.ts`,
        title: story.server,
        lane: 2,
      },
      {
        path: `packages/workspace/src/${scenario.key}.ts`,
        title: 'Keep the domain decision in its owner',
        lane: 3,
      },
      {
        path: `tests/${scenario.key}.spec.ts`,
        title: 'Prove the outcome and permission boundary',
        lane: 3,
      },
      {
        path: `docs/decisions/${scenario.key}.md`,
        title: 'Record the architectural decision',
        lane: 3,
      },
    ].map((item) => ({
      id: randomUUID(),
      lane: item.lane,
      title: item.title,
      text:
        item.lane === 0
          ? story.viewNote
          : item.lane === 1
            ? 'The shared client caps the payload and carries the expected version. It makes no permission decision.'
            : item.lane === 2
              ? story.serverNote
              : item.path.startsWith('tests/')
                ? `Checks the persisted ${scenario.output} outcome and that a viewer is refused. The sample has not run it.`
                : item.path.startsWith('docs/')
                  ? `Names the ${scenario.owner.toLowerCase()} as the owner the next operation should reuse.`
                  : scenario.decision,
      kind: 'changed' as const,
      pointer: {
        path: item.path,
        startLine: 1,
        endLine: (changed.get(item.path)?.split('\n').length ?? 2) - 1,
      },
    }));
    steps.push({
      id: randomUUID(),
      lane: 3,
      title: 'Reuse the workspace actor',
      text: 'This existing type crosses the boundary; each feature does not invent another identity.',
      kind: 'context',
      pointer: { path: contextPath, startLine: 1, endLine: 1 },
    });
    const layerArrows = steps.slice(1, 4).map((step, index) => ({
      from: steps[index]!.id,
      to: step.id,
      label: index === 0 ? 'prepares' : 'calls',
    }));
    layers.push({
      id,
      title: scenario.title,
      summary: scenario.decision,
      lanes,
      steps,
      arrows: layerArrows,
    });
    const node = randomUUID();
    boxes.push({
      id: node,
      lane: 0,
      label: scenario.title,
      detail: scenario.decision,
      kind: 'component',
      change: 'changed',
      layerId: id,
    });
    const existing = owners.get(scenario.owner);
    const owner = existing ?? { id: randomUUID(), layerId: id };
    if (!existing) {
      owners.set(scenario.owner, owner);
      boxes.push({
        id: owner.id,
        lane: 1,
        label: scenario.owner,
        detail: `Shared by the related behaviors. ${scenario.decision}`,
        kind: 'component',
        change: scenario.owner === 'Workspace policy' ? 'changed' : 'new',
        layerId: id,
        ...(scenario.owner === 'Delivery outbox'
          ? {
              problem:
                'Outbox and journal are updated separately. Transaction ownership needs a decision.',
            }
          : {}),
      });
    }
    arrows.push({ from: node, to: owner.id, label: 'uses' });
  }
  const journal = owners.get('Revision journal');
  const policy = owners.get('Workspace policy');
  for (const box of boxes.filter((item) => item.lane === 0)) {
    if (
      journal &&
      !arrows.some((arrow) => arrow.from === box.id && arrow.to === journal.id)
    )
      arrows.push({ from: box.id, to: journal.id, label: 'writes events' });
    if (
      policy &&
      !arrows.some((arrow) => arrow.from === box.id && arrow.to === policy.id)
    )
      arrows.push({ from: box.id, to: policy.id, label: 'authorizes through' });
  }
  const legacy = randomUUID();
  const before = {
    lanes: ['Behaviors', 'Persistence'],
    boxes: [
      ...boxes
        .filter((box) => box.lane === 0)
        .map((box) => ({ ...box, change: undefined })),
      {
        id: legacy,
        lane: 1,
        label: 'Page-owned writes',
        detail: 'Each page owns an independent write path.',
        kind: 'storage' as const,
      },
    ],
    arrows: boxes
      .filter((box) => box.lane === 0)
      .map((box) => ({ from: box.id, to: legacy, label: 'writes directly' })),
  };
  boxes.push({
    id: legacy,
    lane: 1,
    label: 'Page-owned writes',
    detail:
      'The old write path is removed. Shared owners now decide mutations.',
    kind: 'storage',
    change: 'removed',
  });
  const sharedLayer = randomUUID();
  const sharedSteps = ['policy', 'journal', 'outbox', 'sessions'].map(
    (name) => {
      const path = `packages/workspace/src/${name}.ts`;
      return {
        id: randomUUID(),
        lane: 0,
        title: `Own ${name}`,
        text: {
          policy:
            'Workspace policy owns authorization for every mutation; clients cannot bypass it.',
          journal:
            'The revision journal owns ordered versions and pinned export snapshots.',
          outbox:
            'The delivery outbox owns retry identity; its transaction with the journal remains unresolved.',
          sessions:
            'The session owner rechecks access when a device reconnects or membership changes.',
        }[name]!,
        kind: 'changed' as const,
        pointer: {
          path,
          startLine: 1,
          endLine: (changed.get(path)?.split('\n').length ?? 2) - 1,
        },
      };
    },
  );
  layers.push({
    id: sharedLayer,
    title: 'Establish the shared mutation boundary',
    summary:
      'Keep authorization, revisions, delivery and session lifetime in explicit owners.',
    lanes: ['Shared owners'],
    steps: sharedSteps,
  });
  const afterBoxes = boxes.map((box) =>
    box.lane === 1 && box.change !== 'removed'
      ? { ...box, layerId: sharedLayer }
      : box,
  );
  const body: PublishReviewRequest = {
    expectedRevision: saved?.revision ?? 0,
    summaryHtml:
      '<!doctype html><style>body{font:16px/1.5 system-ui;padding:2rem;max-width:48rem;color:var(--porcelain-foreground);background:var(--porcelain-background)}a{color:inherit}</style><h1>A workspace grows shared owners</h1><p>This wholly synthetic sample contains eight behaviors and a shared ownership change. Explore the map and follow each decision into its code.</p><p>Some work is intentionally unexplained, and one location changes after publication.</p><a href="#layer-9">Shared mutation boundary</a>',
    diagram: {
      before,
      after: {
        lanes: ['Behaviors', 'Shared owners'],
        boxes: afterBoxes,
        arrows,
      },
    },
    layers,
    proof: {
      checks: [
        {
          name: 'Sample application tests',
          result: 'skipped',
          output: 'Illustrative sample; no application test result is claimed.',
        },
      ],
    },
  };
  const result = Schema.decodeUnknownSync(readPublishedReviewResponseSchema)(
    await accepted(session, { method: 'PUT', path: reviewPath, body }),
  );
  for (const item of result.review?.layers.slice(0, 2) ?? [])
    await accepted(session, {
      method: 'PUT',
      path: `/api/worktrees/${worktree.id}/reviewed-layers`,
      body: { layerId: item.id, fingerprint: item.fingerprint, reviewed: true },
    });
  const stalePath = 'packages/workspace/src/revoke-access.ts';
  await session.writeFile(
    stalePath,
    changed.get(stalePath)!.replace('session-revoked', 'access-revoked'),
  );
  await session.writeFile(
    'packages/workspace/src/policy.ts',
    `${changed.get('packages/workspace/src/policy.ts')}\nexport const auditEnabled = true;\n`,
  );
  await session.writeFile(
    'scripts/migrate-workspaces.ts',
    'export const dryRun = true;\nexport const batches = 25;\n',
  );
  await accepted(session, {
    method: 'POST',
    path: `/api/worktrees/${worktree.id}/comments`,
    body: {
      anchor: { kind: 'file', filePath: 'packages/workspace/src/outbox.ts' },
      body: 'Does delivery share the same journal transaction, or can scheduling succeed without a durable outbox entry?',
    },
  });
  const reviewedPaths = new Set(
    result.review?.layers[0]?.steps.flatMap((step) =>
      step.kind === 'changed' ? [step.pointer.path] : [],
    ),
  );
  const current = Schema.decodeUnknownSync(readChangesResponseSchema)(
    await accepted(session, {
      method: 'GET',
      path: `/api/worktrees/${worktree.id}/changes`,
    }),
  );
  const files = current.changes.flatMap((change) =>
    reviewedPaths.has(change.path) && change.fingerprint
      ? [{ path: change.path, fingerprint: change.fingerprint }]
      : [],
  );
  if (files.length > 0)
    await accepted(session, {
      method: 'PUT',
      path: `/api/worktrees/${worktree.id}/reviewed-bulk`,
      body: { files },
    });
  return result;
}
