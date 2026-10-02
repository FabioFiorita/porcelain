import { setTimeout as delay } from 'node:timers/promises';
import { read, receiptPath, worktreePath } from './requests.ts';
import {
  list,
  record,
  text,
  type HttpRequest,
  type Session,
} from './session.ts';

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

export async function tunnelOn(session: Session, hostname: string) {
  await read(session, {
    method: 'PATCH',
    path: '/api/remote-access',
    body: { cloudflare: true, cloudflareHostname: hostname },
  });
  await eventually(
    session,
    { method: 'GET', path: '/api/remote-access' },
    (body) =>
      record(record(record(body.routes).cloudflare).status).kind === 'on',
  );
}
