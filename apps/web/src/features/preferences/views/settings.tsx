import { archiveSettings } from '@porcelain/client/preferences/rules';
import type { Preferences } from '@porcelain/client/preferences';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';
import { Fragment } from 'react';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePreferences } from '../store';

const archiveDescriptions = {
  archiveDeleteWorktree:
    'Removes the review’s folder. The main checkout is never deleted.',
  archiveDeleteLocalBranch: 'Deletes the review branch from this clone.',
  archiveDeleteRemoteBranch: 'Deletes the branch on origin if it still exists.',
};

type ChoiceName = {
  [K in keyof Preferences]: Preferences[K] extends string ? K : never;
}[keyof Preferences];

function Choice<K extends ChoiceName>({
  label,
  description,
  name,
  options,
}: {
  label: string;
  description: string;
  name: K;
  options: { value: Preferences[K]; label: string }[];
}) {
  const { preferences, setPreference } = usePreferences();
  return (
    <Item variant="outline">
      <ItemContent className="min-w-0">
        <ItemTitle>{label}</ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Tabs
          value={preferences[name]}
          onValueChange={(value: unknown) => {
            const selected = options.find((option) => option.value === value);
            if (selected) setPreference(name, selected.value);
          }}
        >
          <TabsList aria-label={label}>
            {options.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </ItemActions>
    </Item>
  );
}

function ArchiveSettings() {
  const { preferences, setPreference } = usePreferences();
  return (
    <FieldSet>
      <FieldLegend variant="label">When archiving a review</FieldLegend>
      <ItemGroup>
        {archiveSettings.map(({ key, label }) => (
          <Fragment key={key}>
            <Item variant="outline">
              <ItemContent className="min-w-0">
                <ItemTitle>{label}</ItemTitle>
                <ItemDescription>{archiveDescriptions[key]}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Switch
                  aria-label={label}
                  checked={preferences[key]}
                  onCheckedChange={(checked) => setPreference(key, checked)}
                />
              </ItemActions>
            </Item>
            {key !== archiveSettings.at(-1)?.key && <Separator />}
          </Fragment>
        ))}
      </ItemGroup>
    </FieldSet>
  );
}

function SpecFilesSetting() {
  const { preferences, setPreference } = usePreferences();
  return (
    <Item variant="outline">
      <ItemContent className="min-w-0">
        <ItemTitle>Spec files</ItemTitle>
        <ItemDescription>
          Group specs separately and start them collapsed, in a review and in
          the changed files.
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Switch
          aria-label="Spec files"
          checked={preferences.collapseSpecs}
          onCheckedChange={(checked) => setPreference('collapseSpecs', checked)}
        />
      </ItemActions>
    </Item>
  );
}

export function GeneralSettings() {
  return (
    <>
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">
          <span className="text-muted-foreground">Settings.</span> General
        </h1>
        <p className="text-base">
          How Porcelain looks, and how code and documents open.
        </p>
      </div>
      <FieldSet>
        <FieldLegend variant="label">Appearance</FieldLegend>
        <ItemGroup>
          <Choice
            label="Theme"
            description="System follows your operating system."
            name="appearance"
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </ItemGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend variant="label">Code</FieldLegend>
        <ItemGroup>
          <Choice
            label="Diff layout"
            description="Split shows old and new side by side."
            name="diffStyle"
            options={[
              { value: 'unified', label: 'Unified' },
              { value: 'split', label: 'Split' },
            ]}
          />
          <Separator />
          <Choice
            label="Long lines"
            description="Wrap keeps every line visible without scrolling."
            name="lineOverflow"
            options={[
              { value: 'scroll', label: 'Scroll' },
              { value: 'wrap', label: 'Wrap' },
            ]}
          />
        </ItemGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend variant="label">Documents</FieldLegend>
        <ItemGroup>
          <Choice
            label="Documents open as"
            description="Markdown and HTML. You can switch per file; HTML previews run in a sandbox with no access to Porcelain."
            name="documentsDefault"
            options={[
              { value: 'rendered', label: 'Rendered' },
              { value: 'source', label: 'Source' },
            ]}
          />
        </ItemGroup>
      </FieldSet>
      <p className="text-xs text-muted-foreground">
        These preferences are saved on this device.
      </p>
    </>
  );
}

export function ReviewsGitSettings() {
  return (
    <>
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">
          <span className="text-muted-foreground">Settings.</span> Reviews &amp;
          Git
        </h1>
        <p className="text-base">
          How reviews read, and what Git does when you pull and archive.
        </p>
      </div>
      <FieldSet>
        <FieldLegend variant="label">Reviews</FieldLegend>
        <ItemGroup>
          <SpecFilesSetting />
        </ItemGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend variant="label">Git</FieldLegend>
        <ItemGroup>
          <Choice
            label="Pull strategy"
            description="Used by Pull in the Git menu."
            name="pullStrategy"
            options={[
              { value: 'merge', label: 'Merge' },
              { value: 'rebase', label: 'Rebase' },
            ]}
          />
        </ItemGroup>
      </FieldSet>
      <ArchiveSettings />
      <p className="text-xs text-muted-foreground">
        Spec files, Git and archiving are saved on this device. Archive and pull
        run on the computer that holds the worktree.
      </p>
    </>
  );
}
