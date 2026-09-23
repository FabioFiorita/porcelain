import { setTimeout as delay } from 'node:timers/promises';
import {
  apiError,
  list,
  record,
  text,
  type HttpRequest,
  type Session,
} from './feature.ts';

export const sampleChange = '# Sample repository\n\nA change to review.\n';
export const sampleFingerprint =
  '68ae39995d04b18f57dacf53b58c6c21f44a6a9a9cd6f1085d932da25530dcce';
export const worktreeNotFound = apiError(
  404,
  'Not Found',
  'Worktree not found',
);

export function worktreePath(session: Session, suffix = '') {
  return `/api/worktrees/${session.worktreeId}${suffix}`;
}

export function gitPath(session: Session, suffix: string) {
  return `/api/projects/${session.projectId}/worktrees/${session.worktreeId}/git${suffix}`;
}

export async function read(session: Session, request: HttpRequest) {
  const response = await session.send(request);
  if (response.status !== 200)
    throw new Error(
      `${request.method} ${request.path} answered HTTP ${response.status}`,
    );
  return record(response.body);
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
    const response = await session.send({
      method: 'GET',
      path: `/api/git-action-requests/${requestId}`,
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
    branch: 'main',
    inProgress: null,
    mergeHeadOid: null,
  };
}

export async function threeCommits(session: Session) {
  await session.git('commit', '-am', 'Second commit', '-m', 'With a body');
  await session.git('mv', 'README.md', 'GUIDE.md');
  await session.git('commit', '-m', 'Rename');
  const [rename, second, initial] = (await session.git('rev-list', 'HEAD'))
    .trim()
    .split('\n');
  if (!rename || !second || !initial) throw new Error('Expected three commits');
  return { rename, second, initial };
}

export function sampleReview(
  expectedRevision: number,
  layerId: string,
  stepId: string,
  path = 'README.md',
) {
  return {
    expectedRevision,
    summaryHtml: '<html><body><h1>Summary</h1></body></html>',
    layers: [
      {
        id: layerId,
        title: 'Readme',
        summary: 'Adds a line',
        lanes: ['Docs'],
        steps: [
          {
            id: stepId,
            lane: 0,
            title: 'New line',
            text: 'A line is added',
            kind: 'changed',
            pointer: { path, startLine: 3, endLine: 3 },
          },
        ],
      },
    ],
  };
}
