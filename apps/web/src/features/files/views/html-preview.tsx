import { StateSpinner } from '@/shared/views/state-notice';
import { Cause, Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { ArrowLeftIcon, RotateCwIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  fileErrorMessage,
  type FilesScope,
} from '@porcelain/client/files/rules';
import { repositoryReference } from '@porcelain/client/links/rules';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useHtmlPreview } from '@/features/files/queries/preview-assets';
import { useTextContents } from '../queries/text';
import { browserHtmlPreview } from '../adapters/html-preview';
import { HtmlFrame } from './html-frame';
import { desktopShell } from '@/shared/shell';
import { TruncatedText } from '@/shared/views/truncated-text';
import { type Connection } from '@/shared/workspace/connection';

const HTML_PAGE = /\.html?$/i;

export function HtmlPreview({
  scope,
  path,
  html,
  connection,
  onOpenPath,
}: {
  scope: FilesScope;
  path: string;
  html: string;
  connection: Connection;
  onOpenPath: (path: string) => void;
}) {
  const [trail, setTrail] = useState<readonly string[]>([]);
  const [runScripts, setRunScripts] = useState(!desktopShell);
  const scripts = desktopShell
    ? undefined
    : { run: runScripts, toggle: () => setRunScripts(!runScripts) };
  const current = trail.at(-1) ?? path;
  const page = useTextContents(
    connection,
    scope,
    current === path ? [] : [current],
  );
  const text = current === path ? html : page.contents.get(current);
  const back =
    trail.length > 0 ? () => setTrail(trail.slice(0, -1)) : undefined;
  if (text === undefined)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PreviewBar
          path={current}
          onBack={back}
          onReload={page.retry}
          scripts={scripts}
        />
        {page.failed ? (
          <p role="alert" className="p-4 text-ui">
            Could not read {current}.
          </p>
        ) : (
          <StateSpinner label="Preparing the preview" />
        )}
      </div>
    );
  return (
    <PreviewPage
      key={current}
      scope={scope}
      path={current}
      html={text}
      connection={connection}
      onBack={back}
      onReload={page.retry}
      scripts={scripts}
      onLink={(href, links) => {
        if (!links.includes(href)) return;
        const reference = repositoryReference(current, href);
        if (reference.kind === 'external' && navigator.userActivation.isActive)
          window.open(reference.url, '_blank', 'noopener,noreferrer');
        if (reference.kind !== 'repository') return;
        if (HTML_PAGE.test(reference.path))
          setTrail([...trail, reference.path]);
        else onOpenPath(reference.path);
      }}
    />
  );
}

type Scripts = { run: boolean; toggle: () => void } | undefined;

function PreviewBar({
  path,
  onBack,
  onReload,
  scripts,
}: {
  path: string;
  onBack: (() => void) | undefined;
  onReload: () => void;
  scripts: Scripts;
}) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-1 border-b bg-muted/40 px-1.5">
      {onBack && (
        <IconAction label="Back" onClick={onBack}>
          <ArrowLeftIcon />
        </IconAction>
      )}
      <TruncatedText
        text={path}
        cut="start"
        className="min-w-0 flex-1 px-1.5 font-mono text-2xs text-muted-foreground"
      />
      {scripts && (
        <label className="flex items-center gap-1.5 px-1.5 text-2xs text-muted-foreground">
          Scripts
          <Switch
            size="sm"
            aria-label="Run the page's scripts"
            checked={scripts.run}
            onCheckedChange={scripts.toggle}
          />
        </label>
      )}
      <IconAction label="Reload" onClick={onReload}>
        <RotateCwIcon />
      </IconAction>
    </div>
  );
}

function PreviewPage({
  scope,
  path,
  html,
  connection,
  onBack,
  onReload,
  scripts,
  onLink,
}: {
  scope: FilesScope;
  path: string;
  html: string;
  connection: Connection;
  onBack: (() => void) | undefined;
  onReload: () => void;
  scripts: Scripts;
  onLink: (href: string, links: readonly string[]) => void;
}) {
  const { preview, refresh } = useHtmlPreview(
    connection,
    scope,
    path,
    html,
    browserHtmlPreview,
  );
  const [loads, setLoads] = useState(0);
  const bar = (
    <PreviewBar
      path={path}
      scripts={scripts}
      onBack={onBack}
      onReload={() => {
        onReload();
        refresh();
        setLoads(loads + 1);
      }}
    />
  );
  if (AsyncResult.isInitial(preview))
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {bar}
        <StateSpinner label="Preparing the preview" />
      </div>
    );
  if (AsyncResult.isFailure(preview))
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {bar}
        <p role="alert" className="p-4">
          {fileErrorMessage(Cause.squash(preview.cause))}
        </p>
      </div>
    );
  const document = Option.getOrThrow(AsyncResult.value(preview));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {bar}
      {document.missing.length > 0 && (
        <p
          role="status"
          className="flex border-b px-3 py-1.5 text-2xs text-muted-foreground"
        >
          <TruncatedText
            text={`Not loaded: ${document.missing.join(', ')}`}
            className="min-w-0 flex-1"
          />
        </p>
      )}
      <HtmlFrame
        key={`${loads}:${scripts?.run === true}`}
        html={document.html}
        mediaSources={document.mediaSources ?? []}
        scripts={
          scripts?.run === true
            ? { run: true }
            : { run: false, nonce: document.nonce }
        }
        title={`${path} HTML preview`}
        className="min-h-0 flex-1"
        onLink={(href) => onLink(href, document.links)}
      />
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent role="tooltip">{label}</TooltipContent>
    </Tooltip>
  );
}
