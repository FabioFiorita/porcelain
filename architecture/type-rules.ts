import { join } from 'node:path';
import {
  API,
  SignatureKind,
  SymbolFlags,
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
  isArrayLiteralExpression,
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
  /^(?:read|list|find|count|by|seen|latest|last|running|finished)(?:[A-Z]|$)/;
const serviceFile = /\/packages\/[^/]+\/src\/services\/.+-service\.ts$/;
const useCaseFile = /\/apps\/server\/src\/use-cases\/.+\.ts$/;
const workflowFile = /\/apps\/server\/src\/runtime\/.+-workflow\.ts$/;
const useCaseOrPortFile =
  /\/apps\/server\/src\/(?:use-cases\/.+|ports\/.+-use-case-port)\.ts$/;
const modelFile = /\/packages\/[^/]+\/src\/models\/.+\.ts$/;
const domainShapeFile = new RegExp(
  `/packages/(?:${domainPackages.join('|')})/src/(?:models|ports)/(?!index\\.ts$).+\\.ts$`,
);
const storePortFile =
  /\/(?:packages\/[^/]+|apps\/server)\/src\/ports\/[^/]+\.ts$/;
const startupOnlyErrors = new Map([
  [
    'packages/storage/src/errors/invalid-data-directory-error.ts',
    'InvalidDataDirectoryError',
  ],
  [
    'packages/storage/src/errors/unsupported-database-version-error.ts',
    'UnsupportedDatabaseVersionError',
  ],
]);

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
  DeviceStore: { any: ['access'] },
  PairingGrantStore: { any: ['access'] },
  EnvironmentNameStore: { any: ['access'] },
  RemoteAccessStore: { any: ['remoteAccess'] },
  DeviceSightingStore: { any: ['access'] },
  PairingAttemptStore: { any: ['access'] },
  LiveTicketStore: { any: ['access'] },
  RouteStateStore: { any: ['remoteAccess'] },
  TunnelConnectionStore: { any: ['remoteAccess'] },
  DeviceConnectionStore: { any: ['access'] },
};
const readsBeforeLane: Readonly<Record<string, string>> = {
  ReadQueuedGitActionService:
    'resolves the exact persisted accepted request and its worktree before its repository lane can be chosen; acceptedAt must match before it returns',
  CheckWorktreeService:
    'resolves the worktree from the catalog before its lane can be chosen; a stale entry is refreshed by the refresh use case under its own inventory lane',
  CheckRefreshedWorktreeService:
    'answers the worktree the refresh just recorded, before its lane can be chosen',
  CheckProjectService: 'resolves the project before the lane is keyed on it',
  FindProjectService: 'resolves the project before the lane is keyed on it',
  ReadReviewSummaryService:
    'reads a summary link by its token, before any worktree is known',
  CheckRequestOriginService:
    'reads the remote-access snapshot for every request; queuing it in the remote-access lane would hold all requests while routes open',
  IdentifyRequestClientService:
    'reads the remote-access snapshot for every request; queuing it in the remote-access lane would hold all requests while routes open',
};

const checkedByCaller: Readonly<Record<string, string>> = {
  ReadReviewEvidenceUseCase:
    'reads the evidence inside the lane of the use case that checked the worktree, never on its own',
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
  if (!['Promise', 'Effect'].includes(type.getSymbol()?.name ?? ''))
    return type;
  return checker.getTypeArguments(type)[0] ?? type;
}

function executeMethods(file: SourceFile) {
  return file.statements.filter(isClassDeclaration).flatMap((declaration) =>
    descendants(declaration).filter((node) => {
      if (isMethodDeclaration(node))
        return isIdentifier(node.name) && node.name.text === 'execute';
      return (
        isFunctionExpression(node) &&
        isCallExpression(node.parent) &&
        isPropertyAssignment(node.parent.parent) &&
        node.parent.parent.name.getText() === 'execute'
      );
    }),
  );
}

