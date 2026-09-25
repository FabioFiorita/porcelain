import { parseSync, Visitor } from 'oxc-parser';

export type WebFinding = {
  rule: string;
  file: string;
  line: number;
  message: string;
};

const legacyFolders = new Set([
  'api',
  'domain',
  'hooks',
  'lib',
  'query',
  'views',
]);
const sourceRoot = 'apps/web/src/';
const browserSpecRoot = 'apps/web/spec/browser/';
const featurePath = /^features\/([^/]+)\//;
const allowedTopLevel = new Set([
  'app',
  'assets',
  'components',
  'features',
  'routes',
  'shared',
]);
const shadcnUi = new Set([
  'accordion',
  'alert',
  'alert-dialog',
  'aspect-ratio',
  'attachment',
  'avatar',
  'badge',
  'breadcrumb',
  'bubble',
  'button',
  'button-group',
  'calendar',
  'card',
  'carousel',
  'chart',
  'checkbox',
  'collapsible',
  'combobox',
  'command',
  'context-menu',
  'dialog',
  'direction',
  'drawer',
  'dropdown-menu',
  'empty',
  'field',
  'form',
  'hover-card',
  'input',
  'input-group',
  'input-otp',
  'item',
  'kbd',
  'label',
  'marker',
  'menubar',
  'message',
  'message-scroller',
  'native-select',
  'navigation-menu',
  'pagination',
  'popover',
  'progress',
  'questionnaire',
  'radio-group',
  'resizable',
  'scroll-area',
  'select',
  'separator',
  'sheet',
  'sidebar',
  'skeleton',
  'slider',
  'sonner',
  'spinner',
  'switch',
  'table',
  'tabs',
  'textarea',
  'toast',
  'toggle',
  'toggle-group',
  'tooltip',
]);
const shadcnNames = new Set(
  [...shadcnUi].map((name) =>
    name
      .split('-')
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(''),
  ),
);
const nativePrimitives = new Set([
  'button',
  'dialog',
  'input',
  'label',
  'progress',
  'select',
  'textarea',
]);

function finding(
  rule: string,
  file: string,
  line: number,
  message: string,
): WebFinding {
  return { rule, file, line, message };
}

function localTarget(file: string, specifier: string): string | undefined {
  if (specifier.startsWith('@/')) return specifier.slice(2);
  if (!specifier.startsWith('.')) return undefined;
  const folder = file.slice(sourceRoot.length).split('/').slice(0, -1);
  for (const segment of specifier.split('/')) {
    if (segment === '.' || segment === '') continue;
    if (segment === '..') folder.pop();
    else folder.push(segment);
  }
  return folder.join('/');
}

function browserSpecFindings(file: string, source: string): WebFinding[] {
  const findings: WebFinding[] = [];
  if (!file.endsWith('.browser.ts'))
    findings.push(
      finding(
        'web-browser-spec-name',
        file,
        1,
        'Browser behavior cases use the .browser.ts suffix.',
      ),
    );
  const ast = parseSync(file, source).program;
  const lineOf = (start: number) => source.slice(0, start).split('\n').length;
  new Visitor({
    ImportDeclaration(node) {
      if (
        node.source.value === 'vitest' &&
        node.specifiers.some(
          (specifier) =>
            specifier.type === 'ImportSpecifier' &&
            (specifier.imported.type === 'Identifier'
              ? specifier.imported.name === 'vi'
              : specifier.imported.value === 'vi'),
        )
      )
        findings.push(
          finding(
            'web-browser-no-mocks',
            file,
            lineOf(node.start),
            'Browser behavior uses the real server, not vi mocks.',
          ),
        );
    },
    CallExpression(node) {
      if (
        node.callee.type !== 'MemberExpression' ||
        node.callee.object.type !== 'Identifier' ||
        node.callee.property.type !== 'Identifier'
      )
        return;
      const owner = node.callee.object.name;
      const method = node.callee.property.name;
      if (
        ['test', 'it', 'describe'].includes(owner) &&
        ['skip', 'only', 'todo'].includes(method)
      )
        findings.push(
          finding(
            'web-browser-no-skips',
            file,
            lineOf(node.start),
            'Every browser behavior case runs every time.',
          ),
        );
    },
  }).visit(ast);
  return findings;
}

