import type { RegisteredProject } from '@porcelain/projects/models';
import { describe, expect, it } from 'vitest';
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
});
