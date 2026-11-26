import { ChevronDownIcon } from 'lucide-react';
import {
  chooseWalkthroughWriter,
  resolvedWalkthroughWriterKey,
  walkthroughWriterKey,
  walkthroughWriterLabel,
  walkthroughWriterMenu,
  withWalkthroughEffort,
} from '@porcelain/client/projects/rules';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInventory } from '@/features/projects/index';
import type { DocumentProps } from '@/features/workspace/index';
import { TruncatedText } from '@/shared/views/truncated-text';
import { useProjectDefaultWriter } from '../commands/project-default-writer';
import type { useWalkthroughWriter } from '../queries/writer';

export function WalkthroughWriterMenu({
  document,
  writer: check,
}: {
  document: DocumentProps;
  writer: ReturnType<typeof useWalkthroughWriter>;
}) {
  const { connection } = document.context;
  const project = useInventory(connection).projects.find(
    (entry) => entry.id === document.scope.projectId,
  );
  const projectDefault = useProjectDefaultWriter(connection, () =>
    check.choose(undefined),
  );
  const { settings, writer } = check;
  if (!settings || !writer || settings.models.length === 0) return null;
  const { models } = settings;
  const key = walkthroughWriterKey(writer);
  const label = walkthroughWriterLabel(writer, models);
  const groups = walkthroughWriterMenu(models);
  const current = models.find(
    (model) =>
      model.provider === writer.provider && model.model === writer.model,
  );
  const efforts = current?.efforts ?? [];
  const pinned = current?.label ?? writer.model;
  const saved = project?.walkthroughSettings?.writer;
  const isDefault =
    saved !== undefined &&
    resolvedWalkthroughWriterKey(saved, models) === key &&
    saved.effort === writer.effort;
  const choose = (next: string) =>
    check.choose(chooseWalkthroughWriter(next, writer, models));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Writer: ${label}`}
            className="max-w-full min-w-0"
          />
        }
      >
        <TruncatedText text={label} />
        <ChevronDownIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Writer for the next run</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuRadioGroup value={key} onValueChange={choose}>
          {groups.map((group) =>
            group.latest.length > 0 ? (
              <DropdownMenuGroup key={group.provider}>
                <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                {group.latest.map((item) => (
                  <DropdownMenuRadioItem
                    closeOnSelect
                    key={item.key}
                    value={item.key}
                  >
                    {item.label}
                    <span className="mr-5 ml-auto text-muted-foreground">
                      {item.model}
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuGroup>
            ) : null,
          )}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Exact model
            {writer.latest === undefined && (
              <TruncatedText
                text={pinned}
                className="ml-auto text-muted-foreground"
              />
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            <DropdownMenuRadioGroup value={key} onValueChange={choose}>
              {groups.map((group) => (
                <DropdownMenuGroup key={group.provider}>
                  <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                  {group.exact.map((item) => (
                    <DropdownMenuRadioItem
                      closeOnSelect
                      key={item.key}
                      value={item.key}
                    >
                      {item.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuGroup>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Effort
            <span className="ml-auto text-muted-foreground">
              {writer.effort}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-36">
            <DropdownMenuRadioGroup
              value={writer.effort}
              onValueChange={(effort: string) =>
                check.choose(withWalkthroughEffort(writer, effort))
              }
            >
              {efforts.map((effort) => (
                <DropdownMenuRadioItem
                  closeOnSelect
                  key={effort}
                  value={effort}
                >
                  {effort}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {project && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isDefault || projectDefault.saving}
              onSelect={() => projectDefault.save(project, writer, label)}
            >
              {isDefault ? 'Project default' : 'Make project default'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