export function webPolicyFindings(file: string, source: string): WebFinding[] {
  if (file.startsWith(browserSpecRoot))
    return browserSpecFindings(file, source);
  if (!file.startsWith(sourceRoot)) return [];
  const relative = file.slice(sourceRoot.length);
  const parts = relative.split('/');
  const findings: WebFinding[] = [];
  const top = parts[0] ?? '';
  const uiFile = top === 'components' && parts[1] === 'ui';
  const stem = parts.at(-1)?.replace(/\.[^.]+$/, '') ?? '';
  if (
    uiFile &&
    /\.tsx?$/.test(file) &&
    (parts.length !== 3 || !shadcnUi.has(stem))
  )
    findings.push(
      finding(
        'web-shadcn-ui-owner',
        file,
        1,
        'components/ui contains shadcn registry primitives only. Search the shadcn registry before adding a component; feature composition belongs in feature views.',
      ),
    );
  if (!uiFile && file.endsWith('.tsx') && shadcnUi.has(stem))
    findings.push(
      finding(
        'web-shadcn-primitive-owner',
        file,
        1,
        `Use the shadcn ${stem} component from components/ui; add it through the shadcn CLI if it is missing.`,
      ),
    );
  const view =
    top === 'routes' ||
    (top === 'app' && parts[1] === 'views') ||
    (top === 'features' && parts[2] === 'views');
  if (legacyFolders.has(top))
    findings.push(
      finding(
        'web-legacy-folder',
        file,
        1,
        `${top}/ belongs in a feature or shared owner; keep this file until the refactor moves it.`,
      ),
    );
  if (parts.length > 1 && !allowedTopLevel.has(top) && !legacyFolders.has(top))
    findings.push(
      finding(
        'web-unowned-folder',
        file,
        1,
        `${top}/ has no web architecture owner.`,
      ),
    );
  if (top === 'components' && parts[1] !== 'ui')
    findings.push(
      finding(
        'web-component-owner',
        file,
        1,
        'Feature components belong to features/<feature>/views; reusable primitives belong to components/ui.',
      ),
    );
  if (/(?:^|[/.])(?:mocks?|fixtures?|fakes?)(?:[./-]|$)/i.test(relative))
    findings.push(
      finding(
        'web-no-runtime-fixture',
        file,
        1,
        'Runtime web code uses the real isolated server; fixtures belong in browser specs.',
      ),
    );
  if (!/\.[cm]?[jt]sx?$/.test(file)) return findings;
  const ast = parseSync(file, source).program;
  const lineOf = (start: number) => source.slice(0, start).split('\n').length;
  const checkImport = (start: number, specifier: string) => {
    const line = lineOf(start);
    if (
      specifier === '@porcelain/client' ||
      specifier.startsWith('@porcelain/client/')
    )
      findings.push(
        finding(
          'web-no-client-package',
          file,
          line,
          'Use the server contracts and the shared HTTP transport.',
        ),
      );
    if (specifier.startsWith('@porcelain/contracts/') && view)
      findings.push(
        finding(
          'web-view-contracts',
          file,
          line,
          'Routes and views receive feature data; contract parsing belongs to queries, commands or models.',
        ),
      );
    if (
      view &&
      (specifier === '@tanstack/react-query' ||
        specifier.startsWith('@tanstack/react-query/') ||
        specifier === '@tanstack/query-core' ||
        specifier.startsWith('@tanstack/query-core/'))
    )
      findings.push(
        finding(
          'web-view-query-owner',
          file,
          line,
          'Views receive feature hooks; query and cache implementation belongs in queries.',
        ),
      );
    const target = localTarget(file, specifier);
    if (target === undefined) return;
    const ownFeature = relative.match(featurePath)?.[1];
    const targetFeature = target.match(featurePath)?.[1];
    if (
      targetFeature &&
      targetFeature !== ownFeature &&
      target !== `features/${targetFeature}/index`
    )
      findings.push(
        finding(
          'web-feature-boundary',
          file,
          line,
          `Import features/${targetFeature}/index instead of another feature's internal file.`,
        ),
      );
    if (
      view &&
      (target === 'shared/api' ||
        target.startsWith('shared/api/') ||
        target === 'shared/live' ||
        target.startsWith('shared/live/'))
    )
      findings.push(
        finding(
          'web-view-transport',
          file,
          line,
          'Routes and views use feature queries or commands, not the transport directly.',
        ),
      );
    if (
      view &&
      (target === 'shared/query' ||
        target.startsWith('shared/query/') ||
        target === 'app/api' ||
        (targetFeature && target.startsWith(`features/${targetFeature}/api/`)))
    )
      findings.push(
        finding(
          'web-view-query-owner',
          file,
          line,
          'Views call feature hooks; API and cache implementation belongs in API or queries.',
        ),
      );
  };
  new Visitor({
    JSXOpeningElement(node) {
      if (uiFile || node.name.type !== 'JSXIdentifier') return;
      if (
        !nativePrimitives.has(node.name.name) &&
        !shadcnNames.has(node.name.name)
      )
        return;
      if (
        !node.attributes.some(
          (attribute) =>
            attribute.type === 'JSXSpreadAttribute' &&
            attribute.argument.type === 'Identifier' &&
            attribute.argument.name === 'props',
        )
      )
        return;
      findings.push(
        finding(
          'web-shadcn-wrapper',
          file,
          lineOf(node.start),
          'Forwarding generic props through another primitive duplicates shadcn. Use its registry component and variants in the feature view.',
        ),
      );
    },
    ImportDeclaration(node) {
      if (typeof node.source.value === 'string')
        checkImport(node.start, node.source.value);
    },
    ExportNamedDeclaration(node) {
      if (node.source && typeof node.source.value === 'string')
        checkImport(node.start, node.source.value);
    },
    ExportAllDeclaration(node) {
      if (typeof node.source.value === 'string')
        checkImport(node.start, node.source.value);
    },
    ImportExpression(node) {
      if (
        node.source.type === 'Literal' &&
        typeof node.source.value === 'string'
      )
        checkImport(node.start, node.source.value);
    },
    CallExpression(node) {
      const callee = node.callee;
      const direct = callee.type === 'Identifier' && callee.name === 'fetch';
      const global =
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        ['window', 'globalThis'].includes(callee.object.name) &&
        callee.property.type === 'Identifier' &&
        callee.property.name === 'fetch';
      if ((direct || global) && !relative.startsWith('shared/api/'))
        findings.push(
          finding(
            'web-transport-owner',
            file,
            lineOf(node.start),
            'Network effects belong in shared/api.',
          ),
        );
    },
    NewExpression(node) {
      const callee = node.callee;
      const direct =
        callee.type === 'Identifier' &&
        (callee.name === 'WebSocket' || callee.name === 'EventSource');
      const global =
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        ['window', 'globalThis'].includes(callee.object.name) &&
        callee.property.type === 'Identifier' &&
        (callee.property.name === 'WebSocket' ||
          callee.property.name === 'EventSource');
      if ((direct || global) && !relative.startsWith('shared/live/'))
        findings.push(
          finding(
            'web-transport-owner',
            file,
            lineOf(node.start),
            'Live connections belong in shared/live.',
          ),
        );
    },
  }).visit(ast);
  return findings;
}
