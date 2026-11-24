import { relative } from 'node:path';
import type { Node } from 'typescript/ast';
import { API, type Project } from 'typescript/sync';

export function descendants(node: Node): Node[] {
  const result: Node[] = [];
  function visit(parent: Node) {
    parent.forEachChild((child) => {
      result.push(child);
      visit(child);
      return undefined;
    });
  }
  visit(node);
  return result;
}

export function sourceLocation(root: string, node: Node): string {
  const file = node.getSourceFile();
  const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
  return `${relative(root, file.fileName)}:${line + 1}`;
}

export function readTypeScriptProjects<T>(
  root: string,
  configs: readonly string[],
  read: (project: Project, config: string) => readonly T[],
): T[] {
  const api = new API({ cwd: root });
  try {
    const snapshot = api.createSnapshot({ openProjects: configs });
    return configs.flatMap((config) => {
      const project = snapshot.getConfiguredProject(config);
      if (!project) throw new Error(`TypeScript did not open ${config}`);
      return read(project, config);
    });
  } finally {
    api.close();
  }
}
