import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Schema } from 'effect';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import {
  readPublishedReviewResponseSchema,
  type PublishReviewRequest,
} from '@porcelain/contracts/reviews';
import {
  COMMENT_BODY_LENGTH,
  DEVICE_LABEL_LENGTH,
  ENVIRONMENT_NAME_LENGTH,
  PROJECT_NAME_LENGTH,
  REVIEW_PROSE_LENGTH,
  REVIEW_STEP_TEXT_LENGTH,
  REVIEW_TITLE_LENGTH,
} from '@porcelain/contracts/shared';
import { commitReviewFixture, lineCount, pairDevice } from './requests.ts';
import type { HttpRequest, Session } from './session.ts';

export const stressVariants = ['long-text', 'many-items'] as const;
export type StressVariant = (typeof stressVariants)[number];

type Layer = PublishReviewRequest['layers'][number];
type Box = NonNullable<
  PublishReviewRequest['diagram']
>['after']['boxes'][number];
type Plan = {
  files: ReadonlyMap<string, string>;
  commit: string;
  verdict: PublishReviewRequest['verdict'];
  summaryHtml: string;
  layers: readonly {
    title: string;
    summary: string;
    lane: string;
    steps: readonly { title: string; text: string; path: string }[];
  }[];
  comments: readonly { path: string; body: string }[];
  devices: readonly string[];
  environmentName?: string;
  projectName?: string;
};

const UNBROKEN =
  'documentHoldEscalationAcknowledgementWithoutAnyBreakOpportunity';
const SENTENCE =
  ' The dispatcher keeps the hold visible until the missing document arrives and the next action is recorded.';

function filled(length: number, lead: string): string {
  let text = `${lead} ${UNBROKEN}`;
  while (text.length < length) text += SENTENCE;
  return text.slice(0, length).trimEnd();
}

function notePath(variant: StressVariant) {
  return `porcelain-stress/${variant}.md`;
}

function appliedMarker(session: Session, variant: StressVariant) {
  return join(session.projectHome, `.porcelain-stress-${variant}`);
}

function longTextPlan(): Plan {
  const longName = `porcelain-stress/long-text/${'an-UNBROKEN-file-name-that-keeps-going-'.repeat(5)}end.ts`;
  const nested = `porcelain-stress/long-text/${'deeply-nested-folder/'.repeat(8)}hold.ts`;
  const files = new Map([
    [
      notePath('long-text'),
      `# Long text\n\n${filled(REVIEW_PROSE_LENGTH, 'A paragraph long enough to wrap many times at phone width.')}\n\nhttps://example.invalid/${UNBROKEN.repeat(4)}\n`,
    ],
    [
      longName,
      `export const ${UNBROKEN} = '${UNBROKEN.repeat(6)}';\n\nexport function describe() {\n  return ${JSON.stringify(filled(600, 'A long source line'))};\n}\n`,
    ],
    [
      nested,
      `export const nestedHold = ${JSON.stringify(filled(300, 'Nested'))};\n`,
    ],
  ]);
  return {
    files,
    commit: filled(REVIEW_TITLE_LENGTH, 'Keep document holds visible'),
    verdict: {
      asked: { text: filled(REVIEW_PROSE_LENGTH, 'Asked:') },
      recommendation: 'hold',
      reasons: [
        filled(REVIEW_PROSE_LENGTH, 'Reason:'),
        filled(400, 'A shorter reason:'),
      ],
      notProven: [
        {
          what: filled(REVIEW_TITLE_LENGTH, 'Not proven:'),
          why: filled(REVIEW_PROSE_LENGTH, 'Because'),
        },
      ],
      removed: [],
    },
    summaryHtml: `<!doctype html><h1>${filled(REVIEW_TITLE_LENGTH, 'Summary')}</h1><p>${filled(REVIEW_PROSE_LENGTH, 'The summary')}</p>`,
    layers: [longName, nested].map((path, index) => ({
      title: filled(REVIEW_TITLE_LENGTH, `Decision ${index + 1} in ${path}`),
      summary: filled(REVIEW_PROSE_LENGTH, 'Summary of the decision:'),
      lane: filled(100, 'Lane'),
      steps: [
        {
          title: filled(REVIEW_TITLE_LENGTH, `Step in ${path}`),
          text: filled(REVIEW_STEP_TEXT_LENGTH, 'Step:'),
          path,
        },
      ],
    })),
    comments: [
      { path: longName, body: filled(COMMENT_BODY_LENGTH / 8, 'Comment:') },
    ],
    devices: [filled(DEVICE_LABEL_LENGTH, 'Phone')],
    environmentName: filled(ENVIRONMENT_NAME_LENGTH, 'Workstation'),
    projectName: filled(PROJECT_NAME_LENGTH, 'Project'),
  };
}

