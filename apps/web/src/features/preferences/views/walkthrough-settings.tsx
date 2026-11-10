import { useAtom, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import {
  readInventory,
  saveWalkthroughSettings,
} from '@porcelain/client/projects';
import type { Project } from '@porcelain/client/projects/rules';
import type { Connection } from '@/shared/workspace/connection';
import { FieldSet, FieldLegend, FieldDescription } from '@/components/ui/field';
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemActions,
  ItemGroup,
} from '@/components/ui/item';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
export function WalkthroughSettings({
  connection,
}: {
  connection: Connection;
}) {
  const result = useAtomValue(readInventory(connection));
  const inventory = Option.getOrUndefined(AsyncResult.value(result));
  return (
    <FieldSet>
      <FieldLegend variant="label">Walkthroughs</FieldLegend>
      <FieldDescription>
        Choose automatic to write a walkthrough when an open pull request is
        found. Each pull request is handled once, including after a restart. New
        commits do not start another walkthrough.
      </FieldDescription>
      <ItemGroup>
        {inventory?.projects.map((project) => (
          <ProjectWalkthroughSettings
            key={project.id}
            project={project}
            connection={connection}
          />
        ))}
      </ItemGroup>
      {AsyncResult.isFailure(result) && (
        <p role="alert">Could not read projects.</p>
      )}
    </FieldSet>
  );
}
function ProjectWalkthroughSettings({
  connection,
  project,
}: {
  connection: Connection;
  project: Project;
}) {
  const [mutation, save] = useAtom(saveWalkthroughSettings(connection));
  const settings = project.walkthroughSettings ?? {
    mode: 'manual',
    provider: 'claude',
  };
  const disabled = mutation.waiting || !project.available;
  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>{project.name}</ItemTitle>
        {AsyncResult.isFailure(mutation) && (
          <p role="alert">Could not save walkthrough settings.</p>
        )}
      </ItemContent>
      <ItemActions>
        <Select
          value={settings.mode}
          disabled={disabled}
          onValueChange={(mode) => {
            if (mode === 'manual' || mode === 'automatic')
              save({ projectId: project.id, ...settings, mode });
          }}
        >
          <SelectTrigger aria-label={`Walkthrough mode for ${project.name}`}>
            <SelectValue>
              {settings.mode === 'manual' ? 'Manual' : 'Automatic'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="automatic">Automatic</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={settings.provider}
          disabled={disabled}
          onValueChange={(provider) => {
            if (provider === 'claude' || provider === 'codex')
              save({ projectId: project.id, ...settings, provider });
          }}
        >
          <SelectTrigger
            aria-label={`Automatic walkthrough writer for ${project.name}`}
          >
            <SelectValue>
              {settings.provider === 'claude' ? 'Claude' : 'Codex'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="claude">Claude</SelectItem>
            <SelectItem value="codex">Codex</SelectItem>
          </SelectContent>
        </Select>
      </ItemActions>
    </Item>
  );
}
