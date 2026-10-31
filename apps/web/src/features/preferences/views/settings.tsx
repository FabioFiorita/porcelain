import {
  confirmedReviewGitSettings,
  reviewGitSettingsBlock,
  reviewGitSettingsKeptMessage,
  shownReviewGitSettings,
  type ReviewGitSettingsView,
} from '@porcelain/client/preferences/rules';
import { archiveSettings } from '@porcelain/client/projects/rules';
import type { PreferenceChange } from '@porcelain/client/preferences';
import type { ReviewGitSettings } from '@porcelain/client/preferences';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TruncatedText } from '@/shared/views/truncated-text';
import {
  useConnectedContext,
  useRemoteConnections,
} from '@/features/access/index';
import { type Connection } from '@/shared/workspace/connection';
import {
  useReviewGitSettings,
  useReviewGitSettingsTrust,
} from '../queries/review-git-settings';
import { useReviewGitSettingsCommands } from '../commands/review-git-settings';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';
import { Fragment, useState, type ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsHeading } from '@/shared/views/settings-heading';
import { usePreferences } from '../store';
import { GitHubAccounts } from './github-accounts';

type ReviewGitSettingsChange = Partial<ReviewGitSettings>;

const archiveDescriptions = {
  archiveDeleteWorktree:
    'Removes the review’s folder. The main checkout is never deleted.',
  archiveDeleteLocalBranch: 'Deletes the review branch from this clone.',
  archiveDeleteRemoteBranch: 'Deletes the branch on origin if it still exists.',
};

type ChoiceName = {
  [K in keyof PreferenceChange]-?: NonNullable<
    PreferenceChange[K]
  > extends string
    ? K
    : never;
}[keyof PreferenceChange];

function SettingItem({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Item variant="outline">
      <ItemContent className="min-w-0">
        <ItemTitle>{label}</ItemTitle>
        <ItemDescription>{description}</ItemDescription>
      </ItemContent>
      <ItemActions>{children}</ItemActions>
    </Item>
  );
}

type ChoiceOption<V extends string> = { value: V; label: string };

