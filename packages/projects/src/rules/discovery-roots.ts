import type { RegisteredProject } from '../models/project.ts';
import { parentFolder } from './parent-folder.ts';

export function discoveryRoots(
  home: string,
  projects: readonly Pick<RegisteredProject, 'commonDirectory'>[],
): string[] {
  const roots = new Set([home]);
  for (const project of projects) {
    const parent = parentFolder(parentFolder(project.commonDirectory));
    if (parent !== '/') roots.add(parent);
  }
  return [...roots];
}
