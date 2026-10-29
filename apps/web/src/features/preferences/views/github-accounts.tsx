import { useAtom, useAtomRefresh, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { RotateCcwIcon, TriangleAlertIcon } from 'lucide-react';
import {
  readProjectGitHubAccount,
  setProjectGitHubAccount,
} from '@porcelain/client/reviews';
import { githubUnavailable } from '@porcelain/client/reviews/rules';
import { useGitHubAccountProjects } from '../queries/review-git-settings';
import type { Connection } from '@/shared/workspace/connection';
import { copyText } from '@/shared/workspace/copy';
import { TruncatedText } from '@/shared/views/truncated-text';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function GitHubAccounts({ connection }: { connection: Connection }) {
  const { projects, failed } = useGitHubAccountProjects(connection);
  return (
    <FieldSet>
      <FieldLegend variant="label">
        GitHub account for pull requests
      </FieldLegend>
      <FieldDescription>
        Pull requests open with the account{' '}
        <code className="font-mono text-xs">gh</code> detects for each project.
        Saved with the project, for every device.
      </FieldDescription>
      <ItemGroup>
        {projects?.map((project) => (
          <ProjectAccount
            key={project.id}
            connection={connection}
            project={project}
          />
        ))}
        {projects === undefined && !failed && (
          <Skeleton
            role="status"
            aria-label="Reading projects"
            className="h-13 w-full"
          />
        )}
        {projects === undefined && failed && (
          <p className="py-3 text-ui text-muted-foreground">
            Could not read this computer’s projects.
          </p>
        )}
        {projects?.length === 0 && (
          <p className="py-3 text-ui text-muted-foreground">
            Add a project to choose its GitHub account.
          </p>
        )}
      </ItemGroup>
    </FieldSet>
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
  const resetLabel = `Use the detected account for ${project.name}`;
  return (
    <Item variant="outline">
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
      {!account && !AsyncResult.isFailure(result) && (
        <Skeleton
          role="status"
          aria-label={`Reading GitHub account for ${project.name}`}
          className="h-8 w-42"
        />
      )}
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
                {(value: string | null) =>
                  value === null ? (
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
          <span>
            {account?.unavailable?.reason === 'no-access'
              ? 'No signed-in account can open it'
              : unavailable.description}
          </span>
          {unavailable.action.kind === 'install' && (
            <Button
              size="xs"
              variant="link"
              nativeButton={false}
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
