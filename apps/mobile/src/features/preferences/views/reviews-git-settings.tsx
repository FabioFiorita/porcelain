import { Fragment, useState } from 'react';
import { useAtomRef } from '@effect/atom-react';
import { archiveSettings } from '@porcelain/client/projects/rules';
import {
  confirmedReviewGitSettings,
  reviewGitSettingsBlock,
  reviewGitSettingsKeptMessage,
  shownReviewGitSettings,
} from '@porcelain/client/preferences/rules';
import type { ReviewGitSettings } from '@porcelain/client/preferences';
import type { RuntimeConnection } from '@porcelain/client/transport';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { ErrorState } from '../../../components/ui/error-state';
import { Item } from '../../../components/ui/item';
import { Loading } from '../../../components/ui/loading';
import { Separator } from '../../../components/ui/separator';
import { Switch } from '../../../components/ui/switch';
import { Text } from '../../../components/ui/text';
import { remoteConnectionState } from '../../../shared/application/store';
import {
  useReviewGitSettings,
  useReviewGitSettingsTrust,
} from '../queries/review-git-settings';
import { useReviewGitSettingsCommands } from '../commands/review-git-settings';
import { PreferencesPage } from './preferences-page';
import { PreferenceChoice } from './preference-choice';

function ComputerReviewGitSettings({
  connection,
  computer,
  candidate,
  candidateReady,
}: {
  connection: RuntimeConnection;
  computer: string;
  candidate: ReviewGitSettings;
  candidateReady: boolean;
}) {
  const view = useReviewGitSettings(connection);
  const untrusted = useReviewGitSettingsTrust(connection);
  const { save, saving, failure, kept, readAgain, checkTrustAgain } =
    useReviewGitSettingsCommands(connection);
  const settings = shownReviewGitSettings(view, candidate);
  const disabled = confirmedReviewGitSettings(view) === undefined || saving;
  const block = reviewGitSettingsBlock(view);
  const change = (next: Partial<ReviewGitSettings>) =>
    save({ kind: 'change', change: next });
  return (
    <>
      {view.kind === 'reading' ? (
        <Loading label="Reading Reviews & Git settings…" />
      ) : null}
      {view.kind === 'unsupported' ? (
        <ErrorState
          message={`Update Porcelain on ${computer} to use its Reviews & Git settings.`}
        />
      ) : null}
      {block && (view.kind === 'unreadable' || view.kind === 'configured') ? (
        <ErrorState
          message={`${block}\nPull and Archive wait until they can be read again.`}
          retry={{ label: 'Read settings again', onPress: readAgain }}
        />
      ) : null}
      {view.kind === 'unconfigured' ? (
        <Box gap={3}>
          <Text variant="secondary">
            Every device connected to {computer} uses the same Reviews & Git
            settings. These are the ones this app used before; check the archive
            deletions below, then use them for {computer}.
          </Text>
          {untrusted ? (
            <Text variant="secondary" tone="muted">
              {untrusted}
            </Text>
          ) : null}
          {untrusted ? (
            <Button
              label="Check again"
              variant="tonal"
              onPress={checkTrustAgain}
            />
          ) : null}
          <Button
            label={`Use these settings for ${computer}`}
            pending={saving}
            disabled={!candidateReady || untrusted !== undefined}
            onPress={() => save({ kind: 'initialize', settings: candidate })}
          />
        </Box>
      ) : null}
      {kept ? (
        <Text variant="secondary">
          {reviewGitSettingsKeptMessage(computer)}
        </Text>
      ) : null}
      {failure ? <ErrorState message={failure} /> : null}
      <Box gap={3}>
        <Text variant="headline">When archiving a review</Text>
        <Card>
          {archiveSettings.map(({ key, label }, index) => (
            <Fragment key={key}>
              {index > 0 ? <Separator inset="content" /> : null}
              <Item
                title={label}
                trailing={
                  <Switch
                    label={label}
                    checked={settings?.[key] ?? false}
                    disabled={disabled}
                    onCheckedChange={(value) => change({ [key]: value })}
                  />
                }
              />
            </Fragment>
          ))}
        </Card>
      </Box>
      <Box gap={3}>
        <Text variant="headline">Reviews</Text>
        <Card>
          <Item
            title="Spec files"
            description="Group specs separately in a review on the web and desktop."
            trailing={
              <Switch
                label="Spec files"
                checked={settings?.collapseSpecs ?? false}
                disabled={disabled}
                onCheckedChange={(collapseSpecs) => change({ collapseSpecs })}
              />
            }
          />
        </Card>
      </Box>
      <Box gap={3}>
        <Text variant="headline">Git</Text>
        <PreferenceChoice
          label="Pull strategy"
          description={`Used when pulling changes on ${computer}.`}
          value={settings?.pullStrategy}
          options={[
            { value: 'merge', label: 'Merge', id: 'pull-merge' },
            { value: 'rebase', label: 'Rebase', id: 'pull-rebase' },
          ]}
          disabled={disabled}
          onChange={(pullStrategy) => change({ pullStrategy })}
        />
      </Box>
    </>
  );
}

export function ReviewsGitSettings() {
  const computers = useAtomRef(remoteConnectionState);
  const [chosen, setChosen] = useState<string>();
  const computer =
    computers.find((entry) => entry.remote.environmentId === chosen) ??
    computers[0];
  return (
    <PreferencesPage>
      {({ preferences, disabled }) => (
        <>
          {computers.length > 1 && computer ? (
            <PreferenceChoice
              label="Computer"
              description="Each computer keeps its own Reviews & Git settings."
              value={computer.remote.environmentId}
              options={computers.map((entry) => ({
                value: entry.remote.environmentId,
                label: entry.remote.name,
                id: `computer-${entry.remote.environmentId}`,
              }))}
              disabled={false}
              onChange={setChosen}
            />
          ) : null}
          {computers.length === 1 && computer ? (
            <Text variant="headline" numberOfLines={2}>
              Settings for {computer.remote.name}
            </Text>
          ) : null}
          {computer ? null : (
            <Text variant="secondary" tone="muted">
              Pair a computer to choose its Reviews & Git settings.
            </Text>
          )}
          {computer ? (
            <ComputerReviewGitSettings
              key={computer.remote.environmentId}
              connection={computer.connection}
              computer={computer.remote.name}
              candidate={preferences.reviewGitSettingsImportCandidate}
              candidateReady={!disabled}
            />
          ) : null}
        </>
      )}
    </PreferencesPage>
  );
}
