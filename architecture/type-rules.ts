import { join } from 'node:path';
import {
  API,
  SignatureKind,
  TypeFlags,
  type Checker,
  type Project,
  type Type,
} from 'typescript/unstable/sync';
import {
  SyntaxKind,
  type MethodSignatureDeclaration,
  type Node,
  type SourceFile,
} from 'typescript/unstable/ast';
import {
  isArrowFunction,
  isCallExpression,
  isClassDeclaration,
  isConstructorDeclaration,
  isExportDeclaration,
  isFunctionExpression,
  isIdentifier,
  isInterfaceDeclaration,
  isMethodDeclaration,
  isMethodSignatureDeclaration,
  isNamedExports,
  isObjectLiteralExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isStringLiteral,
  isTypeAliasDeclaration,
  isVariableDeclaration,
} from 'typescript/unstable/ast/is';
import { domainPackages, type ArchRule } from './policy.ts';

export type TypeFinding = { rule: ArchRule; from: string; to: string };

const absence = TypeFlags.Undefined | TypeFlags.Null | TypeFlags.Void;
const writingPort = /(?:Store|Writer|Runner)$/;
const fakeFile = /\/(?:packages\/[^/]+|apps\/server)\/spec\/fakes\/.+\.ts$/;
const recordingFake = /^Recording[A-Z]/;
const readingMethod =
  /^(?:read|list|find|count|by|seen|latest|last)(?:[A-Z]|$)/;
const serviceFile = /\/packages\/[^/]+\/src\/services\/.+-service\.ts$/;
const useCaseFile = /\/apps\/server\/src\/use-cases\/.+\.ts$/;
const modelFile = /\/packages\/[^/]+\/src\/models\/.+\.ts$/;
const domainShapeFile = new RegExp(
  `/packages/(?:${domainPackages.join('|')})/src/(?:models|ports)/(?!index\\.ts$).+\\.ts$`,
);

const repositoryTables = ['reviews', 'repository'];
const tableLanes: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  GitActionReceiptStore: { any: ['receipts', 'repository'] },
  ReviewStore: { any: repositoryTables },
  ReviewedFileStore: { any: repositoryTables },
  ReviewedLayerStore: { any: repositoryTables },
  CommentStore: { any: repositoryTables },
  CommentSeenStore: { any: repositoryTables },
  FilePreferenceStore: { any: ['project'] },
  InventoryStore: { any: ['inventory'] },
  WorktreePresenceStore: {
    save: ['inventory'],
    remove: ['repository', 'project'],
    any: ['inventory', 'repository', 'project'],
  },
  WorktreeCatalogStore: { save: ['inventory'] },
};
const readsBeforeLane: Readonly<Record<string, string>> = {
  CheckWorktreeService:
    'resolves the worktree from the catalog before its lane can be chosen; a stale entry is refreshed by the refresh use case under its own inventory lane',
  CheckRefreshedWorktreeService:
    'answers the worktree the refresh just recorded, before its lane can be chosen',
  CheckProjectService: 'resolves the project before the lane is keyed on it',
  FindProjectService: 'resolves the project before the lane is keyed on it',
  ReadReviewSummaryService:
    'reads a summary link by its token, before any worktree is known',
};

type Lane =
  | 'read'
  | 'write'
  | 'background'
  | 'finish'
  | 'unqueued'
  | 'none'
  | 'unknown';

function children(node: Node): Node[] {
  const result: Node[] = [];
  node.forEachChild((child) => {
    result.push(child);
    return undefined;
  });
  return result;
}

function descendants(node: Node): Node[] {
  return children(node).flatMap((child) => [child, ...descendants(child)]);
}

function isSpecFile(file: SourceFile): boolean {
  return file.fileName.endsWith('.spec.ts');
}

function where(root: string, node: Node): string {
  const file = node.getSourceFile();
  const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
  return `${file.fileName.slice(root.length + 1)}:${line + 1}`;
}

function unionWithAbsence(type: Type): boolean {
  return type.isUnionType()
    ? (type.getTypes() ?? []).some((member) => (member.flags & absence) !== 0)
    : false;
}

function includesAbsence(type: Type): boolean {
  return (type.flags & absence) !== 0 || unionWithAbsence(type);
}

function awaitedType(type: Type, checker: Checker): Type {
  if (!type.isTypeReference()) return type;
  if (type.getSymbol()?.name !== 'Promise') return type;
  return checker.getTypeArguments(type)[0] ?? type;
}

function executeMethods(file: SourceFile) {
  return file.statements
    .filter(isClassDeclaration)
    .flatMap((declaration) => declaration.members.filter(isMethodDeclaration))
    .filter(
      (method) => isIdentifier(method.name) && method.name.text === 'execute',
    );
}