function ownerDeclaration(project: Project, value: Node): Node | undefined {
  let declaration = project.checker
    .getTypeAtLocation(value)
    ?.getSymbol()
    ?.declarations[0]?.resolve(project);
  while (declaration) {
    if (isClassDeclaration(declaration) || isInterfaceDeclaration(declaration))
      return declaration;
    if (declaration.kind === SyntaxKind.SourceFile) return undefined;
    declaration = declaration.parent;
  }
  return undefined;
}

function ownerNamed(project: Project, value: Node, name: string): boolean {
  const owner = ownerDeclaration(project, value);
  return (
    owner !== undefined &&
    (isClassDeclaration(owner) || isInterfaceDeclaration(owner)) &&
    owner.name?.text === name
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

function worktreeAccess(project: Project, owner: Node): boolean {
  const declaration = ownerDeclaration(project, owner);
  return (
    declaration !== undefined &&
    declaration
      .getSourceFile()
      .fileName.endsWith('/apps/server/src/runtime/worktree-access.ts')
  );
}

function laneOf(
  project: Project,
  call: Node,
  callback: Node,
): Lane | undefined {
  if (!isCallExpression(call) || !isPropertyAccessExpression(call.expression))
    return undefined;
  const method = call.expression.name;
  const owner = call.expression.expression;
  if (!isIdentifier(method)) return undefined;
  const [first, second, third] = call.arguments;
  if (worktreeAccess(project, owner)) {
    if (
      method.text === 'transaction' &&
      (second === callback || third === callback)
    )
      return 'write';
    if (method.text === 'read' && second === callback) return 'read';
    if (method.text === 'write' && second === callback) return 'write';
    if (method.text === 'background' && second === callback)
      return 'background';
    if (method.text === 'reviews' && third === callback)
      return second &&
        isStringLiteral(second) &&
        (second.text === 'read' || second.text === 'write')
        ? second.text
        : 'unknown';
    return undefined;
  }
  if (!ownerNamed(project, owner, 'Lanes') && thisMember(owner) !== 'lanes')
    return undefined;
  if (method.text === 'background')
    return second === callback ? 'background' : undefined;
  if (method.text === 'unqueued')
    return first === callback ? 'unqueued' : undefined;
  if (method.text === 'finish')
    return second === callback ? 'finish' : undefined;
  if (method.text === 'commit')
    return second === callback ? 'write' : undefined;
  if (method.text === 'transaction')
    return second === callback || third === callback ? 'write' : undefined;
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
    (ownerNamed(project, node.expression.expression, 'LaneKeys') ||
      thisMember(node.expression.expression) === 'laneKeys') &&
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
  const [first] = call.arguments;
  if (!isIdentifier(call.expression.name)) return undefined;
  return first;
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
      const lane = laneOf(project, parent, current);
      if (lane)
        return [
          {
            lane,
            key:
              isPropertyAccessExpression(parent.expression) &&
              worktreeAccess(project, parent.expression.expression)
                ? 'repository'
                : lane === 'unqueued'
                  ? 'none'
                  : laneKeyOf(project, laneKeyArgument(parent)),
          },
        ];
      if (
        isPropertyAssignment(parent.parent) &&
        parent.parent.name.getText() === 'execute'
      )
        return none;
      if (
        !isCallExpression(parent.expression) ||
        !isPropertyAccessExpression(parent.expression.expression) ||
        parent.expression.expression.name.getText() !== 'fn'
      )
        continue;
      let binding: Node = parent;
      while (
        binding.parent.kind !== SyntaxKind.SourceFile &&
        !isClassDeclaration(binding.parent)
      ) {
        if (isVariableDeclaration(binding)) break;
        binding = binding.parent;
      }
      if (
        isVariableDeclaration(binding) &&
        isIdentifier(binding.name) &&
        !seen.has(binding)
      ) {
        seen.add(binding);
        const symbol = project.checker.getSymbolAtLocation(binding.name);
        let owner: Node = binding;
        while (
          !isClassDeclaration(owner) &&
          owner.kind !== SyntaxKind.SourceFile
        )
          owner = owner.parent;
        const sites = descendants(owner).filter(
          (candidate) =>
            isCallExpression(candidate) &&
            isIdentifier(candidate.expression) &&
            project.checker.getSymbolAtLocation(candidate.expression) ===
              symbol,
        );
        return sites.length
          ? sites.flatMap((site) => laneSitesAround(project, site, seen))
          : none;
      }
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
  return [declaration, ...descendants(declaration)].flatMap((node) => {
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

function storeLaneFindings(root: string, file: SourceFile): TypeFinding[] {
  return file.statements.flatMap((node) => {
    if (
      !(isInterfaceDeclaration(node) || isTypeAliasDeclaration(node)) ||
      !node.name.text.endsWith('Store')
    )
      return [];
    if (Object.hasOwn(tableLanes, node.name.text)) return [];
    return [
      {
        rule: 'lane-per-table',
        from: where(root, node),
        to: `${node.name.text} has no tableLanes entry; name the lane that owns its table so its calls cannot race writes`,
      },
    ];
  });
}

function statusPolicyFindings(root: string, project: Project): TypeFinding[] {
  const policy = project.program.getSourceFile(
    join(root, 'apps/server/src/http/status-policy.ts'),
  );
  if (!policy)
    throw new Error(
      'The HTTP status policy must be loaded to check domain errors.',
    );
  const declarations = descendants(policy).filter(isVariableDeclaration);
  const rules = declarations.find(
    (node) => isIdentifier(node.name) && node.name.text === 'rules',
  );
  if (
    !rules ||
    !rules.initializer ||
    !isArrayLiteralExpression(rules.initializer)
  )
    throw new Error(
      'The HTTP status rules must be an explicit array so every domain error mapping can be checked.',
    );
  const { checker } = project;
  const error = checker.resolveName('Error', SymbolFlags.Type, policy);
  if (!error)
    throw new Error('The HTTP status check must resolve the Error type.');
  const errorType = checker.getDeclaredTypeOfSymbol(error);
  const mapped = new Set<string>();
  for (const node of descendants(rules.initializer)) {
    if (!isPropertyAssignment(node) || !isIdentifier(node.name)) continue;
    if (
      node.name.text !== 'errors' ||
      !isArrayLiteralExpression(node.initializer)
    )
      continue;
    for (const error of node.initializer.elements) {
      const symbol = checker.getSymbolAtLocation(error);
      if (!symbol) continue;
      const original =
        symbol.flags & SymbolFlags.Alias
          ? checker.getAliasedSymbol(symbol)
          : symbol;
      for (const declaration of original.declarations)
        mapped.add(`${declaration.path}:${declaration.index}`);
    }
  }
  const entries = [
    ...[...domainPackages, 'kernel'].map(
      (name) => `packages/${name}/src/errors/index.ts`,
    ),
    'packages/storage/src/index.ts',
  ];
  const findings: TypeFinding[] = [];
  for (const entry of entries) {
    const file = project.program.getSourceFile(join(root, entry));
    if (!file)
      throw new Error(
        `${entry} must be loaded to check exported domain errors.`,
      );
    const module = checker.getSymbolAtLocation(file);
    if (!module) continue;
    for (const exported of checker.getExportsOfModule(module)) {
      const original =
        exported.flags & SymbolFlags.Alias
          ? checker.getAliasedSymbol(exported)
          : exported;
      for (const reference of original.declarations) {
        const declaration = reference.resolve(project);
        if (
          !declaration ||
          !isClassDeclaration(declaration) ||
          !declaration.name
        )
          continue;
        const name = declaration.name.text;
        const type = checker.getTypeAtLocation(declaration);
        if (!type || !checker.isTypeAssignableTo(type, errorType)) continue;
        const path = declaration.getSourceFile().fileName;
        const startupOnly =
          startupOnlyErrors.get(path.slice(root.length + 1)) === name;
        if (startupOnly || mapped.has(`${reference.path}:${reference.index}`))
          continue;
        findings.push({
          rule: 'status-policy-complete',
          from: where(root, declaration),
          to: `${name} is exported but has no errors entry in apps/server/src/http/status-policy.ts; map its HTTP outcome so a new domain failure cannot silently become a 500`,
        });
      }
    }
  }
  return findings;
}

function laneFindings(
  root: string,
  project: Project,
  file: SourceFile,
  writerCache: Map<Node, boolean>,
): TypeFinding[] {
  const result: TypeFinding[] = [];
  for (const node of descendants(file)) {
    if (!isCallExpression(node) || !isPropertyAccessExpression(node.expression))
      continue;
    const target = node.expression.expression;
    if (!isIdentifier(node.expression.name)) continue;
    const direct = workflowFile.test(file.fileName)
      ? writingPortMethod(project, node)
      : undefined;
    const field = thisMember(target) ?? target.getText();
    let writer: boolean;
    if (direct && !readingMethod.test(methodName(direct))) {
      result.push(...tableFindings(root, project, node, node, field));
      writer = true;
    } else {
      if (node.expression.name.text !== 'execute') continue;
      const declaration = ownerDeclaration(project, target);
      if (!declaration || !isClassDeclaration(declaration)) continue;
      if (!serviceFile.test(declaration.getSourceFile().fileName)) continue;
      result.push(...tableFindings(root, project, node, declaration, field));
      writer = writerCache.get(declaration) ?? writes(project, declaration);
      writerCache.set(declaration, writer);
    }
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

function resolvesWorktree(project: Project, declaration: Node): boolean {
  return descendants(declaration).some((node) => {
    if (!isCallExpression(node) || !isPropertyAccessExpression(node.expression))
      return false;
    const { name, expression } = node.expression;
    if (!isIdentifier(name)) return false;
    if (
      ['read', 'write', 'reviews', 'transaction', 'background'].includes(
        name.text,
      ) &&
      worktreeAccess(project, expression)
    )
      return true;
    if (name.text !== 'execute') return false;
    if (
      thisMember(expression) === 'checkWorktree' ||
      ownerNamed(project, expression, 'CheckWorktreeService') ||
      ownerNamed(project, expression, 'CheckRefreshedWorktreeService')
    )
      return true;
    const target = ownerDeclaration(project, expression);
    const targetName =
      target && (isClassDeclaration(target) || isInterfaceDeclaration(target))
        ? (target.name?.text ?? '')
        : '';
    return (
      target !== undefined &&
      useCaseOrPortFile.test(target.getSourceFile().fileName) &&
      !(targetName.replace(/Port$/, '') in checkedByCaller)
    );
  });
}

function worktreeCheckFindings(
  root: string,
  project: Project,
  file: SourceFile,
): TypeFinding[] {
  const { checker } = project;
  return file.statements.filter(isClassDeclaration).flatMap((declaration) => {
    const name = declaration.name?.text ?? '';
    if (name in checkedByCaller) return [];
    const execute = executeMethods(file).find((method) =>
      descendants(declaration).includes(method),
    );
    const signature = execute && checker.getSignatureFromDeclaration(execute);
    const input = signature && checker.getParameterType(signature, 0);
    const scoped =
      input !== undefined &&
      checker
        .getPropertiesOfType(input)
        .some((property) => property.name === 'worktreeId');
    if (!execute || !scoped || resolvesWorktree(project, declaration))
      return [];
    return [
      {
        rule: 'worktree-use-case-checks',
        from: where(root, execute),
        to: `${name} takes a worktreeId; resolve it with this.checkWorktree.execute before using it, or hand it to a use case that does`,
      },
    ];
  });
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
      if (config.endsWith('apps/server/tsconfig.json'))
        findings.push(...statusPolicyFindings(root, project));
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
        if (storePortFile.test(name) && !checked.has(name))
          findings.push(...storeLaneFindings(root, file));
        if (inServer) {
          if (workflowFile.test(name))
            findings.push(...laneFindings(root, project, file, writerCache));
          if (useCaseFile.test(name))
            findings.push(
              ...laneFindings(root, project, file, writerCache),
              ...worktreeCheckFindings(root, project, file),
            );
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
