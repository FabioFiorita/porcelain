import {
  kitHeaders,
  Recorder,
  ServerHandle,
} from '@porcelain/server/kit/isolated-server';
import { pairingGrant } from '@porcelain/server/kit/requests';
import type { Session } from '@porcelain/server/kit/session';
import { serverReaders } from '@porcelain/server/kit/typed-readers';

import { Usage } from './cli.ts';

export const serverOptions = {
  remote: { type: 'boolean', default: false },
  trusted: { type: 'boolean', default: false },
} as const;

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

export async function serverRead(
  manifest: string,
  rest: readonly string[],
  recorder?: Recorder,
): Promise<string> {
  const { handle, session } = await attach(manifest, recorder);
  const readers = readersOf(handle, session);
  const [what, argument] = rest;
  const state =
    what === 'reviewed-files'
      ? await readers.reviewedFiles(argument)
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
      'Use server reviewed-files [<branch ref>], project, devices, pending-links or receipt <requestId>.',
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