function undefinedResults(
  root: string,
  project: Project,
  file: SourceFile,
): TypeFinding[] {
  const { checker } = project;
  return executeMethods(file).flatMap((method) => {
    const signature = checker.getSignatureFromDeclaration(method);
    const returned = signature && checker.getReturnTypeOfSignature(signature);
    if (!returned) return [];
    const result = awaitedType(returned, checker);
    return unionWithAbsence(result)
      ? [
          {
            rule: 'no-undefined-union-result',
            from: where(root, method),
            to: `${checker.typeToString(result)}: return a named outcome or throw the named error`,
          },
        ]
      : [];
  });
}

function absentResultAliases(
  root: string,
  project: Project,
  file: SourceFile,
): TypeFinding[] {
  const { checker } = project;
  return file.statements
    .filter(isTypeAliasDeclaration)
    .filter((alias) => /Result$/.test(alias.name.text))
    .flatMap((alias) => {
      const type = checker.getTypeAtLocation(alias.name);
      return type && includesAbsence(type)
        ? [
            {
              rule: 'models-file-shape',
              from: where(root, alias),
              to: `${alias.name.text} resolves to ${checker.typeToString(type)}; a Result names an outcome, never undefined, void or null`,
            },
          ]
        : [];
    });
}

function exportedNames(file: SourceFile | undefined): Set<string> {
  const names = new Set<string>();
  for (const statement of file?.statements ?? [])
    if (
      isExportDeclaration(statement) &&
      statement.exportClause &&
      isNamedExports(statement.exportClause)
    )
      for (const element of statement.exportClause.elements)
        names.add(element.name.text);
  return names;
}

function kernelDuplicates(
  root: string,
  file: SourceFile,
  kernelNames: ReadonlySet<string>,
): TypeFinding[] {
  return file.statements.flatMap((statement) =>
    (isTypeAliasDeclaration(statement) || isInterfaceDeclaration(statement)) &&
    kernelNames.has(statement.name.text)
      ? [
          {
            rule: 'models-file-shape',
            from: where(root, statement),
            to: `${statement.name.text} is a kernel type; import it from @porcelain/kernel instead of declaring a second one`,
          },
        ]
      : [],
  );
}

function thisMember(node: Node): string | undefined {
  return isPropertyAccessExpression(node) &&
    node.expression.kind === SyntaxKind.ThisKeyword &&
    isIdentifier(node.name)
    ? node.name.text
    : undefined;
}

function writingPortMethod(
  project: Project,
  call: Node,
): MethodSignatureDeclaration | undefined {
  if (!isCallExpression(call) || !isPropertyAccessExpression(call.expression))
    return undefined;
  const declaration = project.checker
    .getSymbolAtLocation(call.expression.name)
    ?.declarations[0]?.resolve(project);
  if (!declaration || !isMethodSignatureDeclaration(declaration))
    return undefined;
  const port = declaration.parent;
  return isInterfaceDeclaration(port) && writingPort.test(port.name.text)
    ? declaration
    : undefined;
}

function methodName(method: MethodSignatureDeclaration): string {
  return isIdentifier(method.name) ? method.name.text : '';
}

function writes(project: Project, declaration: Node): boolean {
  return descendants(declaration).some((node) => {
    const method = writingPortMethod(project, node);
    return method !== undefined && !readingMethod.test(methodName(method));
  });
}

function answersNothing(project: Project, port: Type): boolean {
  const { checker } = project;
  return checker.getPropertiesOfType(port).every((member) => {
    const type = checker.getTypeOfSymbol(member);
    const signatures = type
      ? checker.getSignaturesOfType(type, SignatureKind.Call)
      : [];
    return (
      signatures.length > 0 &&
      signatures.every((signature) => {
        const returned = checker.getReturnTypeOfSignature(signature);
        return (
          returned !== undefined &&
          (awaitedType(returned, checker).flags & TypeFlags.Void) !== 0
        );
      })
    );
  });
}

function recordingFindings(
  root: string,
  project: Project,
  file: SourceFile,
): TypeFinding[] {
  const { checker } = project;
  return file.statements
    .filter(isClassDeclaration)
    .filter(
      (declaration) =>
        declaration.name !== undefined &&
        recordingFake.test(declaration.name.text),
    )
    .flatMap((declaration) => {
      const ports = (declaration.heritageClauses ?? []).flatMap((clause) =>
        clause.types.map((type) => checker.getTypeAtLocation(type)),
      );
      const answered =
        ports.length === 0 ||
        ports.some((port) => !port || !answersNothing(project, port));
      return answered
        ? [
            {
              rule: 'recording-fake-for-write-only-port',
              from: where(root, declaration),
              to: `${declaration.name?.text ?? ''}: a Recording fake implements only ports whose methods answer nothing back; a port with a read-back gets an InMemory fake read through that port`,
            },
          ]
        : [];
    });
}

