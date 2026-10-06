import * as Schema from 'effect/Schema';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import {
  kitHeaders,
  type Recorder,
  type ServerHandle,
} from './isolated-server.ts';
import { read } from './requests.ts';

export const REMOTE_COMPUTER_NAME = 'Remote journey computer';
export const REMOTE_PROJECT_NAME = 'remote-sample';

export async function prepareRemote(server: ServerHandle, recorder: Recorder) {
  const kit = server.session(recorder, { projectId: '', worktreeId: '' });
  await read(kit, {
    method: 'PUT',
    path: '/api/environment/name',
    headers: kitHeaders,
    body: { name: REMOTE_COMPUTER_NAME },
  });
  const project = Schema.decodeUnknownSync(readInventoryResponseSchema)(
    await read(kit, {
      method: 'GET',
      path: '/api/inventory',
      headers: kitHeaders,
    }),
  ).projects[0];
  if (project === undefined)
    throw new Error('The remote computer has no project.');
  await read(kit, {
    method: 'PATCH',
    path: `/api/projects/${encodeURIComponent(project.id)}`,
    headers: kitHeaders,
    body: { name: REMOTE_PROJECT_NAME },
  });
}