function manyItemsPlan(): Plan {
  const count = (length: number) =>
    Array.from({ length }, (_, index) => String(index + 1).padStart(2, '0'));
  const paths = count(6).flatMap((area) =>
    count(10).map(
      (file) => `porcelain-stress/many-items/area-${area}/file-${file}.ts`,
    ),
  );
  const files = new Map([
    [notePath('many-items'), '# Many items\n'],
    ...paths.map((path, index): [string, string] => [
      path,
      `export const item${index + 1} = ${index + 1};\n`,
    ]),
  ]);
  return {
    files,
    commit: 'Add many items',
    verdict: {
      asked: { text: 'Show many decisions, files, comments and devices' },
      recommendation: 'merge',
      reasons: count(5).map((number) => `Reason ${number}`),
      notProven: count(8).map((number) => ({
        what: `Check ${number}`,
        why: 'Not run in this fixture',
      })),
      removed: [],
    },
    summaryHtml: `<!doctype html><h1>Many items</h1><ul>${count(40)
      .map((number) => `<li>Item ${number}</li>`)
      .join('')}</ul>`,
    layers: count(20).map((number, index) => ({
      title: `Decision ${number}`,
      summary: `Decision ${number} groups three files.`,
      lane: `Lane ${(index % 4) + 1}`,
      steps: paths.slice(index * 3, index * 3 + 3).map((path) => ({
        title: path.split('/').at(-1) ?? path,
        text: `Changes ${path}.`,
        path,
      })),
    })),
    comments: paths
      .slice(0, 30)
      .map((path, index) => ({ path, body: `Comment ${index + 1}` })),
    devices: count(12).map((number) => `Device ${number}`),
  };
}

async function accepted(session: Session, request: HttpRequest) {
  const response = await session.send(request);
  if (response.status !== 200)
    throw new Error(
      `The ${request.method} ${request.path} seed request answered ${response.status}: ${JSON.stringify(response.body)}`,
    );
  return response.body;
}

async function mainWorktree(session: Session) {
  const inventory = Schema.decodeUnknownSync(readInventoryResponseSchema)(
    await accepted(session, { method: 'GET', path: '/api/inventory' }),
  );
  const project = inventory.projects[0];
  const worktree = project?.worktrees.find((item) => item.main);
  if (project === undefined || worktree === undefined)
    throw new Error('The stress sample needs its disposable main worktree');
  return { projectId: project.id, worktreeId: worktree.id };
}

async function publishedReview(session: Session, worktreeId: string) {
  return Schema.decodeUnknownSync(readPublishedReviewResponseSchema)(
    await accepted(session, {
      method: 'GET',
      path: `/api/worktrees/${worktreeId}/review`,
    }),
  ).review;
}

export async function seedStressSample(
  session: Session,
  variant: StressVariant,
) {
  const { projectId, worktreeId } = await mainWorktree(session);
  if (existsSync(appliedMarker(session, variant))) {
    const review = await publishedReview(session, worktreeId);
    return {
      variant,
      applied: false,
      reviewId: review?.reviewId,
      revision: review?.revision,
      layerId: review?.layers[0]?.id,
    };
  }
  const plan = variant === 'long-text' ? longTextPlan() : manyItemsPlan();
  await commitReviewFixture(session);
  for (const [path, text] of plan.files) {
    await mkdir(dirname(join(session.repository, path)), { recursive: true });
    await session.writeFile(path, text);
  }
  await session.git('add', '-A');
  await session.git('commit', '--allow-empty', '-m', plan.commit);
  const layers: Layer[] = plan.layers.map((layer) => ({
    id: randomUUID(),
    title: layer.title,
    summary: layer.summary,
    lanes: [layer.lane],
    steps: layer.steps.map((step) => ({
      id: randomUUID(),
      lane: 0,
      title: step.title,
      text: step.text,
      kind: 'changed',
      pointer: {
        path: step.path,
        startLine: 1,
        endLine: lineCount(plan.files.get(step.path) ?? '\n'),
      },
    })),
  }));
  const boxes: Box[] = layers.map((layer) => ({
    id: randomUUID(),
    label: layer.title,
    detail: layer.summary,
    change: 'new',
    layerId: layer.id,
    decision: true,
  }));
  const body: PublishReviewRequest = {
    base: 'refs/heads/porcelain-fixture-base',
    expectedRevision:
      (await publishedReview(session, worktreeId))?.revision ?? 0,
    verdict: plan.verdict,
    summaryHtml: plan.summaryHtml,
    diagram: {
      after: {
        boxes,
        arrows: boxes.slice(1).map((box, index) => ({
          from: boxes[index]?.id ?? box.id,
          to: box.id,
          label: layers[index]?.title ?? 'uses',
        })),
      },
    },
    layers,
  };
  const published = Schema.decodeUnknownSync(readPublishedReviewResponseSchema)(
    await accepted(session, {
      method: 'PUT',
      path: `/api/worktrees/${worktreeId}/review`,
      body,
    }),
  ).review;
  for (const comment of plan.comments)
    await accepted(session, {
      method: 'POST',
      path: `/api/worktrees/${worktreeId}/comments`,
      body: {
        anchor: { kind: 'file', filePath: comment.path },
        body: comment.body,
      },
    });
  for (const label of plan.devices) await pairDevice(session, label);
  if (plan.environmentName !== undefined)
    await accepted(session, {
      method: 'PUT',
      path: '/api/environment/name',
      body: { name: plan.environmentName },
    });
  if (plan.projectName !== undefined)
    await accepted(session, {
      method: 'PATCH',
      path: `/api/projects/${projectId}`,
      body: { name: plan.projectName },
    });
  await writeFile(appliedMarker(session, variant), `${published?.reviewId}\n`);
  return {
    variant,
    applied: true,
    reviewId: published?.reviewId,
    revision: published?.revision,
    layerId: published?.layers[0]?.id,
  };
}