function laneOf(call: Node, callback: Node): Lane | undefined {
  if (!isCallExpression(call) || !isPropertyAccessExpression(call.expression))
    return undefined;
  const method = call.expression.name;
  const owner = call.expression.expression;
  if (!isIdentifier(method) || thisMember(owner) !== 'lanes') return undefined;
  const [first, second, third] = call.arguments;
  if (method.text === 'background')
    return second === callback ? 'background' : undefined;
  if (method.text === 'unqueued')
    return first === callback ? 'unqueued' : undefined;
  if (method.text === 'finish')
    return first === callback ? 'finish' : undefined;
  if (method.text === 'runConsistent')
    return third === callback ? 'read' : undefined;
  if (method.text !== 'run' || third !== callback) return undefined;
  if (second && isStringLiteral(second))
    return second.text === 'read' || second.text === 'write'
      ? second.text
      : 'unknown';
  return 'unknown';
}

function laneKeyOf(project: Project, node: Node | undefined): string {
  if (!node) return 'unknown';
  if (
    isCallExpression(node) &&
    isPropertyAccessExpression(node.expression) &&
    thisMember(node.expression.expression) === 'laneKeys' &&
    isIdentifier(node.expression.name)
  )
    return node.expression.name.text;
  if (isIdentifier(node)) {
    const declaration = project.checker
      .getSymbolAtLocation(node)
      ?.declarations[0]?.resolve(project);
    return declaration && isVariableDeclaration(declaration)
      ? laneKeyOf(project, declaration.initializer)
      : 'unknown';
  }
  return 'unknown';
}

function laneKeyArgument(call: Node): Node | undefined {
  if (!isCallExpression(call) || !isPropertyAccessExpression(call.expression))
    return undefined;
  const [first, second] = call.arguments;
  if (!isIdentifier(call.expression.name)) return undefined;
  if (call.expression.name.text !== 'finish') return first;
  if (!second || !isObjectLiteralExpression(second)) return undefined;
  const lane = second.properties.find(
    (property) =>
      isPropertyAssignment(property) &&
      isIdentifier(property.name) &&
      property.name.text === 'lane',
  );
  return lane && isPropertyAssignment(lane) ? lane.initializer : undefined;
}

type LaneSite = { lane: Lane; key: string };

function isFunctionNode(node: Node): boolean {
  return isArrowFunction(node) || isFunctionExpression(node);
}

function privateCallSites(method: Node, name: string): Node[] {
  const owner = method.parent;
  return descendants(owner).filter(
    (node) =>
      isPropertyAccessExpression(node) &&
      thisMember(node) === name &&
      !(isMethodDeclaration(node.parent) && node.parent.name === node.name),
  );
}

function laneSitesAround(
  project: Project,
  node: Node,
  seen: Set<Node>,
): LaneSite[] {
  const none: LaneSite[] = [{ lane: 'none', key: 'none' }];
  for (let current = node; ; current = current.parent) {
    const parent = current.parent;
    if (isFunctionNode(current) && isCallExpression(parent)) {
      const lane = laneOf(parent, current);
      if (lane)
        return [
          {
            lane,
            key:
              lane === 'unqueued'
                ? 'none'
                : laneKeyOf(project, laneKeyArgument(parent)),
          },
        ];
    }
    if (isMethodDeclaration(current)) {
      const name = isIdentifier(current.name) ? current.name.text : '';
      if (name === 'execute' || seen.has(current)) return none;
      seen.add(current);
      const sites = privateCallSites(current, name);
      return sites.length === 0
        ? none
        : sites.flatMap((site) => laneSitesAround(project, site, seen));
    }
    if (
      isConstructorDeclaration(current) ||
      current.kind === SyntaxKind.SourceFile
    )
      return none;
  }
}

function tableCalls(
  project: Project,
  declaration: Node,
): { store: string; method: string; allowed: readonly string[] }[] {
  return descendants(declaration).flatMap((node) => {
    if (!isCallExpression(node) || !isPropertyAccessExpression(node.expression))
      return [];
    const method = project.checker
      .getSymbolAtLocation(node.expression.name)
      ?.declarations[0]?.resolve(project);
    if (!method || !isMethodSignatureDeclaration(method)) return [];
    const port = method.parent;
    if (!isInterfaceDeclaration(port)) return [];
    const lanes = tableLanes[port.name.text];
    const name = methodName(method);
    const allowed = lanes?.[name] ?? lanes?.['any'];
    return allowed ? [{ store: port.name.text, method: name, allowed }] : [];
  });
}

