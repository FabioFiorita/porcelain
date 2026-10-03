import { describe, expect, it } from 'vitest';
import type { RegisteredProject } from '@porcelain/projects/models';
import { sameProject } from './same-project.ts';

const project: RegisteredProject = {
  id: 'project-1',
  name: 'api',
  namedByOwner: false,
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'identity-1',
  available: true,
  position: 1,
};

describe('sameProject', () => {
  it('holds for two records with every field equal', () => {
    expect(sameProject(project, { ...project })).toBe(true);
  });

  it.each([
    { field: 'id', change: { id: 'project-2' } },
    { field: 'name', change: { name: 'billing' } },
    { field: 'namedByOwner', change: { namedByOwner: true } },
    { field: 'commonDirectory', change: { commonDirectory: '/srv/b/.git' } },
    { field: 'repositoryIdentity', change: { repositoryIdentity: 'other' } },
    { field: 'available', change: { available: false } },
    { field: 'position', change: { position: 2 } },
  ])('fails when $field differs', ({ change }) => {
    expect(sameProject(project, { ...project, ...change })).toBe(false);
  });
});
