import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  listDirectoryEndpoint,
  listWorktreePathsEndpoint,
  readTextFileEndpoint,
} from '@porcelain/contracts/files';
import { readInventoryResponseSchema } from '@porcelain/contracts/projects';
import { TEXT_BYTES } from '@porcelain/contracts/shared';
import type { Session } from '@porcelain/server/kit/session';
import type { Environment } from './environment.ts';

const fileReadRoutes = new Set(
  [listDirectoryEndpoint, listWorktreePathsEndpoint, readTextFileEndpoint].map(
    (endpoint) => `${endpoint.prefix}${endpoint.path}`,
  ),
);

export class FilesFixture {
  readonly environment: Environment;
  readonly session: Session;
  readonly projectName: string;
  readonly worktreeLabel: string;

  private constructor(
    environment: Environment,
    session: Session,
    projectName: string,
    worktreeLabel: string,
  ) {
    this.environment = environment;
    this.session = session;
    this.projectName = projectName;
    this.worktreeLabel = worktreeLabel;
  }

  static async create(environment: Environment, text: string) {
    const ids = await environment.server.sampleIds();
    const session = environment.server.session(environment.recorder, ids);
    await mkdir(join(session.repository, 'files-demo/empty-directory'), {
      recursive: true,
    });
    await session.writeFile('files-demo/source.ts', text);
    await session.writeFile('files-demo/binary.dat', new Uint8Array([0, 1, 2]));
    await session.writeFile(
      'files-demo/too-large.txt',
      'x'.repeat(TEXT_BYTES + 1),
    );
    await session.writeFile('files-demo/empty.txt', '');
    const inventory = readInventoryResponseSchema.parse(
      (await session.read({ method: 'GET', path: '/api/inventory' })).body,
    );
    const project = inventory.projects.find(
      (candidate) => candidate.id === ids.projectId,
    );
    const worktree = project?.worktrees.find(
      (candidate) => candidate.id === ids.worktreeId,
    );
    if (!project || !worktree)
      throw new Error('The Files fixture has no selected worktree.');
    return new FilesFixture(
      environment,
      session,
      project.name,
      worktree.branch?.replace(/^refs\/heads\//, '') ?? 'Detached HEAD',
    );
  }

  async result() {
    const hits = (await this.environment.server.hits()).filter(
      (hit) => !hit.kit,
    );
    return {
      text: await this.session.readFile('files-demo/source.ts'),
      editRequests: hits.filter(
        (hit) =>
          hit.method === 'POST' &&
          hit.route === '/api/worktrees/:worktreeId/files',
      ).length,
      reads: [
        ...new Set(
          hits
            .filter(
              (hit) =>
                hit.method === 'GET' &&
                hit.status === 200 &&
                hit.route !== undefined &&
                fileReadRoutes.has(hit.route),
            )
            .map((hit) => hit.route),
        ),
      ].sort((left, right) => (left ?? '').localeCompare(right ?? '')),
      missingRead: hits.some(
        (hit) =>
          hit.route === '/api/worktrees/:worktreeId/text' && hit.status === 404,
      ),
    };
  }
}
