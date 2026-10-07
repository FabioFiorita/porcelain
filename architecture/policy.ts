export const domainPackages = [
  'projects',
  'changes',
  'reviews',
  'files',
  'git-actions',
  'access',
] as const;

export const webDomains = [
  'access',
  'projects',
  'changes',
  'files',
  'git-actions',
  'history',
  'reviews',
  'preferences',
  'live',
] as const;

export const shadcnRegistry: ReadonlySet<string> = new Set([
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

export const archRules = [
  'theme-data-only',
  'theme-imports-stylesheets-only',
  'mobile-style-config',
  'mobile-imports-mobile-client-and-contracts-only',
  'mobile-routes-import-feature-index',
  'mobile-features-import-feature-index',
  'mobile-shared-imports-no-owner',
  'mobile-nothing-imports-routes',
  'client-imports-client-and-contracts-only',
  'client-public-api-only',
  'code-outside-roots',
  'missing-server-structure',
  'no-helpers-folder',
  'flat-http-route',
  'use-case-file-name',
  'service-file-name',
  'role-folder-is-flat',
  'unclassified-source',
  'cross-package-import-must-use-package-name',
  'unclassified-import-target',
  'import-outside-source-roots',
  'runtime-node-allow-list',
  'no-circular-source-imports',
  'git-capability-dependency-order',
  'git-capability-public-api-only',
  'infrastructure-layout',
  'test-imports-own-package-support-only',
  'store-contract-runs-against-its-fake-storage-and-server-adapters-only',
  'package-cannot-import-server',
  'fake-imports-own-package-only',
  'fixture-imports-own-package-models-only',
  'git-cannot-import-domain',
  'domain-cannot-import-another-domain',
  'domain-cannot-import-transport-contract',
  'contract-imports-kernel-rules-only',
  'git-public-api-only',
  'domain-public-api-only',
  'kernel-public-api-only',
  'storage-public-api-only',
  'agents-public-api-only',
  'process-public-api-only',
  'process-importable-by-git-agents-installer',
  'lane-per-table',
  'lane-mode-matches-service',
  'worktree-use-case-checks',
  'unused-export',
  'unused-dependency',
  'web-shadcn-ui-owner',
  'web-shadcn-primitive-owner',
  'web-no-runtime-fixture',
  'web-routes-import-feature-index',
  'web-features-import-feature-index',
  'web-shared-imports-no-owner',
  'web-nothing-imports-routes',
] as const;

export type ArchRule = string;
export const archRuleFamilies = [
  '<role>-cannot-import-<role>',
  '<role>-cannot-import-external',
] as const;
export function archRuleFamily(name: string): string | undefined {
  if (archRules.some((rule) => rule === name)) return;
  return /^.+-cannot-import-external$/.test(name)
    ? '<role>-cannot-import-external'
    : /^.+-cannot-import-.+$/.test(name)
      ? '<role>-cannot-import-<role>'
      : undefined;
}
export const styleRules = [
  'architecture-budget',
  'disable-directives',
  'one-lint-config',
  'strict-json',
  'lint-config',
  'probe-shape',
  'tsconfig',
  'package-scripts',
  'vitest-config',
  'cruiser-config',
  'ci-steps',
  'manual-audits',
  'pre-push-hook',
  'code-outside-lint-roots',
  'prose-outside-skills',
  'format-config',
  'vite-config',
  'route-tree',
  'react-compiler',
  'shadcn-ui-pinned',
  'playwright-config',
  'duplicate-code',
] as const;

export type StyleRule = (typeof styleRules)[number];

export const generatedRouteTree = 'apps/web/src/routeTree.gen.ts';

export const nodeGlobalRoles: ReadonlySet<string> = new Set([
  'client-integration-test',
  'client-test-kit',
  'desktop',
  'desktop-gateway',
  'gateway',
  'gateway-api',
  'repository',
  'repository-api',
  'process',
  'process-api',
]);
const webFeatureFiles: Readonly<Record<string, string>> = {
  'api.ts': 'api',
  'store.ts': 'store',
  'live.ts': 'live',
  'overlays.ts': 'overlays',
  'index.ts': 'feature-index',
};
const webFolderParts: Readonly<Record<string, string>> = {
  queries: 'query',
  commands: 'command',
  rules: 'web-rule',
  adapters: 'adapter',
  views: 'view',
};
const webDomainSet: ReadonlySet<string> = new Set(webDomains);
const webCode = /\.tsx?$/;

function mobilePart(path: string): string | undefined {
  if (path === 'apps/mobile/metro.config.cjs') return 'mobile-metro-config';
  if (path === 'apps/mobile/app.config.ts') return 'mobile-config';
  if (/^apps\/mobile\/src\/shared\/rules\/.+\.spec\.ts$/.test(path))
    return 'web-rule-spec';
  if (/^apps\/mobile\/src\/shared\/rules\/[a-z-]+\.ts$/.test(path))
    return 'web-rule';
  const inside = path.slice('apps/mobile/src/'.length);
  if (!path.startsWith('apps/mobile/src/')) return;
  if (inside === 'app.css') return 'app-stylesheet';
  if (inside === 'config/uniwind-types.d.ts') return 'mobile-generated-types';
  if (inside === 'config/limits.ts') return 'web-limits';
  if (/^app\/(?:[^/]+\/)*[^/]+\.tsx$/.test(inside)) return 'route';
  if (/^shell\/[^/]+(?:\.(?:ios|android))?\.tsx?$/.test(inside)) return 'shell';
  if (
    /^shared\/(?:[a-z-]+\/)?[a-z-]+(?:\.(?:ios|android))?\.tsx?$/.test(inside)
  )
    return 'web-shared';
  const feature = /^features\/([^/]+)\/(.+)$/.exec(inside);
  if (!feature || !webDomainSet.has(feature[1] ?? '')) return;
  if (feature[2] === 'index.ts') return 'feature-index';
  if (feature[2] === 'store.ts') return 'mobile-store';
  if (feature[2] === 'api.ts') return 'api';
  if (/^queries\/[a-z-]+\.ts$/.test(feature[2] ?? '')) return 'query';
  if (/^commands\/[a-z-]+\.ts$/.test(feature[2] ?? '')) return 'command';
  if (/^views\/[a-z-]+(?:\.(?:ios|android))?\.tsx$/.test(feature[2] ?? ''))
    return 'view';
  if (/^adapters\/[a-z-]+(?:\.(?:ios|android))?\.tsx?$/.test(feature[2] ?? ''))
    return 'adapter';
  return;
}

export function webPart(path: string): string | undefined {
  if (path.startsWith('apps/mobile/')) {
    const role = mobilePart(path);
    return role === 'mobile-store' ? 'store' : role;
  }
  if (path.startsWith('packages/client/src/')) {
    const classified = classify(path);
    return classified?.role === 'client-rules-api'
      ? 'web-rule'
      : classified?.role === 'client-request-api'
        ? 'api'
        : classified?.role;
  }
  if (path === 'apps/web/vite.config.ts') return 'web-config';
  if (/^apps\/web\/src\/[^/]+\.css$/.test(path)) return 'app-stylesheet';
  if (/^apps\/web\/(?:playwright|vitest)\.config\.ts$/.test(path))
    return 'web-test-config';
  if (path === 'apps/web/spec/integration/host.ts') return 'integration-host';
  if (path.startsWith('apps/web/spec/integration/'))
    return path.endsWith('.test.tsx') ? 'integration-spec' : 'integration-kit';
  if (path.startsWith('apps/web/spec/e2e/'))
    return path.endsWith('.e2e.ts') ? 'e2e-spec' : 'e2e-kit';
  if (path.startsWith('apps/web/spec/kit/')) return 'web-test-kit';
  if (!path.startsWith('apps/web/src/') || !webCode.test(path)) return;
  const inside = path.slice('apps/web/src/'.length);
  const parts = inside.split('/');
  const top = parts[0] ?? '';
  if (inside === 'main.tsx' || path === generatedRouteTree) return 'web-entry';
  if (inside === 'config/limits.ts') return 'web-limits';
  if (top === 'routes') return 'route';
  if (top === 'app') return inside.endsWith('.tsx') ? 'shell' : undefined;
  if (top === 'components' && parts[1] === 'ui') return 'ui';
  if (top === 'shared') return 'web-shared';
  if (top !== 'features' || parts.length < 3) return;
  const part = parts[2] ?? '';
  if (parts.length === 3) return webFeatureFiles[part];
  if (part === 'rules' && inside.endsWith('.spec.ts')) return 'web-rule-spec';
  return part === 'api' ? 'api' : webFolderParts[part];
}

export function classify(
  path: string,
): { role: string; owner: string } | undefined {
  const match = /^(packages|apps)\/([^/]+)\/(src|spec)\/(.+)$/.exec(path);
  if (!match) return;
  const owner = match[2] ?? '';
  const inside = match[4] ?? '';
  const role =
    owner === 'client' && match[3] === 'spec'
      ? inside.startsWith('integration/')
        ? 'client-integration-test'
        : 'client-test-kit'
      : /\.spec\.tsx?$/.test(path) &&
          !['web', 'mobile', 'client'].includes(owner)
        ? 'test'
        : match[3] === 'spec'
          ? 'test'
          : /(?:^|\/)config\/limits\.ts$/.test(inside)
            ? 'web-limits'
            : owner === 'client'
              ? (clientPart(inside) ?? 'client')
              : ['web', 'mobile'].includes(owner)
                ? webPart(path)
                : owner === 'desktop'
                  ? inside.startsWith('adapters/')
                    ? 'desktop-gateway'
                    : 'desktop'
                  : ['git', 'agents'].includes(owner)
                    ? 'gateway'
                    : owner === 'storage'
                      ? 'repository'
                      : owner === 'process'
                        ? 'process'
                        : owner === 'server' && inside.startsWith('adapters/')
                          ? 'gateway'
                          : inside.split('/')[0];
  return role === undefined ? undefined : { role, owner };
}
function clientPart(inside: string): string | undefined {
  if (inside === 'shared/api/index.ts') return 'client-transport-api';
  if (inside.startsWith('shared/api/')) return 'web-shared';
  const part = /^features\/[^/]+\/(.+)$/.exec(inside)?.[1];
  if (!part) return;
  if (part === 'index.ts') return 'client-feature-api';
  if (part === 'api.ts') return 'client-request-api';
  if (part === 'rules/index.ts') return 'client-rules-api';
  if (part.startsWith('rules/'))
    return part.endsWith('.spec.ts') ? 'web-rule-spec' : 'web-rule';
  if (part.startsWith('ports/')) return 'client-port';
  return part === 'store.ts' || part.startsWith('store/')
    ? 'store'
    : webFolderParts[part.split('/')[0] ?? ''];
}
