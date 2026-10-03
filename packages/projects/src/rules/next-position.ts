import type { RegisteredProject } from '../models/project.ts';

export function nextPosition(
  projects: readonly Pick<RegisteredProject, 'position'>[],
): number {
  return Math.max(0, ...projects.map((project) => project.position)) + 1;
}
