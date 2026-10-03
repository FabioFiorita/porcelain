import { agentActs } from '../../../../apps/server/spec/kit/agent.ts';
import {
  kitHeaders,
  Recorder,
  ServerHandle,
} from '../../../../apps/server/spec/kit/isolated-server.ts';
import {
  pairingGrant,
  toolText,
} from '../../../../apps/server/spec/kit/requests.ts';
import type {
  AgentAction,
  ProofCheckStep,
  Session,
} from '../../../../apps/server/spec/kit/session.ts';
import { serverReaders } from '../../../../apps/server/spec/kit/typed-readers.ts';
import { Usage } from '../../verify-core/cli.ts';

export const serverOptions = {
  context: { type: 'boolean', default: false },
  'summary-html': { type: 'string' },
  check: { type: 'string', multiple: true },
  output: { type: 'string', multiple: true },
  screenshot: { type: 'string' },
  remote: { type: 'boolean', default: false },
  trusted: { type: 'boolean', default: false },
} as const;

export const serverUsage = `  agent publish-review "<title>" [--context] [--summary-html <html>]
                          the agent publishes the sample review: one layer, one step on README.md line 3
  agent publish-proof "<title>" --check "<name>=pass|fail|skipped" [--output "<name>=<text>"] --screenshot "<title>"
  agent comment <path> "<body>"
  agent reply <threadId|latest> "<body>"
  server reviewed-files [<branch ref>] | reviewed-layers | comment-threads | project | devices | pending-links | receipt <requestId>
                          print the server's state as JSON
      agent and server take --remote to act on the second computer
  pair                    pair the browser through a fresh one-time link
  remote start            start a second disposable computer for the remote-computer features
  remote pairing-link [--trusted]
                          print a one-time link that adds the second computer
`;

type ServerValues = {
  context?: boolean | undefined;
  'summary-html'?: string | undefined;
  check?: string[] | undefined;
  output?: string[] | undefined;
  screenshot?: string | undefined;
};

async function attach(manifest: string) {
  const handle = await ServerHandle.attach(manifest);
  const recorder = new Recorder();
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

function pairs(values: readonly string[] | undefined, flag: string) {
  return (values ?? []).map((value): [string, string] => {
    const at = value.indexOf('=');
    if (at < 1)
      throw new Usage(`--${flag} takes "<name>=<value>", not ${value}.`);
    return [value.slice(0, at), value.slice(at + 1)];
  });
}

function checksOf(values: ServerValues): ProofCheckStep[] {
  const outputs = new Map(pairs(values.output, 'output'));
  return pairs(values.check, 'check').map(([name, result]) => {
    if (result !== 'pass' && result !== 'fail' && result !== 'skipped')
      throw new Usage(
        `--check "${name}=${result}" needs pass, fail or skipped.`,
      );
    const output = outputs.get(name);
    return output === undefined ? { name, result } : { name, result, output };
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
  values: ServerValues,
): Promise<AgentAction | undefined> {
  const [kind, first, second] = rest;
  if (kind === 'publish-review')
    return {
      kind,
      title: required(first, 'the review layer title'),
      step: values.context === true ? 'context' : 'changed',
      summaryHtml: values['summary-html'],
    };
  if (kind === 'publish-proof')
    return {
      kind,
      title: required(first, 'the review layer title'),
      checks: checksOf(values),
      screenshot: required(
        values.screenshot,
        'the screenshot title with --screenshot',
      ),
    };
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
): Promise<string> {
  const { handle, session } = await attach(manifest);
  const action = await actionOf(handle, session, rest, values);
  if (action === undefined)
    throw new Usage(
      'Use agent publish-review, agent publish-proof, agent comment or agent reply.',
    );
  const answer = toolText(await agentActs(session, action));
  return `the agent's ${action.kind} reached the server, which answered:\n${answer}\n`;
}

export async function serverRead(
  manifest: string,
  rest: readonly string[],
): Promise<string> {
  const { handle, session } = await attach(manifest);
  const readers = readersOf(handle, session);
  const [what, argument] = rest;
  const state =
    what === 'reviewed-files'
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
      'Use server reviewed-files [<branch ref>], reviewed-layers, comment-threads, project, devices, pending-links or receipt <requestId>.',
    );
  return `${JSON.stringify(state, null, 2)}\n`;
}

export async function issuedLink(
  manifest: string,
  label: string,
  trusted: boolean,
) {
  const { session } = await attach(manifest);
  return pairingGrant(session, label, trusted);
}
