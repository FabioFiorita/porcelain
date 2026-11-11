import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Schema } from 'effect';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import {
  DEVICE_LABEL_LENGTH,
  ENVIRONMENT_NAME_LENGTH,
  PROJECT_NAME_LENGTH,
} from '@porcelain/contracts/shared';
import { pairDevice } from './requests.ts';
import {
  type HttpRequest,
  type Session,
  type StressVariant,
  stressVariants,
} from './session.ts';

type Plan = {
  variant: StressVariant;
  files: ReadonlyMap<string, string>;
  commit: string;
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

function appliedMarker(
  session: Pick<Session, 'projectHome'>,
  variant: StressVariant,
) {
  return join(session.projectHome, `.porcelain-stress-${variant}`);
}

export function appliedStressVariants(
  session: Pick<Session, 'projectHome'>,
): StressVariant[] {
  return stressVariants.filter((variant) =>
    existsSync(appliedMarker(session, variant)),
  );
}

function longTextPlan(): Plan {
  const longName = `porcelain-stress/long-text/${'an-UNBROKEN-file-name-that-keeps-going-'.repeat(5)}end.ts`;
  const nested = `porcelain-stress/long-text/${'deeply-nested-folder/'.repeat(8)}hold.ts`;
  const files = new Map([
    [
      notePath('long-text'),
      `# Long text\n\n${filled(4000, 'A paragraph long enough to wrap many times at phone width.')}\n\nhttps://example.invalid/${UNBROKEN.repeat(4)}\n`,
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
    variant: 'long-text',
    files,
    commit: filled(200, 'Keep document holds visible'),

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
    variant: 'many-items',
    files,
    commit: 'Add many items',

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

export async function seedStressSample(
  session: Session,
  variant: StressVariant,
) {
  const { projectId } = await mainWorktree(session);
  const applied = !existsSync(appliedMarker(session, variant));
  const plan = variant === 'long-text' ? longTextPlan() : manyItemsPlan();
  if (applied) {
    if ((await session.git('status', '--porcelain')).trim()) {
      await session.git('add', '-A');
      await session.git('commit', '-m', 'Commit fixture changes');
    }
    for (const [path, text] of plan.files) {
      await mkdir(dirname(join(session.repository, path)), {
        recursive: true,
      });
      await session.writeFile(path, text);
    }
    await session.git('add', '-A');
    await session.git('commit', '--allow-empty', '-m', plan.commit);
  }
  if (applied) await applyOnce(session, plan, projectId);
  return { variant, applied };
}

async function applyOnce(session: Session, plan: Plan, projectId: string) {
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
  await writeFile(appliedMarker(session, plan.variant), `${plan.variant}\n`);
}
