import type { RegisteredProject } from '../models/project.ts';

export function sameProject(
  left: RegisteredProject,
  right: RegisteredProject,
): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.namedByOwner === right.namedByOwner &&
    left.commonDirectory === right.commonDirectory &&
    left.repositoryIdentity === right.repositoryIdentity &&
    left.available === right.available &&
    left.position === right.position
  );
}
