import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    <Tabs
      className="shrink-0"
      value={value}
      onValueChange={(next: unknown) => {
        if (isChangeScope(next)) onValueChange(next);
      }}
    >
      <TabsList aria-label="Compare">
        {SCOPES.map(({ value: scope, label, Icon }) => (
          <Tooltip key={scope}>
            <TooltipTrigger
              render={<TabsTrigger value={scope} aria-label={label} />}
            >
              <Icon className="@min-3xl/pane:hidden" />
              <span className="hidden whitespace-nowrap @min-3xl/pane:inline">
                {label}
              </span>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </TabsList>
    </Tabs>
  );
}
