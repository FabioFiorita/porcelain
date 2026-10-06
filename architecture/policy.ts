export const domainPackages = [
  'projects',
  'changes',
  'reviews',
  'files',
  'git-actions',
  'access',
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

// These helpers scope retained lint rules; they do not prescribe file placement.
export function webPart(path: string): string | undefined {
  if (
    path.startsWith('apps/web/spec/integration/') &&
    /\.test\.tsx?$/.test(path)
  )
    return 'integration-spec';
  if (path.startsWith('apps/web/spec/e2e/') && /\.e2e\.tsx?$/.test(path))
    return 'e2e-spec';
  if (/\.(?:spec|test)\.tsx?$/.test(path) || path.includes('/spec/'))
    return undefined;
  if (/^apps\/web\/src\/components\/ui\//.test(path)) return 'ui';
  if (/^apps\/(?:web|mobile)\/src\/(?:app|shell)\//.test(path)) return 'shell';
  if (/^(?:apps\/(?:web|mobile)|packages\/client)\/src\/config\//.test(path))
    return 'web-limits';
  const feature =
    /^(?:apps\/(?:web|mobile)|packages\/client)\/src\/features\/[^/]+\/(.+)$/.exec(
      path,
    )?.[1];
  if (!feature) return undefined;
  const part = feature.split('/')[0]?.replace(/\.tsx?$/, '');
  return (
    (
      {
        views: 'view',
        adapters: 'adapter',
        queries: 'query',
        commands: 'command',
        rules: 'web-rule',
      } as Record<string, string>
    )[part ?? ''] ?? part
  );
}

export const nodeGlobalRoles: ReadonlySet<string> = new Set([
  'platform',
  'test',
]);

export function classify(
  path: string,
): { role: string; owner: string } | undefined {
  const owner = /^(?:apps|packages)\/([^/]+)\//.exec(path)?.[1];
  if (!owner) return undefined;
  if (/\.spec\.ts$|\/spec\//.test(path)) return { role: 'test', owner };
  if (
    /^(?:apps\/desktop|packages\/(?:git|agents|storage|process))\/src\//.test(
      path,
    ) ||
    /^apps\/server\/src\/adapters\//.test(path)
  )
    return { role: 'platform', owner };
  const role = webPart(path);
  return role ? { role, owner } : undefined;
}
