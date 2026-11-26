import { Link } from '@tanstack/react-router';
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
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
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
  ItemTitle,
} from '@/components/ui/item';
import { useState, type ReactNode } from 'react';
import { CheckIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  SettingsGroup,
  SettingsSection,
} from '@/shared/views/settings-section';
import { usePreferences } from '../store';
import { WalkthroughSettings } from './walkthrough-settings';
import { GitHubAccounts } from './github-accounts';

type ReviewGitSettingsChange = Partial<ReviewGitSettings>;

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
  description?: string | undefined;
  children: ReactNode;
}) {
  return (
    <Item>
      <ItemContent className="min-w-0">
        <ItemTitle>{label}</ItemTitle>
        {description && <ItemDescription>{description}</ItemDescription>}
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
  description?: string | undefined;
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
              <span className="inline-flex items-center gap-1">
                {value === option.value && (
                  <CheckIcon aria-hidden className="size-3.5" />
                )}
                <span
                  className={
                    value === option.value ? 'font-semibold' : undefined
                  }
                >
                  {option.label}
                </span>
              </span>
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
  description?: string | undefined;
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
  checked: boolean | undefined;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const state = checked === true ? 'On' : 'Off';
  return (
    <SettingItem label={label} description={description}>
      <span aria-hidden className="text-xs text-muted-foreground">
        {checked === undefined ? 'Unavailable' : state}
      </span>
      <Switch
        aria-label={label}
        checked={checked ?? false}
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
          Porcelain on {computer} is older and keeps no Changes &amp; Git
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
              Every device connected to {computer.phrase} uses the same Changes
              &amp; Git settings. These preview values come from this device’s
              preferences or the defaults. Controls stay disabled until you use
              them for {computer.phrase}.
            </p>
            <Link
              to="/settings/$section"
              params={{ section: 'git' }}
              hash="archive-settings"
              replace
              className="w-fit text-foreground underline underline-offset-4"
            >
              Review archive deletions
            </Link>
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
      <SettingsSection id="changes" title="Changes">
        <SettingsGroup>
          <SwitchItem
            label="Spec files"
            description="Group specs separately and start them collapsed, in the changed files."
            checked={settings?.collapseSpecs}
            disabled={!editable}
            onChange={(collapseSpecs) => change({ collapseSpecs })}
          />
        </SettingsGroup>
      </SettingsSection>
      <SettingsSection id="git" title="Git">
        <SettingsGroup>
          <ChoiceItem
            label="Pull strategy"
            value={settings?.pullStrategy}
            disabled={!editable}
            options={[
              { value: 'merge', label: 'Merge' },
              { value: 'rebase', label: 'Rebase' },
            ]}
            onChange={(pullStrategy) => change({ pullStrategy })}
          />
        </SettingsGroup>
      </SettingsSection>
      <WalkthroughSettings connection={connection} />
      <GitHubAccounts connection={connection} />
      <SettingsSection id="archive-settings" title="When archiving">
        <FieldDescription>
          Archive asks you to confirm these deletions before running them.
        </FieldDescription>
        <SettingsGroup>
          {archiveSettings.map(({ key, label, description }) => (
            <SwitchItem
              key={key}
              label={label}
              description={description}
              checked={settings?.[key]}
              disabled={!editable}
              onChange={(checked) => change({ [key]: checked })}
            />
          ))}
        </SettingsGroup>
      </SettingsSection>
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
    <Field orientation="horizontal" className="w-fit max-w-full">
      <FieldLabel htmlFor="settings-computer" className="shrink-0">
        Computer
      </FieldLabel>
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
        <SelectTrigger
          id="settings-computer"
          className="w-60 max-w-full min-w-0"
        >
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
    </Field>
  );
}

export function GeneralSettings() {
  return (
    <>
      <SettingsSection id="appearance" title="Appearance">
        <SettingsGroup>
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
        </SettingsGroup>
      </SettingsSection>
      <SettingsSection id="code" title="Code">
        <SettingsGroup>
          <Choice
            label="Diff layout"
            description="Split shows old and new side by side."
            name="diffStyle"
            options={[
              { value: 'unified', label: 'Unified' },
              { value: 'split', label: 'Split' },
            ]}
          />
          <Choice
            label="Long lines"
            name="lineOverflow"
            options={[
              { value: 'scroll', label: 'Scroll' },
              { value: 'wrap', label: 'Wrap long lines' },
            ]}
          />
        </SettingsGroup>
      </SettingsSection>
      <SettingsSection id="documents" title="Documents">
        <SettingsGroup>
          <Choice
            label="Documents open as"
            description="Markdown and HTML. Switch per file."
            name="documentsDefault"
            options={[
              { value: 'rendered', label: 'Rendered' },
              { value: 'source', label: 'Source' },
            ]}
          />
        </SettingsGroup>
      </SettingsSection>
      <p className="text-xs text-muted-foreground">
        These preferences are saved on this device.
      </p>
    </>
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
