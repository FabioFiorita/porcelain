import { describe, expect, it } from 'vitest';
import type { RegisteredProject } from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { ListOtherProjectsService } from './list-other-projects-service.ts';

function project(id: string, position: number): RegisteredProject {
  return {
    id,
    name: id,
    namedByOwner: false,
    commonDirectory: `/srv/${id}/.git`,
    repositoryIdentity: `identity-${id}`,
    available: true,
    position,
  };
}

const service = new ListOtherProjectsService(
  new InMemoryInventoryStore([
    project('api', 1),
    project('web', 2),
    project('docs', 3),
  ]),
);

describe('ListOtherProjectsService', () => {
  it('answers every registered project except the one for the repository', () => {
    expect(
      service
        .execute({ repositoryIdentity: 'identity-web' })
        .projects.map((entry) => entry.id),
    ).toEqual(['api', 'docs']);
  });

  it('answers every registered project for a repository not yet registered', () => {
    expect(
      service
        .execute({ repositoryIdentity: 'identity-new' })
        .projects.map((entry) => entry.id),
    ).toEqual(['api', 'web', 'docs']);
  });
});