function ChoiceItem<V extends string>({
  label,
  description,
  value,
  options,
  disabled = false,
  onChange,
}: {
  label: string;
  description: string;
  value: V | undefined;
  options: ChoiceOption<V>[];
  disabled?: boolean;
  onChange: (value: V) => void;
}) {
  return (
    <SettingItem label={label} description={description}>
      <Tabs
        value={value ?? null}
        onValueChange={(next: unknown) => {
          const selected = options.find((option) => option.value === next);
          if (selected) onChange(selected.value);
        }}
      >
        <TabsList aria-label={label}>
          {options.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              disabled={disabled}
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </SettingItem>
  );
}

function Choice<K extends ChoiceName>({
  label,
  description,
  name,
  options,
}: {
  label: string;
  description: string;
  name: K;
  options: ChoiceOption<NonNullable<PreferenceChange[K]>>[];
}) {
  const { preferences, setPreference } = usePreferences();
  return (
    <ChoiceItem
      label={label}
      description={description}
      value={preferences[name]}
      options={options}
      onChange={(value) => setPreference(name, value)}
    />
  );
}

function SwitchItem({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <SettingItem label={label} description={description}>
      <Switch
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </SettingItem>
  );
}

function SettingsNotice({
  view,
  computer,
  onRetry,
}: {
  view: ReviewGitSettingsView;
  computer: string;
  onRetry: () => void;
}) {
  if (view.kind === 'unsupported')
    return (
      <Alert>
        <AlertTitle>Update {computer} to sync settings</AlertTitle>
        <AlertDescription>
          Porcelain on {computer} is older and keeps no Reviews &amp; Git
          settings. Update it from Computers to choose them here.
        </AlertDescription>
      </Alert>
    );
  const block = reviewGitSettingsBlock(view);
  if (view.kind === 'reading' || view.kind === 'unconfigured' || !block)
    return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>Settings unavailable</AlertTitle>
      <AlertDescription>
        <p>{block}</p>
        <p>Pull and Archive wait until they can be read again.</p>
        <Button className="mt-3" size="sm" variant="outline" onClick={onRetry}>
          Read settings again
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function ReviewGitSettingsForm({
  connection,
  computer,
}: {
  connection: Connection;
  computer: SettingsComputer;
}) {
  const view = useReviewGitSettings(connection);
  const untrusted = useReviewGitSettingsTrust(connection);
  const { preferences } = usePreferences();
  const { save, saving, failure, kept, readAgain, checkTrustAgain } =
    useReviewGitSettingsCommands(connection);
  const settings = shownReviewGitSettings(
    view,
    preferences.reviewGitSettingsImportCandidate,
  );
  const editable = confirmedReviewGitSettings(view) !== undefined && !saving;
  const change = (next: ReviewGitSettingsChange) =>
    save({ kind: 'change', change: next });
  return (
    <>
      <SettingsNotice
        view={view}
        computer={computer.phrase}
        onRetry={() => readAgain(undefined)}
      />
      {view.kind === 'unconfigured' && (
        <Alert>
          <AlertTitle>Choose settings for {computer.phrase}</AlertTitle>
          <AlertDescription>
            <p>
              Every device connected to {computer.phrase} uses the same Reviews
              &amp; Git settings. These are the ones this browser used before;
              check the archive deletions below, then use them for{' '}
              {computer.phrase}.
            </p>
            {untrusted && <p>{untrusted}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                className="h-auto min-h-7 max-w-full whitespace-normal"
                size="sm"
                disabled={saving || untrusted !== undefined}
                onClick={() =>
                  save({
                    kind: 'initialize',
                    settings: preferences.reviewGitSettingsImportCandidate,
                  })
                }
              >
                Use these settings for {computer.phrase}
              </Button>
              {untrusted && (
                <Button size="sm" variant="outline" onClick={checkTrustAgain}>
                  Check again
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
      {kept && (
        <Alert>
          <AlertDescription>
            {reviewGitSettingsKeptMessage(computer.name)}
          </AlertDescription>
        </Alert>
      )}
      {failure && (
        <Alert variant="destructive">
          <AlertTitle>Not saved</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
      <FieldSet>
        <FieldLegend variant="label">Reviews</FieldLegend>
        <ItemGroup>
          <SwitchItem
            label="Spec files"
            description="Group specs separately and start them collapsed, in a review and in the changed files."
            checked={settings?.collapseSpecs ?? false}
            disabled={!editable}
            onChange={(collapseSpecs) => change({ collapseSpecs })}
          />
        </ItemGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend variant="label">Git</FieldLegend>
        <ItemGroup>
          <ChoiceItem
            label="Pull strategy"
            description="Used by Pull in the Git menu."
            value={settings?.pullStrategy}
            disabled={!editable}
            options={[
              { value: 'merge', label: 'Merge' },
              { value: 'rebase', label: 'Rebase' },
            ]}
            onChange={(pullStrategy) => change({ pullStrategy })}
          />
        </ItemGroup>
      </FieldSet>
      <GitHubAccounts connection={connection} />
      <FieldSet>
        <FieldLegend variant="label">When archiving a review</FieldLegend>
        <ItemGroup>
          {archiveSettings.map(({ key, label }) => (
            <Fragment key={key}>
              <SwitchItem
                label={label}
                description={archiveDescriptions[key]}
                checked={settings?.[key] ?? false}
                disabled={!editable}
                onChange={(checked) => change({ [key]: checked })}
              />
              {key !== archiveSettings.at(-1)?.key && <Separator />}
            </Fragment>
          ))}
        </ItemGroup>
      </FieldSet>
    </>
  );
}

function ComputerPicker({
  computers,
  selected,
  onSelect,
}: {
  computers: readonly SettingsComputer[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor="settings-computer">Computer</FieldLabel>
      <Select
        items={computers.map((computer) => ({
          value: computer.id,
          label: computer.name,
        }))}
        value={selected}
        onValueChange={(value) => {
          if (typeof value === 'string') onSelect(value);
        }}
      >
        <SelectTrigger id="settings-computer" className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {computers.map((computer) => (
            <SelectItem key={computer.id} value={computer.id}>
              <TruncatedText text={computer.name} className="block min-w-0" />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription>
        Each computer keeps its own Reviews &amp; Git settings.
      </FieldDescription>
    </Field>
  );
}

export function GeneralSettings() {
  return (
    <div className="flex flex-col">
      <SettingsHeading
        section="Settings"
        title="General"
        lead="How Porcelain looks, and how code and documents open."
      />
      <div className="mt-8 flex flex-col gap-7">
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
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        These preferences are saved on this device.
      </p>
    </div>
  );
}

type SettingsComputer = {
  id: string;
  name: string;
  phrase: string;
  connection: Connection;
};

export function ReviewsGitSettings() {
  const { connection } = useConnectedContext();
  const remotes = useRemoteConnections();
  const computers: readonly SettingsComputer[] = [
    {
      id: 'this-computer',
      name: 'This computer',
      phrase: 'this computer',
      connection,
    },
    ...remotes.map((entry) => ({
      id: entry.remote.environmentId,
      name: entry.remote.name,
      phrase: entry.remote.name,
      connection: entry.connection,
    })),
  ];
  const [chosen, setChosen] = useState('this-computer');
  const computer =
    computers.find((entry) => entry.id === chosen) ?? computers[0];
  return (
    <>
      <SettingsHeading
        section="Settings"
        title="Reviews & Git"
        lead="How reviews read, which GitHub account opens pull requests, and what Git does when you pull and archive."
      />
      {computers.length > 1 && (
        <ComputerPicker
          computers={computers}
          selected={computer?.id ?? 'this-computer'}
          onSelect={setChosen}
        />
      )}
      {computer && (
        <ReviewGitSettingsForm
          key={computer.id}
          connection={computer.connection}
          computer={computer}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Saved on the computer, for every device connected to it. Archive and
        pull run on the computer that holds the worktree.
      </p>
    </>
  );
}
