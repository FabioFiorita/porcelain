import { TruncatedText } from '@/shared/views/truncated-text';
import type { ReactNode } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { reviewSidebarActions } from '@porcelain/client/reviews/rules';
import { SidebarActionMenu } from './sidebar-action-menu';
import { ROW } from './change-row';

export function SidebarDocumentRow({
  label,
  active,
  onOpen,
  className = ROW,
  children,
}: {
  label: string;
  active: boolean;
  onOpen: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <SidebarActionMenu
      label={`Actions for ${label}`}
      actions={reviewSidebarActions({ kind: 'section' })}
      onAction={onOpen}
    >
      {(menu) => (
        <div className="flex min-w-0 items-center">
          <button
            type="button"
            className={className}
            aria-pressed={active}
            onClick={onOpen}
          >
            {children}
          </button>
          {menu}
        </div>
      )}
    </SidebarActionMenu>
  );
}

export function SidebarGroup({
  name,
  count,
  expanded,
  onExpanded,
  onAll,
  children,
}: {
  name: string;
  count: number;
  expanded: boolean;
  onExpanded: (expanded: boolean) => void;
  onAll: (expanded: boolean) => void;
  children: ReactNode;
}) {
  const Icon = expanded ? ChevronDownIcon : ChevronRightIcon;
  return (
    <section aria-label={name} className="mt-3 border-t pt-2">
      <SidebarActionMenu
        label={`Actions for ${name}`}
        actions={reviewSidebarActions({ kind: 'group' })}
        onAction={(id) => onAll(id === 'expand-all')}
      >
        {(menu) => (
          <div className="flex min-w-0 items-center">
            <button
              type="button"
              className={ROW}
              aria-label={name}
              aria-expanded={expanded}
              onClick={() => onExpanded(!expanded)}
            >
              <Icon className="size-3.5 shrink-0" />
              <TruncatedText
                className="min-w-0 flex-1"
                text={`${name} · ${count} ${count === 1 ? 'file' : 'files'}`}
              />
            </button>
            {menu}
          </div>
        )}
      </SidebarActionMenu>
      {expanded && children}
    </section>
  );
}
