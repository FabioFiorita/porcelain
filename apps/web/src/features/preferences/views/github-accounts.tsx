import { useAtom, useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { RotateCcwIcon, TriangleAlertIcon } from 'lucide-react';
import {
  readProjectGitHubAccount,
  setProjectGitHubAccount,
} from '@porcelain/client/projects';
import { githubUnavailable } from '@porcelain/client/projects/rules';
import { useGitHubAccountProjects } from '../queries/review-git-settings';
import type { Connection } from '@/shared/workspace/connection';
import { copyText } from '@/shared/workspace/copy';
import { TruncatedText } from '@/shared/views/truncated-text';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldDescription } from '@/components/ui/field';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from '@/components/ui/item';
import {
  SettingsGroup,
  SettingsSection,
} from '@/shared/views/settings-section';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function GitHubAccounts({ connection }: { connection: Connection }) {
  const { projects, failed, retry } = useGitHubAccountProjects(connection);
  return (
    <SettingsSection id="github" title="GitHub accounts">
      <FieldDescription>
        By default, Porcelain uses a signed-in account with access to the
        repository. Your choice applies to every device using this computer.
      </FieldDescription>
      <SettingsGroup>
        {projects?.map((project) => (
          <ProjectAccount
            key={project.id}
            connection={connection}
            project={project}
          />
        ))}
        {projects !== undefined && projects.length > 0 && (
          <p className="hidden px-3 py-2.5 text-ui text-muted-foreground only:block">
            No project has a GitHub remote.
          </p>
        )}
        {projects === undefined && failed && (
          <p
            role="alert"
            className="flex items-center gap-2 px-3 py-2.5 text-ui text-muted-foreground"
          >
            Could not read this computer’s projects.
            <Button size="xs" variant="outline" onClick={retry}>
              Try again
            </Button>
          </p>
        )}
        {projects?.length === 0 && (
          <p className="px-3 py-2.5 text-ui text-muted-foreground">
            Add a project to choose its GitHub account.
          </p>
        )}
      </SettingsGroup>
    </SettingsSection>
  );
}

function ProjectAccount({
  connection,
  project,
}: {
  connection: Connection;
  project: { id: string; name: string };
}) {
  const input = { connection, projectId: project.id };
  const query = readProjectGitHubAccount(input);
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  const [mutation, save] = useAtom(setProjectGitHubAccount(input));
  const account = AsyncResult.isFailure(result)
    ? undefined
    : Option.getOrUndefined(AsyncResult.value(result));
  if (account?.unavailable?.reason === 'not-github') return null;
  const choice = account?.choice;
  const disabled = result.waiting || mutation.waiting;
  const unavailable = account?.unavailable
    ? githubUnavailable(account.unavailable.reason)
    : undefined;
  const noAccess = account?.override
    ? 'The chosen account cannot open it. Choose another or use the detected account.'
    : 'No signed-in account can open it';
  const unavailableDescription =
    account?.unavailable?.reason === 'no-access'
      ? noAccess
      : unavailable?.description;
  const resetLabel = `Use the detected account for ${project.name}`;
  return (
    <Item>
      <ItemContent className="min-w-0">
        <ItemTitle className="max-w-full min-w-0">
          <TruncatedText text={project.name} />
        </ItemTitle>
        {account?.repository && (
          <TruncatedText
            text={account.repository}
            className="block font-mono text-xs leading-4.5 text-muted-foreground"
          />
        )}
      </ItemContent>
      {account && account.accounts.length > 0 && (
        <ItemActions>
          {choice && (
            <Badge variant="secondary">
              {choice.source === 'overridden' ? 'Chosen' : 'Detected'}
            </Badge>
          )}
          <Select
            value={choice?.account ?? account.override ?? null}
            disabled={disabled}
            items={account.accounts.map((value) => ({ value, label: value }))}
            onValueChange={(value) => {
              if (typeof value === 'string' && value !== choice?.account)
                save({ account: value });
            }}
          >
            <SelectTrigger aria-label={`GitHub account for ${project.name}`}>
              <SelectValue>
                {({ value }) =>
                  typeof value !== 'string' ? (
                    'Choose an account'
                  ) : (
                    <TruncatedText text={value} className="block max-w-30" />
                  )
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {account.accounts.map((value) => (
                <SelectItem key={value} value={value}>
                  <TruncatedText text={value} className="block max-w-40" />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ItemActions>
      )}
      {account?.override && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={resetLabel}
                disabled={disabled}
                onClick={() => save({ account: undefined })}
              />
            }
          >
            <RotateCcwIcon aria-hidden="true" className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent>{resetLabel}</TooltipContent>
        </Tooltip>
      )}
      {unavailable && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-ui leading-4.5 text-warn">
          <TriangleAlertIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{unavailableDescription}</span>
          {unavailable.action.kind === 'install' && (
            <Button
              size="xs"
              variant="link"
              render={
                <a
                  href={unavailable.action.url}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              {unavailable.action.label}
            </Button>
          )}
          {unavailable.action.kind === 'copy' && (
            <Button
              size="xs"
              variant="link"
              onClick={() => copyText('gh auth login', 'command')}
            >
              {unavailable.action.label}
            </Button>
          )}
          {unavailable.action.kind !== 'install' && (
            <Button
              size="xs"
              variant="ghost"
              disabled={disabled}
              onClick={refresh}
            >
              Try again
            </Button>
          )}
        </div>
      )}
      {account && account.accounts.length === 0 && !unavailable && (
        <div className="flex flex-wrap items-center gap-2 text-ui text-muted-foreground">
          No GitHub account is available.
          <Button
            size="xs"
            variant="ghost"
            disabled={disabled}
            onClick={refresh}
          >
            Try again
          </Button>
        </div>
      )}
      {AsyncResult.isFailure(result) && (
        <Alert variant="destructive" className="basis-full">
          <AlertDescription>
            Could not display the GitHub account.{' '}
            <Button
              size="xs"
              variant="outline"
              disabled={disabled}
              onClick={refresh}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {AsyncResult.isFailure(mutation) && (
        <Alert variant="destructive" className="basis-full">
          <AlertDescription>
            Could not save the GitHub account. Choose an account or reset it to
            try again.
          </AlertDescription>
        </Alert>
      )}
      {mutation.waiting && (
        <p role="status" className="basis-full text-xs text-muted-foreground">
          Saving GitHub account…
        </p>
      )}
    </Item>
  );
}