function tableFindings(
  root: string,
  project: Project,
  call: Node,
  service: Node,
  field: string,
): TypeFinding[] {
  const serviceName =
    isClassDeclaration(service) && service.name ? service.name.text : '';
  const sites = laneSitesAround(project, call, new Set());
  return tableCalls(project, service).flatMap(({ store, method, allowed }) =>
    sites
      .filter(
        (site) =>
          !allowed.includes(site.key) &&
          !(site.key === 'none' && serviceName in readsBeforeLane),
      )
      .map((site) => ({
        rule: 'lane-per-table',
        from: where(root, call),
        to: `${field} calls ${store}.${method}; that table belongs to the ${allowed.join(' or ')} lane, so run it inside lanes.run(this.laneKeys.${allowed[0] ?? ''}(...)), not ${site.key === 'none' ? 'outside any lane' : `the ${site.key} lane`}`,
      })),
  );
}

function laneFindings(
  root: string,
  project: Project,
  file: SourceFile,
  writerCache: Map<Node, boolean>,
): TypeFinding[] {
  const { checker } = project;
  const result: TypeFinding[] = [];
  for (const node of descendants(file)) {
    if (!isCallExpression(node) || !isPropertyAccessExpression(node.expression))
      continue;
    const target = node.expression.expression;
    if (!isIdentifier(node.expression.name)) continue;
    if (node.expression.name.text !== 'execute') continue;
    const field = thisMember(target) ?? target.getText();
    const declaration = checker
      .getTypeAtLocation(target)
      ?.getSymbol()
      ?.declarations[0]?.resolve(project);
    if (!declaration || !isClassDeclaration(declaration)) continue;
    if (!serviceFile.test(declaration.getSourceFile().fileName)) continue;
    result.push(...tableFindings(root, project, node, declaration, field));
    const writer = writerCache.get(declaration) ?? writes(project, declaration);
    writerCache.set(declaration, writer);
    if (!writer) continue;
    const lanes = laneSitesAround(project, node, new Set()).map(
      (site) => site.lane,
    );
    const wrong = lanes.filter(
      (lane) => lane !== 'write' && lane !== 'background' && lane !== 'finish',
    );
    if (wrong.length > 0)
      result.push({
        rule: 'lane-mode-matches-service',
        from: where(root, node),
        to: `${field} writes; call it inside a 'write' lane, lanes.background or the shutdown context lanes.finish, never in ${[...new Set(wrong)].join(' or ')} lane`,
      });
  }
  return result;
}

export function typeRuleFindings(root: string): TypeFinding[] {
  const api = new API({ cwd: root });
  try {
    const configs = [
      ...[...domainPackages, 'kernel'].map((name) =>
        join(root, 'packages', name, 'tsconfig.json'),
      ),
      join(root, 'apps/server/tsconfig.json'),
    ];
    const snapshot = api.updateSnapshot({ openProjects: configs });
    const kernel = snapshot.getProject(configs[domainPackages.length] ?? '');
    const kernelNames = new Set([
      ...exportedNames(
        kernel?.program.getSourceFile(
          join(root, 'packages/kernel/src/models/index.ts'),
        ),
      ),
      ...exportedNames(
        kernel?.program.getSourceFile(
          join(root, 'packages/kernel/src/ports/index.ts'),
        ),
      ),
    ]);
    const findings: TypeFinding[] = [];
    const checked = new Set<string>();
    const writerCache = new Map<Node, boolean>();
    for (const config of configs) {
      const project = snapshot.getProject(config);
      if (!project) throw new Error(`TypeScript did not open ${config}`);
      for (const name of project.program.getSourceFileNames()) {
        if (!name.startsWith(root) || name.includes('/node_modules/')) continue;
        const inServer = config.endsWith('apps/server/tsconfig.json');
        if (!inServer && checked.has(name)) continue;
        const file = project.program.getSourceFile(name);
        if (!file || isSpecFile(file)) continue;
        if (fakeFile.test(name) && !checked.has(name)) {
          checked.add(name);
          findings.push(...recordingFindings(root, project, file));
          continue;
        }
        if (inServer) {
          if (useCaseFile.test(name))
            findings.push(...laneFindings(root, project, file, writerCache));
          continue;
        }
        checked.add(name);
        if (serviceFile.test(name))
          findings.push(...undefinedResults(root, project, file));
        if (modelFile.test(name))
          findings.push(...absentResultAliases(root, project, file));
        if (domainShapeFile.test(name))
          findings.push(...kernelDuplicates(root, file, kernelNames));
      }
    }
    return findings;
  } finally {
    api.close();
  }
}
