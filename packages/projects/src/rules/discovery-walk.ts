import type {
  DiscoveryFolder,
  DiscoveryPolicy,
  DiscoveryWalk,
  ProjectFolderRead,
} from '../models/project-folder.ts';

export function startDiscoveryWalk(roots: readonly string[]): DiscoveryWalk {
  return {
    queue: roots.map((path) => ({ path, depth: 0 })),
    next: 0,
    visited: new Set(),
    candidates: [],
    limited: false,
  };
}

export function nextDiscoveryFolder(
  walk: DiscoveryWalk,
  policy: DiscoveryPolicy,
): DiscoveryFolder | undefined {
  return walk.next < policy.maxFolders ? walk.queue[walk.next] : undefined;
}

export function discoveryLimited(
  walk: DiscoveryWalk,
  policy: DiscoveryPolicy,
): boolean {
  return (
    walk.limited ||
    (walk.next >= policy.maxFolders && walk.next < walk.queue.length)
  );
}

export function visitDiscoveryFolder(
  walk: DiscoveryWalk,
  folder: DiscoveryFolder,
  read: ProjectFolderRead,
  policy: DiscoveryPolicy,
): DiscoveryWalk {
  const next = walk.next + 1;
  if (read.kind !== 'read') return { ...walk, next, limited: true };
  const { contents } = read;
  if (walk.visited.has(contents.path)) return { ...walk, next };
  const visited = new Set([...walk.visited, contents.path]);
  const limited = walk.limited || contents.truncated;
  if (contents.gitMarker)
    return {
      ...walk,
      next,
      visited,
      limited,
      candidates: [...walk.candidates, contents.path],
    };
  const children = contents.directories.filter(
    (entry) =>
      !entry.symbolicLink &&
      !(policy.skipHidden && entry.name.startsWith('.')) &&
      !policy.skippedNames.includes(entry.name),
  );
  if (folder.depth >= policy.maxDepth)
    return { ...walk, next, visited, limited: limited || children.length > 0 };
  const room = Math.max(policy.maxFolders - walk.queue.length, 0);
  return {
    ...walk,
    next,
    visited,
    limited: limited || children.length > room,
    queue: [
      ...walk.queue,
      ...children
        .slice(0, room)
        .map((child) => ({ path: child.path, depth: folder.depth + 1 })),
    ],
  };
}
