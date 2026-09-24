import { setTimeout as delay } from 'node:timers/promises';
import {
  apiError,
  list,
  record,
  text,
  type HttpRequest,
  type Session,
} from './feature.ts';

export const worktreeNotFound = apiError(
  404,
  'Not Found',
  'Worktree not found',
);

export function worktreePath(session: Session, suffix = '') {
  return `/api/worktrees/${session.worktreeId}${suffix}`;
}

export const gitRoute = '/api/projects/:projectId/worktrees/:worktreeId/git';
export const receiptRoute = '/api/git-action-requests/:requestId';

function fill(template: string, values: Record<string, string>) {
  return template.replace(
    /:([A-Za-z]+)/g,
    (match, name: string) => values[name] ?? match,
  );
}

export function gitPath(
  session: Session,
  suffix: string,
  ids: { projectId?: string; worktreeId?: string } = {},
) {
  return `${fill(gitRoute, {
    projectId: ids.projectId ?? session.projectId,
    worktreeId: ids.worktreeId ?? session.worktreeId,
  })}${suffix}`;
}

export function receiptPath(session: Session, requestId: string) {
  return fill(receiptRoute, {
    projectId: session.projectId,
    worktreeId: session.worktreeId,
    requestId,
  });
}

export async function read(
  session: Session,
  request: HttpRequest,
  status = 200,
) {
  return record((await session.read(request, status)).body);
}

export const inventory = (session: Session) =>
  read(session, { method: 'GET', path: '/api/inventory' });

export type Changes = {
  statusToken: string;
  headOid: string | null;
  changes: { path: string; fingerprint: string | null }[];
};

export async function changes(session: Session): Promise<Changes> {
  const body = await read(session, {
    method: 'GET',
    path: worktreePath(session, '/changes'),
  });
  return {
    statusToken: text(body.statusToken),
    headOid: body.headOid === null ? null : text(body.headOid),
    changes: list(body.changes).map((entry) => {
      const change = record(entry);
      return {
        path: text(change.path),
        fingerprint:
          change.fingerprint === null ? null : text(change.fingerprint),
      };
    }),
  };
}

export async function fingerprintOf(session: Session, path: string) {
  const entry = (await changes(session)).changes.find(
    (change) => change.path === path,
  );
  if (!entry?.fingerprint) throw new Error(`${path} is not a readable change`);
  return entry.fingerprint;
}

export async function blobOf(session: Session, revision: string) {
  return (await session.git('rev-parse', revision)).trim();
}

export async function workingBlobOf(session: Session, path: string) {
  return (await session.git('hash-object', '--', path)).trim();
}

export async function head(session: Session) {
  return (await session.git('rev-parse', 'HEAD')).trim();
}

export async function issuePairing(session: Session, label = 'Verification') {
  const issued = await read(session, {
    method: 'POST',
    path: '/pairings',
    target: 'owner',
    body: { labels: [label], addresses: [session.address] },
  });
  return text(record(list(issued.grants)[0]).code);
}

export async function pairDevice(session: Session, label = 'Second device') {
  const code = await issuePairing(session, label);
  const paired = await read(session, {
    method: 'POST',
    path: '/api/pair',
    auth: 'none',
    body: { code, platform: 'Verification' },
  });
  return {
    credential: text(paired.credential),
    deviceId: text(record(paired.device).id),
  };
}

export async function settledReceipt(session: Session, requestId: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await session.read({
      method: 'GET',
      path: receiptPath(session, requestId),
    });
    const receipt = record(response.body);
    if (receipt.state !== 'running')
      return { status: response.status, receipt };
    await delay(100);
  }
  throw new Error(`Git action ${requestId} did not settle`);
}

export async function expectation(session: Session) {
  return {
    headOid: (await changes(session)).headOid,
    branch: session.fixture.branch,
    inProgress: null,
    mergeHeadOid: null,
  };
}

export async function receiptOf(session: Session, requestId: string) {
  return read(session, {
    method: 'GET',
    path: receiptPath(session, requestId),
  });
}

export async function threeCommits(session: Session) {
  await session.git('commit', '-am', 'Second commit', '-m', 'With a body');
  await session.git('mv', session.fixture.readme.path, 'GUIDE.md');
  await session.git('commit', '-m', 'Rename');
  const [rename, second, initial] = (await session.git('rev-list', 'HEAD'))
    .trim()
    .split('\n');
  if (!rename || !second || !initial) throw new Error('Expected three commits');
  return { rename, second, initial };
}

export const sampleSummaryHtml = '<html><body><h1>Summary</h1></body></html>';

export function lineCount(value: string) {
  return value.split('\n').length - 1;
}

export function sampleReview(
  session: Session,
  expectedRevision: number,
  layerId: string,
  stepId: string,
  options: { path?: string; title?: string } = {},
) {
  const line = lineCount(session.fixture.readme.changed);
  return {
    expectedRevision,
    summaryHtml: sampleSummaryHtml,
    layers: [
      {
        id: layerId,
        title: options.title ?? 'Readme',
        summary: 'Adds a line',
        lanes: ['Docs'],
        steps: [
          {
            id: stepId,
            lane: 0,
            title: 'New line',
            text: 'A line is added',
            kind: 'changed',
            pointer: {
              path: options.path ?? session.fixture.readme.path,
              startLine: line,
              endLine: line,
            },
          },
        ],
      },
    ],
  };
}

export async function watching(session: Session) {
  const connection = await session.live();
  await connection.next((notice) => notice.type === 'ready');
  connection.send({
    type: 'subscribe',
    projects: [session.projectId],
    worktrees: [
      {
        projectId: session.projectId,
        worktreeId: session.worktreeId,
        paths: [session.fixture.readme.path],
      },
    ],
  });
  await delay(300);
  return connection;
}

export async function eventually(
  session: Session,
  request: HttpRequest,
  accept: (body: Record<string, unknown>) => boolean,
) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const body = await read(session, request);
    if (accept(body)) return body;
    await delay(100);
  }
  throw new Error(`${request.method} ${request.path} never reached the state`);
}

export const deviceCookieAttributes =
  'Path=/api; HttpOnly; SameSite=Strict; Max-Age=7776000';

export function deviceCookie(header: string | undefined) {
  const match = /^([^=;]+)=[^;]+; (.+)$/.exec(header ?? '');
  return match ? { name: match[1], attributes: match[2] } : { header };
}
