import { agentActs } from '@porcelain/server/kit/agent';
import {
  kitHeaders,
  Recorder,
  ServerHandle,
} from '@porcelain/server/kit/isolated-server';
import { pairingGrant } from '@porcelain/server/kit/requests';
import type { AgentAction, Session } from '@porcelain/server/kit/session';
import { serverReaders } from '@porcelain/server/kit/typed-readers';

import { Usage } from './cli.ts';

export const serverOptions = {
  context: { type: 'boolean', default: false },
  'summary-html': { type: 'string' },
  check: { type: 'string', multiple: true },
  output: { type: 'string', multiple: true },
  screenshot: { type: 'string' },
  remote: { type: 'boolean', default: false },
  trusted: { type: 'boolean', default: false },
} as const;

type ServerValues = {
  context?: boolean | undefined;
  'summary-html'?: string | undefined;
  check?: string[] | undefined;
  output?: string[] | undefined;
  screenshot?: string | undefined;
};

async function attach(manifest: string, recorder = new Recorder()) {
  const handle = await ServerHandle.attach(manifest);
  recorder.phase = 'follow-up';
  recorder.secret(handle.credential);
  recorder.secret(handle.desktopCredential);
  return {
    handle,
    session: handle.session(recorder, { projectId: '', worktreeId: '' }),
  };
}

function readersOf(handle: ServerHandle, session: Session) {
  return serverReaders({
    read: async ({ target, path }) => {
      const response = await session.send({
        method: 'GET',
        path,
        target,
        headers: kitHeaders,
      });
      return { status: response.status, body: response.body };
    },
    hits: () => handle.hits(),
  });
}

function required(value: string | undefined, what: string): string {
  if (value === undefined || value === '') throw new Usage(`Name ${what}.`);
  return value;
}

async function latestThread(handle: ServerHandle, session: Session) {
  const threads = await readersOf(handle, session).commentThreads();
  const newest = (thread: (typeof threads)[number]) =>
    Math.max(
      0,
      ...thread.messages.map((message) =>
        message.createdAt === undefined ? 0 : Date.parse(message.createdAt),
      ),
    );
  const latest = threads.reduce<(typeof threads)[number] | undefined>(
    (found, thread) =>
      found === undefined || newest(thread) >= newest(found) ? thread : found,
    undefined,
  );
  if (latest === undefined)
    throw new Usage('There is no comment thread to reply to yet.');
  return latest.id;
}

async function actionOf(
  handle: ServerHandle,
  session: Session,
  rest: readonly string[],
  _values: ServerValues,
): Promise<AgentAction | undefined> {
  const [kind, first, second] = rest;
  if (kind === 'comment')
    return {
      kind,
      path: required(first, 'the file to comment on'),
      body: required(second, 'the comment'),
    };
  if (kind === 'reply') {
    const thread = required(first, 'the thread id or latest');
    return {
      kind,
      threadId:
        thread === 'latest' ? await latestThread(handle, session) : thread,
      body: required(second, 'the reply'),
    };
  }
  return undefined;
}

export async function agentCommand(
  manifest: string,
  rest: readonly string[],
  values: ServerValues,
  recorder?: Recorder,
): Promise<string> {
  const { handle, session } = await attach(manifest, recorder);
  const action = await actionOf(handle, session, rest, values);
  if (action === undefined)
    throw new Usage('Use agent comment or agent reply.');
  const result = await agentActs(session, action);
  return `the agent's ${action.kind} reached the server, which answered:\n${JSON.stringify(result)}\n`;
}

export async function serverRead(
  manifest: string,
  rest: readonly string[],
  recorder?: Recorder,
): Promise<string> {
  const { handle, session } = await attach(manifest, recorder);
  const readers = readersOf(handle, session);
  const [what, argument] = rest;
  const state =
    what === 'published-review'
      ? await readers.publishedReview()
      : what === 'reviewed-files'
        ? await readers.reviewedFiles(argument)
        : what === 'reviewed-layers'
          ? await readers.reviewedLayers()
          : what === 'comment-threads'
            ? await readers.commentThreads()
            : what === 'project'
              ? await readers.project()
              : what === 'devices'
                ? await readers.devices()
                : what === 'pending-links'
                  ? await readers.pendingLinks()
                  : what === 'receipt'
                    ? await readers.receipt(
                        required(argument, 'the Git action request id'),
                      )
                    : undefined;
  if (state === undefined)
    throw new Usage(
      'Use server published-review | reviewed-files [<branch ref>], reviewed-layers, comment-threads, project, devices, pending-links or receipt <requestId>.',
    );
  return `${JSON.stringify(state, null, 2)}\n`;
}

export async function issuedLink(
  manifest: string,
  label: string,
  trusted: boolean,
  recorder?: Recorder,
) {
  const { session } = await attach(manifest, recorder);
  return pairingGrant(session, label, trusted);
}
