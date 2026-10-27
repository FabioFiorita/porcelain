import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { FileDiffIcon, GitBranchIcon } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { type ChangeScope, isChangeScope } from '@/shared/workspace/search';

const SCOPES = [
  { value: 'uncommitted', label: 'Uncommitted', Icon: FileDiffIcon },
  { value: 'branch', label: 'Branch', Icon: GitBranchIcon },
] as const;

export function ChangeScopeSwitch({
  value,
  onValueChange,
}: {
  value: ChangeScope;
  onValueChange: (scope: ChangeScope) => void;
}) {
  return (
    <TabsPrimitive.Root
      className="shrink-0"
      value={value}
      onValueChange={(next: unknown) => {
        if (isChangeScope(next)) onValueChange(next);
      }}
    >
      <TabsPrimitive.List
        aria-label="Compare"
        className="flex h-7 items-center gap-0.5 rounded-[calc(var(--radius-chip)+--spacing(0.5))] bg-muted p-0.5 ring-1 ring-border ring-inset"
      >
        {SCOPES.map(({ value: scope, label, Icon }) => (
          <Tooltip key={scope}>
            <TooltipTrigger
              render={
                <TabsPrimitive.Tab
                  value={scope}
                  aria-label={label}
                  className="inline-flex h-6 items-center rounded-chip px-2.5 text-xs leading-6 font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-active:bg-background data-active:text-foreground data-active:shadow-row"
                />
              }
            >
              <Icon className="size-3.5 @min-3xl/pane:hidden" />
              <span className="hidden whitespace-nowrap @min-3xl/pane:inline">
                {label}
              </span>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
